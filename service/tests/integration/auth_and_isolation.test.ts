import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { generateApiKey } from '../../src/core/utils/api_key';
import { closeDatabase, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestPlan,
  createTestUser,
  type TestAccount,
} from '../helpers/factories';
import { api } from '../helpers/test_app';

type Method = 'get' | 'post' | 'put' | 'patch';

const SOME_ID = 'c0000000-0000-4000-8000-000000000999';

const protectedRoutes: Array<[Method, string]> = [
  ['get', '/accounts/me'],
  ['put', '/accounts/me/plan'],
  ['get', '/plans'],
  ['post', '/plans'],
  ['get', `/plans/${SOME_ID}`],
  ['patch', `/plans/${SOME_ID}`],
  ['get', '/users'],
  ['post', '/users'],
  ['get', `/users/${SOME_ID}`],
  ['put', `/users/${SOME_ID}/plan`],
];

let accountA: TestAccount;
let accountB: TestAccount;

beforeEach(async () => {
  await resetDatabase();
  accountA = await createTestAccount({ name: 'A' });
  accountB = await createTestAccount({ name: 'B' });
});

afterAll(closeDatabase);

describe('API key validation', () => {
  it.each(protectedRoutes)('%s %s rejects a missing key', async (method, path) => {
    const res = await api()[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it.each(protectedRoutes)('%s %s rejects an invalid key', async (method, path) => {
    const malformed = await api()[method](path).set('x-api-key', 'abc').send({});
    const unknown = await api()[method](path).set('x-api-key', generateApiKey()).send({});

    expect(malformed.status).toBe(401);
    expect(unknown.status).toBe(401);
  });

  it('does not accept the key in another header', async () => {
    const res = await api().get('/accounts/me').set('authorization', accountA.apiKey);
    expect(res.status).toBe(401);
  });
});

describe('account isolation', () => {
  it("never shows another account's users, plans or account data", async () => {
    await createTestUser(accountB.id, { externalId: 'bobs-user' });
    await createTestPlan(accountB.id, { scope: 'user', name: 'B only', monthlyAllowance: 1, maxPerRequest: 1 });

    const users = await api().get('/users').set('x-api-key', accountA.apiKey);
    const plans = await api().get('/plans').set('x-api-key', accountA.apiKey);
    const me = await api().get('/accounts/me').set('x-api-key', accountA.apiKey);

    expect(users.body.total).toBe(0);
    expect(JSON.stringify(plans.body)).not.toContain('B only');
    expect(me.body.id).toBe(accountA.id);
  });

  it("cannot read or change another account's user", async () => {
    const foreign = await createTestUser(accountB.id);

    const read = await api().get(`/users/${foreign.id}`).set('x-api-key', accountA.apiKey);
    const change = await api()
      .put(`/users/${foreign.id}/plan`)
      .set('x-api-key', accountA.apiKey)
      .send({ planId: PREDEFINED_PLAN_IDS.PREMIUM });

    expect(read.status).toBe(404);
    expect(change.status).toBe(404);
  });

  it("cannot read or edit another account's custom plan", async () => {
    const planId = await createTestPlan(accountB.id, { scope: 'user', monthlyAllowance: 1, maxPerRequest: 1 });

    const read = await api().get(`/plans/${planId}`).set('x-api-key', accountA.apiKey);
    const edit = await api()
      .patch(`/plans/${planId}`)
      .set('x-api-key', accountA.apiKey)
      .send({ monthlyAllowance: 999 });

    expect(read.status).toBe(404);
    expect(edit.status).toBe(404);
  });

  it("cannot assign another account's custom plan to its account or users", async () => {
    const foreignAccountPlan = await createTestPlan(accountB.id, { scope: 'account', monthlyAllowance: 1, maxPerRequest: 1 });
    const foreignUserPlan = await createTestPlan(accountB.id, { scope: 'user', monthlyAllowance: 1, maxPerRequest: 1 });
    const user = await createTestUser(accountA.id);

    const accountChange = await api()
      .put('/accounts/me/plan')
      .set('x-api-key', accountA.apiKey)
      .send({ planId: foreignAccountPlan });
    const userChange = await api()
      .put(`/users/${user.id}/plan`)
      .set('x-api-key', accountA.apiKey)
      .send({ planId: foreignUserPlan });

    expect(accountChange.status).toBe(404);
    expect(userChange.status).toBe(404);
  });

  it('ignores any account id sent by the client', async () => {
    const res = await api()
      .post('/users')
      .set('x-api-key', accountA.apiKey)
      .send({ externalId: 'sneaky', accountId: accountB.id });

    expect(res.status).toBe(400);
    const bUsers = await api().get('/users').set('x-api-key', accountB.apiKey);
    expect(bUsers.body.total).toBe(0);
  });
});