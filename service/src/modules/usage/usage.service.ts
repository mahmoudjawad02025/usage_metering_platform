import { ERROR_CODES } from '../../core/errors/error_codes';
import { ConflictError, NotFoundError } from '../../core/errors/app_error';
import { buildPage, type Page } from '../../core/utils/pagination';
import { getCurrentUtcPeriod, monthToPeriod, periodToMonth } from '../../core/utils/utc_period';
import { withTransaction } from '../../db/transaction';
import { describeRejection, evaluateRules, remainingUnits } from './rule_evaluator';
import * as usageRepository from './usage.repository';
import type { UsageQuery } from './usage.schemas';
import type {
  AppliedLimits,
  ConsumeInput,
  ConsumeResponse,
  LevelSnapshot,
  LevelState,
  LevelView,
  PlanSnapshot,
  StoredRequest,
  UsageRow,
  UsageView,
  UserUsageRow,
  UserUsageView,
} from './usage.types';

function toLevelState(snapshot: LevelSnapshot): LevelState {
  return {
    monthlyAllowance: snapshot.monthlyAllowance,
    maxPerRequest: snapshot.maxPerRequest,
    consumed: snapshot.consumedBefore,
  };
}

function toLevelView(snapshot: LevelSnapshot, addedUnits: number): LevelView {
  const consumed = snapshot.consumedBefore + addedUnits;
  return {
    plan: {
      id: snapshot.planId,
      name: snapshot.planName,
      monthlyAllowance: snapshot.monthlyAllowance,
      maxPerRequest: snapshot.maxPerRequest,
    },
    consumed,
    remaining: remainingUnits({ ...toLevelState(snapshot), consumed }),
  };
}

function toSnapshot(plan: PlanSnapshot, consumedBefore: number): LevelSnapshot {
  return { ...plan, consumedBefore };
}

function buildConsumeResponse(request: StoredRequest, replayed: boolean): ConsumeResponse {
  const { appliedLimits } = request;
  const addedUnits = request.accepted ? request.units : 0;

  const rejection =
    request.rejectedRule && request.rejectedLevel
      ? describeRejection(
          request.rejectedRule,
          request.rejectedLevel,
          toLevelState(appliedLimits[request.rejectedLevel]),
        )
      : null;

  return {
    accepted: request.accepted,
    replayed,
    requestId: request.requestId,
    units: request.units,
    period: periodToMonth(request.period),
    rejection,
    account: toLevelView(appliedLimits.account, addedUnits),
    user: { id: request.userId, ...toLevelView(appliedLimits.user, addedUnits) },
  };
}

export async function consumeUnits(
  accountId: string,
  input: ConsumeInput,
  now: Date = new Date(),
): Promise<ConsumeResponse> {
  // One transaction so counters and the usage log commit together or not at all.
  return withTransaction(async (client) => {
    const userExists = await usageRepository.userBelongsToAccount(client, accountId, input.userId);
    if (!userExists) throw new NotFoundError('User not found');

    const period = getCurrentUtcPeriod(now);
    const counters = await usageRepository.lockCounters(client, accountId, input.userId, period);

    // After the account lock so same-account retries see each other's committed log rows.
    const existing = await usageRepository.findRequest(client, accountId, input.requestId);
    if (existing) {
      // Same requestId must not mean a different payload; treat that as a conflict, not a replay.
      if (existing.userId !== input.userId || existing.units !== input.units) {
        throw new ConflictError(
          'This requestId was already used with a different userId or units',
          ERROR_CODES.REQUEST_ID_REUSED,
        );
      }
      return buildConsumeResponse(existing, true);
    }

    // Live plan read after locks (never cached) so edits apply to the next request.
    const { accountPlan, userPlan } = await usageRepository.getPlans(client, accountId, input.userId);
    const appliedLimits: AppliedLimits = {
      account: toSnapshot(accountPlan, counters.accountConsumed),
      user: toSnapshot(userPlan, counters.userConsumed),
    };

    const decision = evaluateRules({
      units: input.units,
      account: toLevelState(appliedLimits.account),
      user: toLevelState(appliedLimits.user),
    });

    if (decision.accepted) {
      await usageRepository.incrementCounters(client, accountId, input.userId, period, input.units);
    }

    const stored = await usageRepository.insertRequest(client, {
      accountId,
      userId: input.userId,
      requestId: input.requestId,
      units: input.units,
      period,
      decision,
      appliedLimits,
    });

    return buildConsumeResponse(stored, false);
  });
}

export interface UsageSummary {
  period: string;
  account: UsageView;
  users: Page<UserUsageView>;
}

function toUsageView(row: UsageRow): UsageView {
  return {
    plan: {
      id: row.planId,
      name: row.planName,
      monthlyAllowance: row.monthlyAllowance,
      maxPerRequest: row.maxPerRequest,
    },
    consumed: row.consumed,
    remaining: remainingUnits({
      monthlyAllowance: row.monthlyAllowance,
      maxPerRequest: row.maxPerRequest,
      consumed: row.consumed,
    }),
  };
}

function toUserUsageView(row: UserUsageRow): UserUsageView {
  return { id: row.userId, externalId: row.externalId, ...toUsageView(row) };
}

function resolvePeriod(month: string | undefined): string {
  return month ? monthToPeriod(month) : getCurrentUtcPeriod();
}

export async function getUsageSummary(accountId: string, query: UsageQuery): Promise<UsageSummary> {
  const period = resolvePeriod(query.period);

  const account = await usageRepository.getAccountUsage(accountId, period);
  if (!account) throw new NotFoundError('Account not found');

  const { items, total } = await usageRepository.listUserUsage(
    accountId,
    period,
    query.limit,
    query.offset,
  );

  return {
    period: periodToMonth(period),
    account: toUsageView(account),
    users: buildPage(items.map(toUserUsageView), total, query),
  };
}

export async function getUserUsage(
  accountId: string,
  userId: string,
  month: string | undefined,
): Promise<{ period: string; user: UserUsageView }> {
  const period = resolvePeriod(month);

  const row = await usageRepository.getUserUsage(accountId, userId, period);
  if (!row) throw new NotFoundError('User not found');

  return { period: periodToMonth(period), user: toUserUsageView(row) };
}