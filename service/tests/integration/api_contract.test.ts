import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { closeDatabase, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestUser,
  type TestAccount,
  type TestUser,
} from '../helpers/factories';
import { adminKey, api, consume } from '../helpers/test_app';

let account: TestAccount;
let user: TestUser;

beforeEach(async () => {
  await resetDatabase();
  account = await createTestAccount({ name: 'Contract Co' });
  user = await createTestUser(account.id, { externalId: 'alice' });
});

afterAll(closeDatabase);

const isoDate = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);
const month = expect.stringMatching(/^\d{4}-\d{2}$/);

const starter = {
  id: PREDEFINED_PLAN_IDS.STARTER,
  name: 'Starter',
  monthlyAllowance: 10000,
  maxPerRequest: 100,
};
const basic = {
  id: PREDEFINED_PLAN_IDS.BASIC,
  name: 'Basic',
  monthlyAllowance: 1000,
  maxPerRequest: 20,
};

describe('error responses', () => {
  const shape = { error: { code: expect.any(String), message: expect.any(String) } };

  it('always use the same JSON shape', async () => {
    const unauthorized = await api().get('/accounts/me');
    const notFound = await api().get('/users/c0000000-0000-4000-8000-000000000999').set('x-api-key', account.apiKey);
    const forbidden = await api()
      .patch(`/plans/${PREDEFINED_PLAN_IDS.BASIC}`)
      .set('x-api-key', account.apiKey)
      .send({ monthlyAllowance: 1 });
    const conflict = await api().post('/users').set('x-api-key', account.apiKey).send({ externalId: 'alice' });

    expect(unauthorized.status).toBe(401);
    expect(notFound.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(conflict.status).toBe(409);
    for (const res of [unauthorized, notFound, forbidden, conflict]) {
      expect(res.body).toEqual(shape);
    }
  });

  it('list every invalid field of a bad request', async () => {
    const res = await api()
      .post('/usage/consume')
      .set('x-api-key', account.apiKey)
      .send({ userId: 'nope', units: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((detail: { field: string }) => detail.field).sort();
    expect(fields).toEqual(['requestId', 'units', 'userId']);
  });
});

describe('consume responses', () => {
  it('have the documented shape for an accepted request', async () => {
    const res = await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'contract-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accepted: true,
      replayed: false,
      requestId: 'contract-1',
      units: 10,
      period: month,
      rejection: null,
      account: { plan: starter, consumed: 10, remaining: 9990 },
      user: { id: user.id, plan: basic, consumed: 10, remaining: 990 },
    });
  });

  it('have the documented shape for a per-request rejection', async () => {
    const res = await consume(account.apiKey, { userId: user.id, units: 25, requestId: 'contract-2' });

    expect(res.body).toEqual({
      accepted: false,
      replayed: false,
      requestId: 'contract-2',
      units: 25,
      period: month,
      rejection: { rule: 'max_per_request', level: 'user', limit: 20 },
      account: { plan: starter, consumed: 0, remaining: 10000 },
      user: { id: user.id, plan: basic, consumed: 0, remaining: 1000 },
    });
  });

  it('have the documented shape for a monthly rejection', async () => {
    for (let index = 0; index < 50; index += 1) {
      await consume(account.apiKey, { userId: user.id, units: 20 });
    }

    const res = await consume(account.apiKey, { userId: user.id, units: 1, requestId: 'contract-3' });

    expect(res.body.rejection).toEqual({
      rule: 'monthly_allowance',
      level: 'user',
      limit: 1000,
      remaining: 0,
    });
  });
});

describe('resource responses', () => {
  it('describe a plan without leaking the owner', async () => {
    const res = await api().get(`/plans/${PREDEFINED_PLAN_IDS.STARTER}`).set('x-api-key', account.apiKey);

    expect(res.body).toEqual({
      id: PREDEFINED_PLAN_IDS.STARTER,
      scope: 'account',
      name: 'Starter',
      monthlyAllowance: 10000,
      maxPerRequest: 100,
      isPredefined: true,
      createdAt: isoDate,
      updatedAt: isoDate,
    });
  });

  it('describe a new account with its key and never with a hash', async () => {
    const res = await api().post('/accounts').set('x-admin-key', adminKey()).send({ name: 'Shape Inc' });

    expect(Object.keys(res.body).sort()).toEqual(['account', 'apiKey']);
    expect(res.body.account).toEqual({
      id: expect.any(String),
      name: 'Shape Inc',
      plan: expect.objectContaining({ name: 'Starter' }),
      createdAt: isoDate,
    });
  });

  it('describe a user with the plan currently applied', async () => {
    const res = await api().get(`/users/${user.id}`).set('x-api-key', account.apiKey);

    expect(res.body).toEqual({
      id: user.id,
      externalId: 'alice',
      plan: expect.objectContaining({ name: 'Basic' }),
      createdAt: isoDate,
    });
  });

  it('describe usage and history entries', async () => {
    await consume(account.apiKey, { userId: user.id, units: 30, requestId: 'shape-1' });

    const usage = await api().get('/usage').set('x-api-key', account.apiKey);
    const history = await api().get('/usage/history').set('x-api-key', account.apiKey);

    expect(usage.body).toEqual({
      period: month,
      account: { plan: starter, consumed: 0, remaining: 10000 },
      users: {
        items: [{ id: user.id, externalId: 'alice', plan: basic, consumed: 0, remaining: 1000 }],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });
    expect(history.body.items[0]).toEqual({
      id: expect.any(String),
      requestId: 'shape-1',
      userId: user.id,
      units: 30,
      period: month,
      accepted: false,
      rejection: { rule: 'max_per_request', level: 'user', limit: 20 },
      appliedLimits: {
        account: expect.objectContaining({ planName: 'Starter', consumedBefore: 0 }),
        user: expect.objectContaining({ planName: 'Basic', consumedBefore: 0 }),
      },
      createdAt: isoDate,
    });
  });
});

describe('predefined plans', () => {
  it('match the limits that the README documents', async () => {
    const res = await api().get('/plans').set('x-api-key', account.apiKey);

    const limits = Object.fromEntries(
      res.body.items.map((plan: { name: string; scope: string; monthlyAllowance: number; maxPerRequest: number }) => [
        plan.name,
        [plan.scope, plan.monthlyAllowance, plan.maxPerRequest],
      ]),
    );
    expect(limits).toEqual({
      Starter: ['account', 10000, 100],
      Pro: ['account', 100000, 1000],
      Basic: ['user', 1000, 20],
      Premium: ['user', 10000, 200],
    });
  });
});