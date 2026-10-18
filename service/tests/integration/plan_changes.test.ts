import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { closeDatabase, resetDatabase } from '../helpers/database';
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

function patchPlan(planId: string, body: Record<string, number>) {
  return api().patch(`/plans/${planId}`).set('x-api-key', account.apiKey).send(body);
}

function usageOf(userId: string) {
  return api().get(`/usage/users/${userId}`).set('x-api-key', account.apiKey);
}

describe('editing a custom plan', () => {
  it('applies a new per-request limit to the next request without any restart', async () => {
    const planId = await createTestPlan(account.id, { scope: 'user', monthlyAllowance: 1000, maxPerRequest: 10 });
    const user = await createTestUser(account.id, { planId });

    const before = await consume(account.apiKey, { userId: user.id, units: 30 });
    await patchPlan(planId, { maxPerRequest: 50 });
    const after = await consume(account.apiKey, { userId: user.id, units: 30 });

    expect(before.body.accepted).toBe(false);
    expect(after.body.accepted).toBe(true);
  });

  it('affects every user that shares the plan', async () => {
    const planId = await createTestPlan(account.id, { scope: 'user', monthlyAllowance: 1000, maxPerRequest: 10 });
    const first = await createTestUser(account.id, { planId });
    const second = await createTestUser(account.id, { planId });

    await patchPlan(planId, { maxPerRequest: 40 });

    const results = await Promise.all(
      [first, second].map((user) => consume(account.apiKey, { userId: user.id, units: 40 })),
    );
    expect(results.map((res) => res.body.accepted)).toEqual([true, true]);
  });

  it('applies to the account when the plan is assigned to the account', async () => {
    const accountPlanId = await createTestPlan(account.id, { scope: 'account', monthlyAllowance: 20, maxPerRequest: 100 });
    await api().put('/accounts/me/plan').set('x-api-key', account.apiKey).send({ planId: accountPlanId });
    const user = await createTestUser(account.id, { planId: PREDEFINED_PLAN_IDS.PREMIUM });

    await consume(account.apiKey, { userId: user.id, units: 20 });
    const blocked = await consume(account.apiKey, { userId: user.id, units: 1 });
    await patchPlan(accountPlanId, { monthlyAllowance: 100 });
    const allowed = await consume(account.apiKey, { userId: user.id, units: 1 });

    expect(blocked.body.rejection).toMatchObject({ rule: 'monthly_allowance', level: 'account' });
    expect(allowed.body.accepted).toBe(true);
    expect(allowed.body.account).toMatchObject({ consumed: 21, remaining: 79 });
  });
});

describe('lowering an allowance below the existing usage', () => {
  it('shows zero remaining, rejects further requests, and recovers when the allowance grows', async () => {
    const planId = await createTestPlan(account.id, { scope: 'user', monthlyAllowance: 100, maxPerRequest: 50 });
    const user = await createTestUser(account.id, { planId });
    await consume(account.apiKey, { userId: user.id, units: 50 });

    await patchPlan(planId, { monthlyAllowance: 30 });
    const usage = await usageOf(user.id);
    const rejected = await consume(account.apiKey, { userId: user.id, units: 1 });

    expect(usage.body.user).toMatchObject({ consumed: 50, remaining: 0 });
    expect(rejected.body.accepted).toBe(false);
    expect(rejected.body.rejection).toEqual({
      rule: 'monthly_allowance',
      level: 'user',
      limit: 30,
      remaining: 0,
    });
    expect(rejected.body.user.remaining).toBe(0);

    await patchPlan(planId, { monthlyAllowance: 60 });
    const recovered = await consume(account.apiKey, { userId: user.id, units: 10 });
    const tooMuch = await consume(account.apiKey, { userId: user.id, units: 1 });

    expect(recovered.body.accepted).toBe(true);
    expect(tooMuch.body.accepted).toBe(false);
  });
});

describe('switching plans', () => {
  it('keeps the units already consumed and does not grant a fresh allowance', async () => {
    const smallPlan = await createTestPlan(account.id, { scope: 'user', monthlyAllowance: 20, maxPerRequest: 20 });
    const user = await createTestUser(account.id);
    await consume(account.apiKey, { userId: user.id, units: 20 });

    await api().put(`/users/${user.id}/plan`).set('x-api-key', account.apiKey).send({ planId: smallPlan });
    const usage = await usageOf(user.id);
    const blocked = await consume(account.apiKey, { userId: user.id, units: 1 });

    expect(usage.body.user).toMatchObject({ consumed: 20, remaining: 0, plan: { monthlyAllowance: 20 } });
    expect(blocked.body.accepted).toBe(false);
  });

  it('gives the difference between the new allowance and the usage when upgrading', async () => {
    const user = await createTestUser(account.id);
    await consume(account.apiKey, { userId: user.id, units: 20 });

    await api()
      .put(`/users/${user.id}/plan`)
      .set('x-api-key', account.apiKey)
      .send({ planId: PREDEFINED_PLAN_IDS.PREMIUM });
    const usage = await usageOf(user.id);
    const bigRequest = await consume(account.apiKey, { userId: user.id, units: 100 });

    expect(usage.body.user).toMatchObject({ consumed: 20, remaining: 9980 });
    expect(bigRequest.body.accepted).toBe(true);
  });

  it('keeps the account counters when the account plan changes', async () => {
    const user = await createTestUser(account.id);
    await consume(account.apiKey, { userId: user.id, units: 15 });

    const res = await api()
      .put('/accounts/me/plan')
      .set('x-api-key', account.apiKey)
      .send({ planId: PREDEFINED_PLAN_IDS.PRO });
    const usage = await api().get('/usage').set('x-api-key', account.apiKey);

    expect(res.body.plan.name).toBe('Pro');
    expect(usage.body.account).toMatchObject({ consumed: 15, remaining: 99985 });
  });

  it('rejects at the account level after switching to an account plan smaller than the usage', async () => {
    const user = await createTestUser(account.id, { planId: PREDEFINED_PLAN_IDS.PREMIUM });
    await consume(account.apiKey, { userId: user.id, units: 50 });
    const tinyPlan = await createTestPlan(account.id, { scope: 'account', monthlyAllowance: 40, maxPerRequest: 100 });

    await api().put('/accounts/me/plan').set('x-api-key', account.apiKey).send({ planId: tinyPlan });
    const usage = await api().get('/usage').set('x-api-key', account.apiKey);
    const blocked = await consume(account.apiKey, { userId: user.id, units: 1 });

    expect(usage.body.account).toMatchObject({ consumed: 50, remaining: 0 });
    expect(blocked.body.rejection).toMatchObject({ rule: 'monthly_allowance', level: 'account', remaining: 0 });
  });
});

describe('request history', () => {
  it('keeps the old decisions and the limits that were applied after a plan changes', async () => {
    const planId = await createTestPlan(account.id, { scope: 'user', name: 'Original', monthlyAllowance: 1000, maxPerRequest: 10 });
    const user = await createTestUser(account.id, { planId });
    await consume(account.apiKey, { userId: user.id, units: 30, requestId: 'before-change' });

    await patchPlan(planId, { maxPerRequest: 500 });
    await consume(account.apiKey, { userId: user.id, units: 30, requestId: 'after-change' });

    const history = await api().get('/usage/history').set('x-api-key', account.apiKey);
    const [after, before] = history.body.items;

    expect(before).toMatchObject({
      requestId: 'before-change',
      accepted: false,
      rejection: { rule: 'max_per_request', level: 'user', limit: 10 },
      appliedLimits: { user: { planName: 'Original', maxPerRequest: 10 } },
    });
    expect(after).toMatchObject({
      requestId: 'after-change',
      accepted: true,
      appliedLimits: { user: { maxPerRequest: 500 } },
    });
  });
});