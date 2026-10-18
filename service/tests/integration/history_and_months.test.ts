import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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
  bob = await createTestUser(account.id, { externalId: 'bob' });
});

afterAll(closeDatabase);

async function seedRequests(): Promise<void> {
  await consume(account.apiKey, { userId: alice.id, units: 10, requestId: 'r1' });
  await consume(account.apiKey, { userId: alice.id, units: 25, requestId: 'r2' });
  await consume(account.apiKey, { userId: bob.id, units: 5, requestId: 'r3' });
}

describe('GET /usage/history', () => {
  it('lists accepted and rejected requests, newest first', async () => {
    await seedRequests();

    const res = await api().get('/usage/history').set('x-api-key', account.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((item: { requestId: string }) => item.requestId)).toEqual(['r3', 'r2', 'r1']);
  });

  it('explains each outcome and keeps the limits that were applied', async () => {
    await seedRequests();

    const res = await api().get('/usage/history').set('x-api-key', account.apiKey);

    const rejected = res.body.items.find((item: { requestId: string }) => item.requestId === 'r2');
    expect(rejected).toMatchObject({
      accepted: false,
      userId: alice.id,
      units: 25,
      rejection: { rule: 'max_per_request', level: 'user', limit: 20 },
      appliedLimits: {
        user: { planName: 'Basic', maxPerRequest: 20, consumedBefore: 10 },
        account: { planName: 'Starter', consumedBefore: 10 },
      },
    });
    const accepted = res.body.items.find((item: { requestId: string }) => item.requestId === 'r1');
    expect(accepted).toMatchObject({ accepted: true, rejection: null });
  });

  it('paginates with limit and offset', async () => {
    await seedRequests();

    const res = await api().get('/usage/history?limit=2&offset=1').set('x-api-key', account.apiKey);

    expect(res.body.items.map((item: { requestId: string }) => item.requestId)).toEqual(['r2', 'r1']);
    expect(res.body).toMatchObject({ total: 3, limit: 2, offset: 1 });
  });

  it('filters by user, by outcome and by month', async () => {
    await seedRequests();

    const byUser = await api().get(`/usage/history?userId=${bob.id}`).set('x-api-key', account.apiKey);
    const rejectedOnly = await api().get('/usage/history?accepted=false').set('x-api-key', account.apiKey);
    const acceptedOnly = await api().get('/usage/history?accepted=true').set('x-api-key', account.apiKey);
    const otherMonth = await api().get('/usage/history?period=2025-03').set('x-api-key', account.apiKey);

    expect(byUser.body.total).toBe(1);
    expect(rejectedOnly.body.items.map((item: { requestId: string }) => item.requestId)).toEqual(['r2']);
    expect(acceptedOnly.body.total).toBe(2);
    expect(otherMonth.body.total).toBe(0);
  });

  it('never shows the requests of another account', async () => {
    await seedRequests();
    const other = await createTestAccount();
    const stranger = await createTestUser(other.id);
    await consume(other.apiKey, { userId: stranger.id, units: 5, requestId: 'foreign' });

    const mine = await api().get('/usage/history').set('x-api-key', account.apiKey);
    const filteredByForeignUser = await api()
      .get(`/usage/history?userId=${stranger.id}`)
      .set('x-api-key', account.apiKey);

    expect(JSON.stringify(mine.body)).not.toContain('foreign');
    expect(filteredByForeignUser.body.total).toBe(0);
  });

  it.each([
    'accepted=maybe',
    'userId=alice',
    'period=2026-13',
    'limit=0',
    'limit=101',
    'offset=-1',
  ])('rejects the query "%s" with 400', async (queryString) => {
    const res = await api().get(`/usage/history?${queryString}`).set('x-api-key', account.apiKey);
    expect(res.status).toBe(400);
  });

  it('requires an API key', async () => {
    const res = await api().get('/usage/history');
    expect(res.status).toBe(401);
  });
});

describe('UTC calendar months', () => {
  const lastSecondOfSeptember = new Date('2026-09-30T23:59:59.999Z');
  const firstSecondOfOctober = new Date('2026-10-01T00:00:00.000Z');

  function consumeAt(userId: string, units: number, when: Date) {
    return consumeUnits(account.id, { userId, units, requestId: newRequestId() }, when);
  }

  function usageFor(month: string) {
    return api().get(`/usage?period=${month}`).set('x-api-key', account.apiKey);
  }

  it('starts every new month at zero for the user and the account and keeps the old month', async () => {
    await consumeAt(alice.id, 20, lastSecondOfSeptember);
    const october = await consumeAt(alice.id, 20, firstSecondOfOctober);

    expect(october.period).toBe('2026-10');
    expect(october.account.consumed).toBe(20);
    expect(october.user.consumed).toBe(20);

    const septemberUsage = await usageFor('2026-09');
    const octoberUsage = await usageFor('2026-10');
    expect(septemberUsage.body.account.consumed).toBe(20);
    expect(septemberUsage.body.users.items[0].consumed).toBe(20);
    expect(octoberUsage.body.account.consumed).toBe(20);
    expect(octoberUsage.body.users.items[0].consumed).toBe(20);
  });

  it('gives the allowance back in the next month', async () => {
    const planId = await createTestPlan(account.id, { scope: 'user', monthlyAllowance: 20, maxPerRequest: 20 });
    const user = await createTestUser(account.id, { planId });

    await consumeAt(user.id, 20, new Date('2026-09-15T10:00:00Z'));
    const stillSeptember = await consumeAt(user.id, 1, new Date('2026-09-16T10:00:00Z'));
    const nextMonth = await consumeAt(user.id, 20, firstSecondOfOctober);

    expect(stillSeptember.accepted).toBe(false);
    expect(nextMonth.accepted).toBe(true);
    expect(nextMonth.user.remaining).toBe(0);
  });

  it('switches month exactly at UTC midnight', async () => {
    const before = await consumeAt(alice.id, 1, lastSecondOfSeptember);
    const after = await consumeAt(alice.id, 1, firstSecondOfOctober);

    expect(before.period).toBe('2026-09');
    expect(after.period).toBe('2026-10');
  });

  it('switches year correctly', async () => {
    const december = await consumeAt(alice.id, 1, new Date('2026-12-31T23:59:59Z'));
    const january = await consumeAt(alice.id, 1, new Date('2027-01-01T00:00:00Z'));

    expect([december.period, january.period]).toEqual(['2026-12', '2027-01']);
  });

  it('filters the history by month', async () => {
    await consumeAt(alice.id, 5, lastSecondOfSeptember);
    await consumeAt(alice.id, 6, firstSecondOfOctober);

    const september = await api().get('/usage/history?period=2026-09').set('x-api-key', account.apiKey);
    const october = await api().get('/usage/history?period=2026-10').set('x-api-key', account.apiKey);

    expect(september.body.items.map((item: { units: number }) => item.units)).toEqual([5]);
    expect(october.body.items.map((item: { units: number }) => item.units)).toEqual([6]);
  });
});