import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestUser,
  type TestAccount,
  type TestUser,
} from '../helpers/factories';
import { api, consume } from '../helpers/test_app';

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