import pg from 'pg';
import { settings } from './config';

export interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Verification {
  passed: boolean;
  checks: Check[];
  loggedRequests: number;
}

export interface VerifyInput {
  accountIds: string[];
  successfulResponses: number;
  connections: number;
}

interface AccountMonthRow {
  account_consumed: number;
  users_sum: number;
  log_sum: number;
  account_allowance: number;
}

const ACCOUNT_MONTHS_SQL = `
  WITH users_sum AS (
    SELECT u.account_id, uu.period, SUM(uu.consumed)::int AS total
    FROM user_usage uu
    JOIN users u ON u.id = uu.user_id
    WHERE u.account_id = ANY($1::uuid[])
    GROUP BY u.account_id, uu.period
  ), log_sum AS (
    SELECT account_id, period, COALESCE(SUM(units) FILTER (WHERE accepted), 0)::int AS accepted_units
    FROM usage_requests
    WHERE account_id = ANY($1::uuid[])
    GROUP BY account_id, period
  )
  SELECT au.consumed AS account_consumed,
         COALESCE(us.total, 0) AS users_sum,
         COALESCE(ls.accepted_units, 0) AS log_sum,
         p.monthly_allowance AS account_allowance
  FROM account_usage au
  JOIN accounts a ON a.id = au.account_id
  JOIN plans p ON p.id = a.plan_id
  LEFT JOIN users_sum us ON us.account_id = au.account_id AND us.period = au.period
  LEFT JOIN log_sum ls ON ls.account_id = au.account_id AND ls.period = au.period
  WHERE au.account_id = ANY($1::uuid[])`;

const USER_LOG_MISMATCH_SQL = `
  SELECT COUNT(*)::int AS total
  FROM user_usage uu
  JOIN users u ON u.id = uu.user_id
  LEFT JOIN (
    SELECT user_id, period, SUM(units) FILTER (WHERE accepted)::int AS accepted_units
    FROM usage_requests
    WHERE account_id = ANY($1::uuid[])
    GROUP BY user_id, period
  ) l ON l.user_id = uu.user_id AND l.period = uu.period
  WHERE u.account_id = ANY($1::uuid[]) AND uu.consumed <> COALESCE(l.accepted_units, 0)`;

const USERS_OVER_ALLOWANCE_SQL = `
  SELECT COUNT(*)::int AS total
  FROM user_usage uu
  JOIN users u ON u.id = uu.user_id
  JOIN plans p ON p.id = u.plan_id
  WHERE u.account_id = ANY($1::uuid[]) AND uu.consumed > p.monthly_allowance`;

const LOGGED_REQUESTS_SQL = `
  SELECT COUNT(*)::int AS total FROM usage_requests WHERE account_id = ANY($1::uuid[])`;

export async function verifyInvariants(input: VerifyInput): Promise<Verification> {
  const pool = new pg.Pool({ connectionString: settings.databaseUrl, max: 2 });
  try {
    const checks: Check[] = [];

    const months = await pool.query<AccountMonthRow>(ACCOUNT_MONTHS_SQL, [input.accountIds]);
    const inconsistent = months.rows.filter(
      (row) => row.account_consumed !== row.users_sum || row.account_consumed !== row.log_sum,
    );
    checks.push({
      name: 'account counter = sum of user counters = sum of accepted units in the log',
      passed: inconsistent.length === 0,
      detail: `${months.rows.length} account-months checked, ${inconsistent.length} inconsistent`,
    });

    const overAccount = months.rows.filter((row) => row.account_consumed > row.account_allowance);
    checks.push({
      name: 'no account counter is above its monthly allowance',
      passed: overAccount.length === 0,
      detail: `${overAccount.length} account-months above the allowance`,
    });

    const mismatch = await pool.query<{ total: number }>(USER_LOG_MISMATCH_SQL, [input.accountIds]);
    checks.push({
      name: 'every user counter = accepted units of that user in the log',
      passed: mismatch.rows[0]?.total === 0,
      detail: `${mismatch.rows[0]?.total ?? '?'} users differ from their log`,
    });

    const overUsers = await pool.query<{ total: number }>(USERS_OVER_ALLOWANCE_SQL, [input.accountIds]);
    checks.push({
      name: 'no user counter is above its monthly allowance',
      passed: overUsers.rows[0]?.total === 0,
      detail: `${overUsers.rows[0]?.total ?? '?'} users above the allowance`,
    });

    const logged = await pool.query<{ total: number }>(LOGGED_REQUESTS_SQL, [input.accountIds]);
    const loggedRequests = logged.rows[0]?.total ?? 0;
    // Up to one in-flight request per connection may commit after the generator stops; negative is a bug.
    const extra = loggedRequests - input.successfulResponses;
    checks.push({
      name: 'every successful response has exactly one log row',
      passed: extra >= 0 && extra <= input.connections,
      detail: `${input.successfulResponses} responses, ${loggedRequests} log rows (${extra} requests were still in flight when the test stopped, at most ${input.connections} allowed)`,
    });

    return { passed: checks.every((check) => check.passed), checks, loggedRequests };
  } finally {
    await pool.end();
  }
}