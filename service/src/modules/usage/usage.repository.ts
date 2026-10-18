import type { PoolClient } from 'pg';
import { pool } from '../../db/pool';
import type {
  AppliedLimits,
  Counters,
  NewRequest,
  PlanSnapshot,
  RejectedRule,
  RuleLevel,
  StoredRequest,
  UsageRow,
  UserUsageRow,
} from './usage.types';

interface PlanSnapshotRow {
  plan_id: string;
  plan_name: string;
  monthly_allowance: number;
  max_per_request: number;
}

export interface RequestRow {
  id: string;
  request_id: string;
  user_id: string;
  units: number;
  period: string;
  accepted: boolean;
  rejected_rule: RejectedRule | null;
  rejected_level: RuleLevel | null;
  applied_limits: AppliedLimits;
  created_at: Date;
}

export const REQUEST_COLUMNS =
  'id, request_id, user_id, units, period, accepted, rejected_rule, rejected_level, applied_limits, created_at';

export function toStoredRequest(row: RequestRow): StoredRequest {
  return {
    id: row.id,
    requestId: row.request_id,
    userId: row.user_id,
    units: row.units,
    period: row.period,
    accepted: row.accepted,
    rejectedRule: row.rejected_rule,
    rejectedLevel: row.rejected_level,
    appliedLimits: row.applied_limits,
    createdAt: row.created_at,
  };
}

function toPlanSnapshot(row: PlanSnapshotRow): PlanSnapshot {
  return {
    planId: row.plan_id,
    planName: row.plan_name,
    monthlyAllowance: row.monthly_allowance,
    maxPerRequest: row.max_per_request,
  };
}

export async function userBelongsToAccount(
  client: PoolClient,
  accountId: string,
  userId: string,
): Promise<boolean> {
  const result = await client.query('SELECT 1 FROM users WHERE id = $1 AND account_id = $2', [
    userId,
    accountId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function ensureCounters(
  client: PoolClient,
  accountId: string,
  userId: string,
  period: string,
): Promise<void> {
  await client.query(
    'INSERT INTO account_usage (account_id, period) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [accountId, period],
  );
  await client.query(
    'INSERT INTO user_usage (user_id, period) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, period],
  );
}

export async function lockCounters(
  client: PoolClient,
  accountId: string,
  userId: string,
  period: string,
): Promise<Counters> {
  const account = await client.query<{ consumed: number }>(
    'SELECT consumed FROM account_usage WHERE account_id = $1 AND period = $2 FOR UPDATE',
    [accountId, period],
  );
  const user = await client.query<{ consumed: number }>(
    'SELECT consumed FROM user_usage WHERE user_id = $1 AND period = $2 FOR UPDATE',
    [userId, period],
  );

  const accountRow = account.rows[0];
  const userRow = user.rows[0];
  if (!accountRow || !userRow) throw new Error('Usage counters are missing after ensureCounters');

  return { accountConsumed: accountRow.consumed, userConsumed: userRow.consumed };
}

export async function findRequest(
  client: PoolClient,
  accountId: string,
  requestId: string,
): Promise<StoredRequest | null> {
  const { rows } = await client.query<RequestRow>(
    `SELECT ${REQUEST_COLUMNS} FROM usage_requests WHERE account_id = $1 AND request_id = $2`,
    [accountId, requestId],
  );
  const row = rows[0];
  return row ? toStoredRequest(row) : null;
}

export async function getAccountPlan(client: PoolClient, accountId: string): Promise<PlanSnapshot> {
  const { rows } = await client.query<PlanSnapshotRow>(
    `SELECT p.id AS plan_id, p.name AS plan_name, p.monthly_allowance, p.max_per_request
     FROM accounts a
     JOIN plans p ON p.id = a.plan_id
     WHERE a.id = $1`,
    [accountId],
  );
  const row = rows[0];
  if (!row) throw new Error('Account plan not found');
  return toPlanSnapshot(row);
}

export async function getUserPlan(client: PoolClient, userId: string): Promise<PlanSnapshot> {
  const { rows } = await client.query<PlanSnapshotRow>(
    `SELECT p.id AS plan_id, p.name AS plan_name, p.monthly_allowance, p.max_per_request
     FROM users u
     JOIN plans p ON p.id = u.plan_id
     WHERE u.id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) throw new Error('User plan not found');
  return toPlanSnapshot(row);
}

export async function incrementCounters(
  client: PoolClient,
  accountId: string,
  userId: string,
  period: string,
  units: number,
): Promise<void> {
  await client.query(
    'UPDATE account_usage SET consumed = consumed + $3 WHERE account_id = $1 AND period = $2',
    [accountId, period, units],
  );
  await client.query(
    'UPDATE user_usage SET consumed = consumed + $3 WHERE user_id = $1 AND period = $2',
    [userId, period, units],
  );
}

export async function insertRequest(
  client: PoolClient,
  request: NewRequest,
): Promise<StoredRequest> {
  const { decision, appliedLimits } = request;
  const { rows } = await client.query<RequestRow>(
    `INSERT INTO usage_requests
       (account_id, user_id, request_id, units, period, accepted, rejected_rule, rejected_level,
        account_plan_id, user_plan_id, applied_limits)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${REQUEST_COLUMNS}`,
    [
      request.accountId,
      request.userId,
      request.requestId,
      request.units,
      request.period,
      decision.accepted,
      decision.accepted ? null : decision.rule,
      decision.accepted ? null : decision.level,
      appliedLimits.account.planId,
      appliedLimits.user.planId,
      JSON.stringify(appliedLimits),
    ],
  );
  const row = rows[0];
  if (!row) throw new Error('Request insert returned no row');
  return toStoredRequest(row);
}

interface UsageRowRecord {
  plan_id: string;
  plan_name: string;
  monthly_allowance: number;
  max_per_request: number;
  consumed: number;
}

interface UserUsageRowRecord extends UsageRowRecord {
  user_id: string;
  external_id: string;
}

function toUsageRow(row: UsageRowRecord): UsageRow {
  return {
    planId: row.plan_id,
    planName: row.plan_name,
    monthlyAllowance: row.monthly_allowance,
    maxPerRequest: row.max_per_request,
    consumed: row.consumed,
  };
}

function toUserUsageRow(row: UserUsageRowRecord): UserUsageRow {
  return { ...toUsageRow(row), userId: row.user_id, externalId: row.external_id };
}

const USER_USAGE_SELECT = `
  SELECT u.id AS user_id, u.external_id,
         p.id AS plan_id, p.name AS plan_name, p.monthly_allowance, p.max_per_request,
         COALESCE(uu.consumed, 0) AS consumed
  FROM users u
  JOIN plans p ON p.id = u.plan_id
  LEFT JOIN user_usage uu ON uu.user_id = u.id AND uu.period = $2`;

export async function getAccountUsage(accountId: string, period: string): Promise<UsageRow | null> {
  const { rows } = await pool.query<UsageRowRecord>(
    `SELECT p.id AS plan_id, p.name AS plan_name, p.monthly_allowance, p.max_per_request,
            COALESCE(au.consumed, 0) AS consumed
     FROM accounts a
     JOIN plans p ON p.id = a.plan_id
     LEFT JOIN account_usage au ON au.account_id = a.id AND au.period = $2
     WHERE a.id = $1`,
    [accountId, period],
  );
  const row = rows[0];
  return row ? toUsageRow(row) : null;
}

export async function listUserUsage(
  accountId: string,
  period: string,
  limit: number,
  offset: number,
): Promise<{ items: UserUsageRow[]; total: number }> {
  const { rows } = await pool.query<UserUsageRowRecord>(
    `${USER_USAGE_SELECT}
     WHERE u.account_id = $1
     ORDER BY u.created_at ASC, u.id ASC
     LIMIT $3 OFFSET $4`,
    [accountId, period, limit, offset],
  );

  const count = await pool.query<{ total: number }>(
    'SELECT COUNT(*) AS total FROM users WHERE account_id = $1',
    [accountId],
  );

  return { items: rows.map(toUserUsageRow), total: count.rows[0]?.total ?? 0 };
}

export async function getUserUsage(
  accountId: string,
  userId: string,
  period: string,
): Promise<UserUsageRow | null> {
  const { rows } = await pool.query<UserUsageRowRecord>(
    `${USER_USAGE_SELECT} WHERE u.account_id = $1 AND u.id = $3`,
    [accountId, period, userId],
  );
  const row = rows[0];
  return row ? toUserUsageRow(row) : null;
}