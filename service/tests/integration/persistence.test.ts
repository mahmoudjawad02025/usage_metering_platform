import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { closeDatabase, resetDatabase } from '../helpers/database';
import { adminKey, api, consume } from '../helpers/test_app';

beforeEach(resetDatabase);

afterAll(async () => {
  vi.resetModules();
  const { pool } = await import('../../src/db/pool.js');
  await pool.end();
});

describe('a restart of the service', () => {
  it('keeps accounts, users, plans, usage and history', async () => {
    const created = await api().post('/accounts').set('x-admin-key', adminKey()).send({ name: 'Survivor' });
    const apiKey: string = created.body.apiKey;
    const plan = await api()
      .post('/plans')
      .set('x-api-key', apiKey)
      .send({ scope: 'user', name: 'Custom', monthlyAllowance: 500, maxPerRequest: 50 });
    const user = await api()
      .post('/users')
      .set('x-api-key', apiKey)
      .send({ externalId: 'alice', planId: plan.body.id });
    await consume(apiKey, { userId: user.body.id, units: 40, requestId: 'before-restart' });

    await closeDatabase();
    vi.resetModules();
    const { createApp } = await import('../../src/app.js');
    const { default: request } = await import('supertest');
    const restarted = request(createApp());

    const account = await restarted.get('/accounts/me').set('x-api-key', apiKey);
    const usage = await restarted.get('/usage').set('x-api-key', apiKey);
    const history = await restarted.get('/usage/history').set('x-api-key', apiKey);
    const retry = await restarted
      .post('/usage/consume')
      .set('x-api-key', apiKey)
      .send({ userId: user.body.id, units: 40, requestId: 'before-restart' });

    expect(account.body).toMatchObject({ name: 'Survivor', plan: { id: PREDEFINED_PLAN_IDS.STARTER } });
    expect(usage.body.account.consumed).toBe(40);
    expect(usage.body.users.items[0]).toMatchObject({
      externalId: 'alice',
      consumed: 40,
      remaining: 460,
      plan: { name: 'Custom' },
    });
    expect(history.body.total).toBe(1);
    expect(retry.body).toMatchObject({ accepted: true, replayed: true });
    expect(retry.body.user.consumed).toBe(40);
  });
});