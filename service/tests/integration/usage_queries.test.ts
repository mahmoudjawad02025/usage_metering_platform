import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { consumeUnits } from '../../src/modules/usage/usage.service';
import { closeDatabase, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestPlan,
  createTestUser,
  type TestAccount,
  type TestUser,
} from '../helpers/factories';
import { api, consume, newRequestId } from '../helpers/test_app';

let account: TestAccount;
let alice: TestUser;
let bob: TestUser;

beforeEach(async () => {
  await resetDatabase();
  account = await createTestAccount();
  alice = await createTestUser(account.id, { externalId: 'alice' });
  bob = await createTestUser(account.id, { externalId: 'bob', planId: PREDEFINED_PLAN_IDS.PREMIUM });
});

afterAll(closeDatabase);

describe('GET /usage', () => {
  it('shows zero usage and the full allowance for a fresh account', async () => {
    const res = await api().get('/usage').set('x-api-key', account.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.period).toMatch(/^\d{4}-\d{2}$/);
    expect(res.body.account).toMatchObject({
      consumed: 0,
      remaining: 10000,
      plan: { name: 'Starter' },
    });
    expect(res.body.users.total).toBe(2);
    expect(res.body.users.items.map((user: { consumed: number }) => user.consumed)).toEqual([0, 0]);
  });

  it('shows consumed and remaining units for the account and for each user', async () => {
    await consume(account.apiKey, { userId: alice.id, units: 10 });
    await consume(account.apiKey, { userId: alice.id, units: 20 });
    await consume(account.apiKey, { userId: bob.id, units: 100 });
    await consume(account.apiKey, { userId: alice.id, units: 25 });

    const res = await api().get('/usage').set('x-api-key', account.apiKey);

    expect(res.body.account).toMatchObject({ consumed: 130, remaining: 9870 });
    const [aliceUsage, bobUsage] = res.body.users.items;
    expect(aliceUsage).toMatchObject({
      id: alice.id,
      externalId: 'alice',
      consumed: 30,
      remaining: 970,
      plan: { name: 'Basic', monthlyAllowance: 1000, maxPerRequest: 20 },
    });
    expect(bobUsage).toMatchObject({ externalId: 'bob', consumed: 100, remaining: 9900 });
  });

  it('paginates the users', async () => {
    const res = await api().get('/usage?limit=1&offset=1').set('x-api-key', account.apiKey);

    expect(res.body.users.items).toHaveLength(1);
    expect(res.body.users.items[0].externalId).toBe('bob');
    expect(res.body.users.total).toBe(2);
  });

  it('reports a previous month separately from the current month', async () => {
    await consumeUnits(
      account.id,
      { userId: alice.id, units: 15, requestId: newRequestId() },
      new Date('2025-03-15T12:00:00Z'),
    );
    await consume(account.apiKey, { userId: alice.id, units: 5 });

    const past = await api().get('/usage?period=2025-03').set('x-api-key', account.apiKey);
    const current = await api().get('/usage').set('x-api-key', account.apiKey);

    expect(past.body.period).toBe('2025-03');
    expect(past.body.account.consumed).toBe(15);
    expect(past.body.users.items[0].consumed).toBe(15);
    expect(current.body.account.consumed).toBe(5);
  });

  it('shows the plan that is currently applied', async () => {
    const planId = await createTestPlan(account.id, {
      scope: 'user',
      name: 'Intern',
      monthlyAllowance: 50,
      maxPerRequest: 5,
    });
    await api()
      .put(`/users/${alice.id}/plan`)
      .set('x-api-key', account.apiKey)
      .send({ planId });

    const res = await api().get('/usage').set('x-api-key', account.apiKey);

    expect(res.body.users.items[0]).toMatchObject({
      externalId: 'alice',
      remaining: 50,
      plan: { name: 'Intern', monthlyAllowance: 50 },
    });
  });

  it('does not include users or usage of other accounts', async () => {
    const other = await createTestAccount();
    const stranger = await createTestUser(other.id);
    await consume(other.apiKey, { userId: stranger.id, units: 10 });

    const res = await api().get('/usage').set('x-api-key', account.apiKey);

    expect(res.body.account.consumed).toBe(0);
    expect(res.body.users.total).toBe(2);
  });

  it.each(['2026-13', '2026-1', '2026-10-01', 'october'])('rejects period "%s" with 400', async (period) => {
    const res = await api().get(`/usage?period=${period}`).set('x-api-key', account.apiKey);
    expect(res.status).toBe(400);
  });

  it('requires an API key', async () => {
    const res = await api().get('/usage');
    expect(res.status).toBe(401);
  });
});

describe('GET /usage/users/:userId', () => {
  it('returns the usage of one user', async () => {
    await consume(account.apiKey, { userId: alice.id, units: 12 });

    const res = await api().get(`/usage/users/${alice.id}`).set('x-api-key', account.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: alice.id,
      consumed: 12,
      remaining: 988,
      plan: { name: 'Basic' },
    });
  });

  it('supports the period parameter', async () => {
    await consumeUnits(
      account.id,
      { userId: alice.id, units: 8, requestId: newRequestId() },
      new Date('2025-03-01T00:00:00Z'),
    );

    const res = await api()
      .get(`/usage/users/${alice.id}?period=2025-03`)
      .set('x-api-key', account.apiKey);

    expect(res.body).toMatchObject({ period: '2025-03', user: { consumed: 8 } });
  });

  it('returns 404 for a user of another account and 400 for a malformed id', async () => {
    const other = await createTestAccount();
    const stranger = await createTestUser(other.id);

    const foreign = await api().get(`/usage/users/${stranger.id}`).set('x-api-key', account.apiKey);
    const malformed = await api().get('/usage/users/42').set('x-api-key', account.apiKey);

    expect(foreign.status).toBe(404);
    expect(malformed.status).toBe(400);
  });
});