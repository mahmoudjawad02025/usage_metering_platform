import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { closeDatabase, resetDatabase } from '../helpers/database';
import { createTestAccount, createTestPlan, type TestAccount } from '../helpers/factories';
import { api } from '../helpers/test_app';

let accountA: TestAccount;
let accountB: TestAccount;

beforeEach(async () => {
  await resetDatabase();
  accountA = await createTestAccount({ name: 'A' });
  accountB = await createTestAccount({ name: 'B' });
});

afterAll(closeDatabase);

describe('GET /plans', () => {
  it('lists the four predefined plans for a new account', async () => {
    const res = await api().get('/plans').set('x-api-key', accountA.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    const names = res.body.items.map((plan: { name: string }) => plan.name);
    expect(names).toEqual(['Basic', 'Premium', 'Pro', 'Starter']);
    expect(res.body.items.every((plan: { isPredefined: boolean }) => plan.isPredefined)).toBe(true);
  });

  it('includes own custom plans and hides plans of other accounts', async () => {
    await createTestPlan(accountA.id, { scope: 'user', name: 'A custom', monthlyAllowance: 5, maxPerRequest: 1 });
    await createTestPlan(accountB.id, { scope: 'user', name: 'B custom', monthlyAllowance: 5, maxPerRequest: 1 });

    const res = await api().get('/plans').set('x-api-key', accountA.apiKey);

    const names = res.body.items.map((plan: { name: string }) => plan.name);
    expect(names).toContain('A custom');
    expect(names).not.toContain('B custom');
    expect(res.body.total).toBe(5);
  });

  it('filters by scope', async () => {
    const res = await api().get('/plans?scope=account').set('x-api-key', accountA.apiKey);

    expect(res.body.total).toBe(2);
    expect(res.body.items.every((plan: { scope: string }) => plan.scope === 'account')).toBe(true);
  });

  it('paginates with limit and offset', async () => {
    const res = await api().get('/plans?limit=2&offset=3').set('x-api-key', accountA.apiKey);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(4);
    expect(res.body.limit).toBe(2);
    expect(res.body.offset).toBe(3);
  });

  it('rejects an unknown scope with 400', async () => {
    const res = await api().get('/plans?scope=team').set('x-api-key', accountA.apiKey);
    expect(res.status).toBe(400);
  });
});

describe('GET /plans/:id', () => {
  it('returns a predefined plan with its limits', async () => {
    const res = await api().get(`/plans/${PREDEFINED_PLAN_IDS.STARTER}`).set('x-api-key', accountA.apiKey);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Starter',
      scope: 'account',
      monthlyAllowance: 10000,
      maxPerRequest: 100,
      isPredefined: true,
    });
  });

  it('returns an own custom plan', async () => {
    const planId = await createTestPlan(accountA.id, { scope: 'user', monthlyAllowance: 7, maxPerRequest: 3 });

    const res = await api().get(`/plans/${planId}`).set('x-api-key', accountA.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.isPredefined).toBe(false);
  });

  it('returns 404 for a plan owned by another account', async () => {
    const planId = await createTestPlan(accountB.id, { scope: 'user', monthlyAllowance: 7, maxPerRequest: 3 });

    const res = await api().get(`/plans/${planId}`).set('x-api-key', accountA.apiKey);

    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown id and 400 for a malformed id', async () => {
    const missing = await api()
      .get('/plans/c0000000-0000-4000-8000-000000000999')
      .set('x-api-key', accountA.apiKey);
    expect(missing.status).toBe(404);

    const malformed = await api().get('/plans/not-a-uuid').set('x-api-key', accountA.apiKey);
    expect(malformed.status).toBe(400);
  });

  it('requires an API key', async () => {
    const res = await api().get('/plans');
    expect(res.status).toBe(401);
  });
});

describe('POST /plans', () => {
  const validBody = { scope: 'user', name: 'Team', monthlyAllowance: 500, maxPerRequest: 25 };

  it('creates a custom plan and returns it with status 201', async () => {
    const res = await api().post('/plans').set('x-api-key', accountA.apiKey).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...validBody, isPredefined: false });

    const listed = await api().get(`/plans/${res.body.id}`).set('x-api-key', accountA.apiKey);
    expect(listed.status).toBe(200);
  });

  it('trims the plan name', async () => {
    const res = await api()
      .post('/plans')
      .set('x-api-key', accountA.apiKey)
      .send({ ...validBody, name: '  Padded  ' });

    expect(res.body.name).toBe('Padded');
  });

  it('rejects a duplicate name in the same scope with 409', async () => {
    await api().post('/plans').set('x-api-key', accountA.apiKey).send(validBody);
    const res = await api().post('/plans').set('x-api-key', accountA.apiKey).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('allows the same name in another scope or in another account', async () => {
    await api().post('/plans').set('x-api-key', accountA.apiKey).send(validBody);

    const otherScope = await api()
      .post('/plans')
      .set('x-api-key', accountA.apiKey)
      .send({ ...validBody, scope: 'account' });
    const otherAccount = await api().post('/plans').set('x-api-key', accountB.apiKey).send(validBody);

    expect(otherScope.status).toBe(201);
    expect(otherAccount.status).toBe(201);
  });

  it.each([
    ['negative allowance', { monthlyAllowance: -1 }],
    ['decimal allowance', { monthlyAllowance: 1.5 }],
    ['allowance above the maximum', { monthlyAllowance: 1_000_000_001 }],
    ['zero per-request limit', { maxPerRequest: 0 }],
    ['unknown scope', { scope: 'team' }],
    ['empty name', { name: '   ' }],
    ['unexpected field', { isPredefined: true }],
  ])('rejects %s with 400', async (_label, override) => {
    const res = await api()
      .post('/plans')
      .set('x-api-key', accountA.apiKey)
      .send({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /plans/:id', () => {
  async function createOwnedPlan(): Promise<string> {
    return createTestPlan(accountA.id, {
      scope: 'user',
      name: 'Editable',
      monthlyAllowance: 100,
      maxPerRequest: 10,
    });
  }

  it('updates only the provided fields', async () => {
    const planId = await createOwnedPlan();

    const res = await api()
      .patch(`/plans/${planId}`)
      .set('x-api-key', accountA.apiKey)
      .send({ monthlyAllowance: 250 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Editable', monthlyAllowance: 250, maxPerRequest: 10 });
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(res.body.createdAt).getTime(),
    );
  });

  it('refuses to edit a predefined plan with 403', async () => {
    const res = await api()
      .patch(`/plans/${PREDEFINED_PLAN_IDS.BASIC}`)
      .set('x-api-key', accountA.apiKey)
      .send({ monthlyAllowance: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_READ_ONLY');
  });

  it('returns 404 when the plan belongs to another account', async () => {
    const planId = await createOwnedPlan();

    const res = await api()
      .patch(`/plans/${planId}`)
      .set('x-api-key', accountB.apiKey)
      .send({ monthlyAllowance: 1 });

    expect(res.status).toBe(404);
  });

  it('cannot change the scope and needs at least one field', async () => {
    const planId = await createOwnedPlan();

    const scopeChange = await api()
      .patch(`/plans/${planId}`)
      .set('x-api-key', accountA.apiKey)
      .send({ scope: 'account' });
    const empty = await api().patch(`/plans/${planId}`).set('x-api-key', accountA.apiKey).send({});

    expect(scopeChange.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  it('rejects renaming into an existing name with 409', async () => {
    const planId = await createOwnedPlan();
    await createTestPlan(accountA.id, { scope: 'user', name: 'Taken', monthlyAllowance: 1, maxPerRequest: 1 });

    const res = await api()
      .patch(`/plans/${planId}`)
      .set('x-api-key', accountA.apiKey)
      .send({ name: 'Taken' });

    expect(res.status).toBe(409);
  });
});