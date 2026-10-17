import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { hashApiKey } from '../../src/core/utils/api_key';
import { pool } from '../../src/db/pool';
import { closeDatabase, resetDatabase } from '../helpers/database';
import { createTestAccount, createTestPlan } from '../helpers/factories';
import { adminKey, api } from '../helpers/test_app';

beforeEach(resetDatabase);
afterAll(closeDatabase);

describe('POST /accounts', () => {
  it('requires the admin key', async () => {
    const missing = await api().post('/accounts').send({ name: 'Acme' });
    const wrong = await api().post('/accounts').set('x-admin-key', 'wrong').send({ name: 'Acme' });
    const existing = await createTestAccount();
    const withApiKey = await api()
      .post('/accounts')
      .set('x-api-key', existing.apiKey)
      .send({ name: 'Acme' });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(withApiKey.status).toBe(401);
  });

  it('creates an account on the Starter plan and returns the API key once', async () => {
    const res = await api().post('/accounts').set('x-admin-key', adminKey()).send({ name: 'Acme' });

    expect(res.status).toBe(201);
    expect(res.body.apiKey).toMatch(/^umk_/);
    expect(res.body.account).toMatchObject({ name: 'Acme', plan: { name: 'Starter', scope: 'account' } });
    expect(JSON.stringify(res.body)).not.toContain('apiKeyHash');
  });

  it('stores only the hash of the key', async () => {
    const res = await api().post('/accounts').set('x-admin-key', adminKey()).send({ name: 'Acme' });

    const { rows } = await pool.query<{ api_key_hash: string }>(
      'SELECT api_key_hash FROM accounts WHERE id = $1',
      [res.body.account.id],
    );
    expect(rows[0]?.api_key_hash).toBe(hashApiKey(res.body.apiKey));
    expect(rows[0]?.api_key_hash).not.toBe(res.body.apiKey);
  });

  it('issues a key that authenticates the new account', async () => {
    const created = await api().post('/accounts').set('x-admin-key', adminKey()).send({ name: 'Acme' });

    const me = await api().get('/accounts/me').set('x-api-key', created.body.apiKey);

    expect(me.status).toBe(200);
    expect(me.body.id).toBe(created.body.account.id);
  });

  it('accepts another predefined account plan', async () => {
    const res = await api()
      .post('/accounts')
      .set('x-admin-key', adminKey())
      .send({ name: 'Big Co', planId: PREDEFINED_PLAN_IDS.PRO });

    expect(res.status).toBe(201);
    expect(res.body.account.plan.name).toBe('Pro');
  });

  it('rejects a user plan with 400 and an unknown plan with 404', async () => {
    const userPlan = await api()
      .post('/accounts')
      .set('x-admin-key', adminKey())
      .send({ name: 'Acme', planId: PREDEFINED_PLAN_IDS.BASIC });
    const unknown = await api()
      .post('/accounts')
      .set('x-admin-key', adminKey())
      .send({ name: 'Acme', planId: 'c0000000-0000-4000-8000-000000000999' });

    expect(userPlan.status).toBe(400);
    expect(userPlan.body.error.code).toBe('PLAN_SCOPE_MISMATCH');
    expect(unknown.status).toBe(404);
  });

  it('cannot start on a custom plan owned by another account', async () => {
    const owner = await createTestAccount();
    const customPlanId = await createTestPlan(owner.id, {
      scope: 'account',
      monthlyAllowance: 10,
      maxPerRequest: 5,
    });

    const res = await api()
      .post('/accounts')
      .set('x-admin-key', adminKey())
      .send({ name: 'Acme', planId: customPlanId });

    expect(res.status).toBe(404);
  });

  it.each([
    ['empty name', { name: '  ' }],
    ['missing name', {}],
    ['unexpected field', { name: 'Acme', apiKey: 'umk_mine' }],
    ['malformed plan id', { name: 'Acme', planId: 'starter' }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await api().post('/accounts').set('x-admin-key', adminKey()).send(body);
    expect(res.status).toBe(400);
  });
});

describe('GET /accounts/me', () => {
  it('returns the authenticated account with its current plan', async () => {
    const account = await createTestAccount({ name: 'Acme' });

    const res = await api().get('/accounts/me').set('x-api-key', account.apiKey);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: account.id,
      name: 'Acme',
      plan: { id: PREDEFINED_PLAN_IDS.STARTER, monthlyAllowance: 10000, maxPerRequest: 100 },
    });
  });

  it('requires an API key', async () => {
    const res = await api().get('/accounts/me');
    expect(res.status).toBe(401);
  });
});