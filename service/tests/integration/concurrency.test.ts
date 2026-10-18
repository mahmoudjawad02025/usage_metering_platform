import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { pool } from '../../src/db/pool';
import { closeDatabase, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestPlan,
  createTestUser,
  type TestAccount,
} from '../helpers/factories';
import { consume } from '../helpers/test_app';

let account: TestAccount;

beforeEach(async () => {
  await resetDatabase();
  account = await createTestAccount();
});

afterAll(closeDatabase);

async function readTotals(accountId: string) {
  const accountRow = await pool.query<{ total: number }>(
    'SELECT COALESCE(SUM(consumed), 0)::int AS total FROM account_usage WHERE account_id = $1',
    [accountId],
  );
  const usersRow = await pool.query<{ total: number }>(
    `SELECT COALESCE(SUM(uu.consumed), 0)::int AS total
     FROM user_usage uu JOIN users u ON u.id = uu.user_id WHERE u.account_id = $1`,
    [accountId],
  );
  const loggedRow = await pool.query<{ total: number; requests: number }>(
    `SELECT COALESCE(SUM(units) FILTER (WHERE accepted), 0)::int AS total, COUNT(*)::int AS requests
     FROM usage_requests WHERE account_id = $1`,
    [accountId],
  );
  return {
    accountConsumed: accountRow.rows[0]?.total ?? 0,
    sumOfUsers: usersRow.rows[0]?.total ?? 0,
    sumOfAcceptedInLog: loggedRow.rows[0]?.total ?? 0,
    loggedRequests: loggedRow.rows[0]?.requests ?? 0,
  };
}

describe('competing requests for the same user', () => {
  it('accepts exactly as many requests as the user allowance allows', async () => {
    const planId = await createTestPlan(account.id, {
      scope: 'user',
      monthlyAllowance: 100,
      maxPerRequest: 20,
    });
    const user = await createTestUser(account.id, { planId });

    const results = await Promise.all(
      Array.from({ length: 50 }, () => consume(account.apiKey, { userId: user.id, units: 10 })),
    );

    const accepted = results.filter((res) => res.body.accepted === true);
    const rejected = results.filter((res) => res.body.accepted === false);
    expect(results.every((res) => res.status === 200)).toBe(true);
    expect(accepted).toHaveLength(10);
    expect(rejected).toHaveLength(40);
    expect(rejected.every((res) => res.body.rejection.level === 'user')).toBe(true);

    expect(await readTotals(account.id)).toEqual({
      accountConsumed: 100,
      sumOfUsers: 100,
      sumOfAcceptedInLog: 100,
      loggedRequests: 50,
    });
  });
});

describe('competing requests from different users of one account', () => {
  it('never lets the shared account allowance be exceeded', async () => {
    const accountPlanId = await createTestPlan(account.id, {
      scope: 'account',
      monthlyAllowance: 100,
      maxPerRequest: 100,
    });
    await pool.query('UPDATE accounts SET plan_id = $2 WHERE id = $1', [account.id, accountPlanId]);
    const users = await Promise.all(
      Array.from({ length: 5 }, () =>
        createTestUser(account.id, { planId: PREDEFINED_PLAN_IDS.PREMIUM }),
      ),
    );

    const results = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        consume(account.apiKey, { userId: users[index % users.length]!.id, units: 10 }),
      ),
    );

    const accepted = results.filter((res) => res.body.accepted === true);
    expect(results.every((res) => res.status === 200)).toBe(true);
    expect(accepted).toHaveLength(10);
    expect(
      results
        .filter((res) => res.body.accepted === false)
        .every((res) => res.body.rejection.level === 'account'),
    ).toBe(true);

    expect(await readTotals(account.id)).toEqual({
      accountConsumed: 100,
      sumOfUsers: 100,
      sumOfAcceptedInLog: 100,
      loggedRequests: 40,
    });
  });
});

describe('the same request sent many times at once', () => {
  it('is counted once and replayed for every other attempt', async () => {
    const user = await createTestUser(account.id);

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        consume(account.apiKey, { userId: user.id, units: 10, requestId: 'one-and-only' }),
      ),
    );

    expect(results.every((res) => res.status === 200)).toBe(true);
    expect(results.filter((res) => res.body.replayed === false)).toHaveLength(1);
    expect(results.filter((res) => res.body.replayed === true)).toHaveLength(19);
    expect(new Set(results.map((res) => res.body.account.consumed))).toEqual(new Set([10]));

    expect(await readTotals(account.id)).toEqual({
      accountConsumed: 10,
      sumOfUsers: 10,
      sumOfAcceptedInLog: 10,
      loggedRequests: 1,
    });
  });
});