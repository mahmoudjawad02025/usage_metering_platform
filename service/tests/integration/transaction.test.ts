import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { generateApiKey, hashApiKey } from '../../src/core/utils/api_key';
import { pool } from '../../src/db/pool';
import { withTransaction } from '../../src/db/transaction';
import * as usageRepository from '../../src/modules/usage/usage.repository';
import { closeDatabase, readConsumed, resetDatabase } from '../helpers/database';
import { createTestAccount, createTestUser } from '../helpers/factories';
import { consume } from '../helpers/test_app';

beforeEach(resetDatabase);
afterEach(() => vi.restoreAllMocks());
afterAll(closeDatabase);

async function countAccounts(): Promise<number> {
  const { rows } = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM accounts');
  return rows[0]?.total ?? 0;
}

function insertAccountIn(client: { query: typeof pool.query }, name: string) {
  return client.query('INSERT INTO accounts (name, api_key_hash, plan_id) VALUES ($1, $2, $3)', [
    name,
    hashApiKey(generateApiKey()),
    PREDEFINED_PLAN_IDS.STARTER,
  ]);
}

describe('withTransaction', () => {
  it('commits the work and returns the value of the callback', async () => {
    const result = await withTransaction(async (client) => {
      await insertAccountIn(client, 'committed');
      return 'done';
    });

    expect(result).toBe('done');
    expect(await countAccounts()).toBe(1);
  });

  it('rolls everything back and rethrows the original error', async () => {
    await expect(
      withTransaction(async (client) => {
        await insertAccountIn(client, 'rolled back');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await countAccounts()).toBe(0);
  });

  it('runs every statement on one connection and hides uncommitted rows from others', async () => {
    await withTransaction(async (client) => {
      const first = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      await insertAccountIn(client, 'invisible for now');
      const second = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');

      expect(first.rows[0]?.pid).toBe(second.rows[0]?.pid);
      expect(await countAccounts()).toBe(0);
    });

    expect(await countAccounts()).toBe(1);
  });

  it('recovers from an SQL error and leaves the connection usable', async () => {
    await expect(
      withTransaction(async (client) => {
        await insertAccountIn(client, 'before the error');
        await client.query('SELECT * FROM table_that_does_not_exist');
      }),
    ).rejects.toThrow(/table_that_does_not_exist/);

    expect(await countAccounts()).toBe(0);
    const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    expect(rows[0]?.ok).toBe(1);
  });

  it('gives every connection back to the pool after success and after failure', async () => {
    for (let round = 0; round < 25; round += 1) {
      await withTransaction(async (client) => {
        await client.query('SELECT 1');
      });
      await withTransaction(async () => {
        throw new Error('expected failure');
      }).catch(() => undefined);
    }

    expect(pool.waitingCount).toBe(0);
    expect(pool.idleCount).toBe(pool.totalCount);
    const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    expect(rows[0]?.ok).toBe(1);
  });
});

describe('consume is all or nothing', () => {
  it('leaves no counter and no log row behind when the last step fails, and a retry succeeds', async () => {
    const account = await createTestAccount();
    const user = await createTestUser(account.id);
    const body = { userId: user.id, units: 10, requestId: 'will-fail-once' };
    vi.spyOn(usageRepository, 'insertRequest').mockRejectedValueOnce(new Error('disk is full'));

    const failed = await consume(account.apiKey, body);

    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(failed.body)).not.toContain('disk is full');
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 0, user: 0 });
    const logged = await pool.query('SELECT 1 FROM usage_requests WHERE account_id = $1', [account.id]);
    expect(logged.rowCount).toBe(0);

    const retry = await consume(account.apiKey, body);

    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ accepted: true, replayed: false });
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 10, user: 10 });
  });
});