import { buildPage, type Page } from '../../core/utils/pagination';
import { monthToPeriod, periodToMonth } from '../../core/utils/utc_period';
import { describeRejection } from '../usage/rule_evaluator';
import type { StoredRequest } from '../usage/usage.types';
import * as historyRepository from './history.repository';
import type { HistoryQuery } from './history.schemas';
import type { HistoryItem } from './history.types';

function toHistoryItem(request: StoredRequest): HistoryItem {
  const { appliedLimits } = request;

  const rejection =
    request.rejectedRule && request.rejectedLevel
      ? describeRejection(request.rejectedRule, request.rejectedLevel, {
          monthlyAllowance: appliedLimits[request.rejectedLevel].monthlyAllowance,
          maxPerRequest: appliedLimits[request.rejectedLevel].maxPerRequest,
          consumed: appliedLimits[request.rejectedLevel].consumedBefore,
        })
      : null;

  return {
    id: request.id,
    requestId: request.requestId,
    userId: request.userId,
    units: request.units,
    period: periodToMonth(request.period),
    accepted: request.accepted,
    rejection,
    appliedLimits,
    createdAt: request.createdAt,
  };
}

export async function listHistory(
  accountId: string,
  query: HistoryQuery,
): Promise<Page<HistoryItem>> {
  const { items, total } = await historyRepository.listRequests(
    accountId,
    {
      userId: query.userId,
      accepted: query.accepted,
      period: query.period ? monthToPeriod(query.period) : undefined,
    },
    query.limit,
    query.offset,
  );
  return buildPage(items.map(toHistoryItem), total, query);
}