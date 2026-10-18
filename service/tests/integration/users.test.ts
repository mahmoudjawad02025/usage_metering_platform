import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { closeDatabase, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestPlan,
  createTestUser,
  type TestAccount,
} from '../helpers/factories';
import { api } from '../helpers/test_app';

let accountA: TestAccount;
let accountB: TestAccount;

beforeEach(async () => {
  await resetDatabase();
  accountA = await createTestAccount({ name: 'A' });
  accountB = await createTestAccount({ name: 'B' });
});

afterAll(closeDatabase);

describe('POST /users', () => {
  it('registers a user on the Basic plan by default', async () => {
    const res = await api()
      .post('/users')
      .set('x-api-key', accountA.apiKey)
      .send({ externalId: 'alice' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      externalId: 'alice',
      plan: { name: 'Basic', scope: 'user', monthlyAllowance: 1000, maxPerRequest: 20 },
    });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it('registers a user on a chosen predefined or custom plan', async () => {
    const customPlanId = await createTestPlan(accountA.id, {
      scope: 'user',
      name: 'Intern',
      monthlyAllowance: 50,
      maxPerRequest: 5,
    });

    const premium = await api()
      .post('/users')
      .set('x-api-key', accountA.apiKey)
      .send({ externalId: 'bob', planId: PREDEFINED_PLAN_IDS.PREMIUM });
    const custom = await api()
      .post('/users')
      .set('x-api-key', accountA.apiKey)
      .send({ externalId: 'carol', planId: customPlanId });

    expect(premium.body.plan.name).toBe('Premium');
    expect(custom.body.plan.name).toBe('Intern');
  });

  it('trims the external id', async () => {
    const res = await api()
      .post('/users')
      .set('x-api-key', accountA.apiKey)
      .send({ externalId: '  dave  ' });

    expect(res.body.externalId).toBe('dave');
  });

  it('rejects a duplicate external id in the same account with 409', async () => {
    await createTestUser(accountA.id, { externalId: 'alice' });

    const res = await api()
      .post('/users')
      .set('x-api-key', accountA.apiKey)
      .send({ externalId: 'alice' });

    expect(res.status).toBe(409);
  });

  it('allows the same external id in different accounts', async () => {
    await createTestUser(accountA.id, { externalId: 'alice' });

    const res = await api()
      .post('/users')
      .set('x-api-key', accountB.apiKey)
      .send({ externalId: 'alice' });

    expect(res.status).toBe(201);
  });

  it('rejects an account plan with 400', async () => {
    const res = await api()
      .post('/users')
      .set('x-api-key', accountA.apiKey)
      .send({ externalId: 'alice', planId: PREDEFINED_PLAN_IDS.STARTER });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLAN_SCOPE_MISMATCH');
  });

  it('returns 404 for a custom plan owned by another account', async () => {
    const planId = await createTestPlan(accountB.id, {
      scope: 'user',
      monthlyAllowance: 5,
      maxPerRequest: 1,
    });

    const res = await api()
      .post('/users')
      .set('x-api-key', accountA.apiKey)
      .send({ externalId: 'alice', planId });

    expect(res.status).toBe(404);
  });

  it.each([
    ['missing external id', {}],
    ['blank external id', { externalId: '   ' }],
    ['external id longer than 255 characters', { externalId: 'x'.repeat(256) }],
    ['unexpected field', { externalId: 'alice', accountId: 'someone-else' }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await api().post('/users').set('x-api-key', accountA.apiKey).send(body);
    expect(res.status).toBe(400);
  });
});

describe('GET /users', () => {
  it('lists only the users of the authenticated account', async () => {
    await createTestUser(accountA.id, { externalId: 'alice' });
    await createTestUser(accountA.id, { externalId: 'bob' });
    await createTestUser(accountB.id, { externalId: 'mallory' });

    const res = await api().get('/users').set('x-api-key', accountA.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const ids = res.body.items.map((user: { externalId: string }) => user.externalId);
    expect(ids).toEqual(['alice', 'bob']);
  });

  it('paginates with limit and offset', async () => {
    for (const externalId of ['u1', 'u2', 'u3']) {
      await createTestUser(accountA.id, { externalId });
    }

    const res = await api().get('/users?limit=2&offset=2').set('x-api-key', accountA.apiKey);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].externalId).toBe('u3');
    expect(res.body.total).toBe(3);
  });
});

describe('GET /users/:id', () => {
  it('returns a user with the plan currently applied', async () => {
    const user = await createTestUser(accountA.id, { externalId: 'alice' });

    const res = await api().get(`/users/${user.id}`).set('x-api-key', accountA.apiKey);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, externalId: 'alice', plan: { name: 'Basic' } });
  });

  it('returns 404 for a user of another account', async () => {
    const foreign = await createTestUser(accountB.id);

    const res = await api().get(`/users/${foreign.id}`).set('x-api-key', accountA.apiKey);

    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id and 404 for an unknown id', async () => {
    const malformed = await api().get('/users/42').set('x-api-key', accountA.apiKey);
    const unknown = await api()
      .get('/users/c0000000-0000-4000-8000-000000000999')
      .set('x-api-key', accountA.apiKey);

    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(404);
  });

  it('requires an API key', async () => {
    const res = await api().get('/users');
    expect(res.status).toBe(401);
  });
});