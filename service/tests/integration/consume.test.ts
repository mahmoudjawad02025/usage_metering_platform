import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { pool } from '../../src/db/pool';
import { closeDatabase, readConsumed, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestPlan,
  createTestUser,
  type TestAccount,
} from '../helpers/factories';
import { api, consume } from '../helpers/test_app';

let account: TestAccount;

beforeEach(async () => {
  await resetDatabase();
  account = await createTestAccount();
});

afterAll(closeDatabase);

describe('the three examples from the project brief', () => {
  it('accepts 10 units and adds them to both the user and the account', async () => {
    const user = await createTestUser(account.id);

    const res = await consume(account.apiKey, { userId: user.id, units: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accepted: true,
      replayed: false,
      units: 10,
      rejection: null,
      account: { consumed: 10, remaining: 9990, plan: { name: 'Starter' } },
      user: { id: user.id, consumed: 10, remaining: 990, plan: { name: 'Basic' } },
    });
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 10, user: 10 });
  });

  it('rejects 25 units because of the user per-request limit', async () => {
    const user = await createTestUser(account.id);

    const res = await consume(account.apiKey, { userId: user.id, units: 25 });

    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(false);
    expect(res.body.rejection).toEqual({ rule: 'max_per_request', level: 'user', limit: 20 });
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 0, user: 0 });
  });

  it('rejects 10 units when the account has only 5 units left', async () => {
    const tinyAccountPlan = await createTestPlan(account.id, {
      scope: 'account',
      name: 'Tiny',
      monthlyAllowance: 15,
      maxPerRequest: 100,
    });
    await pool.query('UPDATE accounts SET plan_id = $2 WHERE id = $1', [account.id, tinyAccountPlan]);
    const user = await createTestUser(account.id, { planId: PREDEFINED_PLAN_IDS.PREMIUM });

    const first = await consume(account.apiKey, { userId: user.id, units: 10 });
    const second = await consume(account.apiKey, { userId: user.id, units: 10 });

    expect(first.body.accepted).toBe(true);
    expect(first.body.account.remaining).toBe(5);
    expect(second.body.accepted).toBe(false);
    expect(second.body.rejection).toEqual({
      rule: 'monthly_allowance',
      level: 'account',
      limit: 15,
      remaining: 5,
    });
    expect(second.body.user.remaining).toBe(9990);
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 10, user: 10 });
  });
});

describe('user level limits', () => {
  it('rejects when the monthly allowance of the user is exhausted', async () => {
    const planId = await createTestPlan(account.id, {
      scope: 'user',
      monthlyAllowance: 25,
      maxPerRequest: 20,
    });
    const user = await createTestUser(account.id, { planId });

    await consume(account.apiKey, { userId: user.id, units: 20 });
    const res = await consume(account.apiKey, { userId: user.id, units: 10 });

    expect(res.body.accepted).toBe(false);
    expect(res.body.rejection).toEqual({
      rule: 'monthly_allowance',
      level: 'user',
      limit: 25,
      remaining: 5,
    });
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 20, user: 20 });
  });

  it('accepts exactly the remaining amount', async () => {
    const planId = await createTestPlan(account.id, {
      scope: 'user',
      monthlyAllowance: 25,
      maxPerRequest: 20,
    });
    const user = await createTestUser(account.id, { planId });

    await consume(account.apiKey, { userId: user.id, units: 20 });
    const res = await consume(account.apiKey, { userId: user.id, units: 5 });

    expect(res.body.accepted).toBe(true);
    expect(res.body.user.remaining).toBe(0);
  });
});

describe('several users in one account', () => {
  it('lets users on different plans do different things', async () => {
    const basic = await createTestUser(account.id, { planId: PREDEFINED_PLAN_IDS.BASIC });
    const premium = await createTestUser(account.id, { planId: PREDEFINED_PLAN_IDS.PREMIUM });

    const basicResult = await consume(account.apiKey, { userId: basic.id, units: 25 });
    const premiumResult = await consume(account.apiKey, { userId: premium.id, units: 25 });

    expect(basicResult.body.accepted).toBe(false);
    expect(premiumResult.body.accepted).toBe(true);
  });

  it('keeps separate user totals when users share one plan, and sums them for the account', async () => {
    const sharedPlan = await createTestPlan(account.id, {
      scope: 'user',
      monthlyAllowance: 20,
      maxPerRequest: 20,
    });
    const first = await createTestUser(account.id, { planId: sharedPlan });
    const second = await createTestUser(account.id, { planId: sharedPlan });

    await consume(account.apiKey, { userId: first.id, units: 20 });
    const firstAgain = await consume(account.apiKey, { userId: first.id, units: 1 });
    const secondResult = await consume(account.apiKey, { userId: second.id, units: 20 });

    expect(firstAgain.body.accepted).toBe(false);
    expect(secondResult.body.accepted).toBe(true);
    expect(secondResult.body.account.consumed).toBe(40);
    expect(await readConsumed(account.id, first.id)).toEqual({ account: 40, user: 20 });
  });

  it('does not let a larger user allowance raise the shared account allowance', async () => {
    const tinyAccountPlan = await createTestPlan(account.id, {
      scope: 'account',
      monthlyAllowance: 30,
      maxPerRequest: 100,
    });
    await pool.query('UPDATE accounts SET plan_id = $2 WHERE id = $1', [account.id, tinyAccountPlan]);
    const premium = await createTestUser(account.id, { planId: PREDEFINED_PLAN_IDS.PREMIUM });

    const res = await consume(account.apiKey, { userId: premium.id, units: 50 });

    expect(res.body.accepted).toBe(false);
    expect(res.body.rejection.level).toBe('account');
  });
});

describe('request log', () => {
  it('stores accepted and rejected decisions with the limits that were applied', async () => {
    const user = await createTestUser(account.id);

    await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'ok-1' });
    await consume(account.apiKey, { userId: user.id, units: 25, requestId: 'too-big-1' });

    const { rows } = await pool.query(
      `SELECT request_id, accepted, rejected_rule, rejected_level, applied_limits
       FROM usage_requests WHERE account_id = $1 ORDER BY created_at`,
      [account.id],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ request_id: 'ok-1', accepted: true, rejected_rule: null });
    expect(rows[1]).toMatchObject({
      request_id: 'too-big-1',
      accepted: false,
      rejected_rule: 'max_per_request',
      rejected_level: 'user',
    });
    expect(rows[1].applied_limits.user).toMatchObject({
      planName: 'Basic',
      maxPerRequest: 20,
      consumedBefore: 10,
    });
  });
});

describe('input validation and isolation', () => {
  it('returns 404 for a user of another account and for an unknown user', async () => {
    const other = await createTestAccount();
    const foreign = await createTestUser(other.id);

    const foreignResult = await consume(account.apiKey, { userId: foreign.id, units: 1 });
    const unknownResult = await consume(account.apiKey, {
      userId: 'c0000000-0000-4000-8000-000000000999',
      units: 1,
    });

    expect(foreignResult.status).toBe(404);
    expect(unknownResult.status).toBe(404);
    expect(await readConsumed(other.id, foreign.id)).toEqual({ account: 0, user: 0 });
  });

  it.each([
    ['zero units', { units: 0 }],
    ['negative units', { units: -5 }],
    ['decimal units', { units: 2.5 }],
    ['units as a string', { units: '10' }],
    ['units above the maximum', { units: 1_000_000_001 }],
    ['missing request id', { requestId: undefined }],
    ['blank request id', { requestId: '   ' }],
    ['request id longer than 128 characters', { requestId: 'r'.repeat(129) }],
    ['malformed user id', { userId: 'alice' }],
    ['unexpected field', { accountId: 'someone-else' }],
  ])('rejects %s with 400', async (_label, override) => {
    const user = await createTestUser(account.id);

    const res = await api()
      .post('/usage/consume')
      .set('x-api-key', account.apiKey)
      .send({ userId: user.id, units: 1, requestId: 'valid-id', ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 0, user: 0 });
  });

  it('requires an API key', async () => {
    const res = await api()
      .post('/usage/consume')
      .send({ userId: 'c0000000-0000-4000-8000-000000000999', units: 1, requestId: 'r' });

    expect(res.status).toBe(401);
  });
});