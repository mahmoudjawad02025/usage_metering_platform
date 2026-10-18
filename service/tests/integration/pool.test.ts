import { afterAll, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/db/pool';

afterAll(async () => {
  vi.resetModules();
  const { pool: freshPool } = await import('../../src/db/pool.js');
  await freshPool.end();
});

describe('how the pool reads values from PostgreSQL', () => {
  it('returns a DATE as plain text, without any timezone shift', async () => {
    const { rows } = await pool.query<{ day: unknown }>("SELECT DATE '2026-10-01' AS day");

    expect(rows[0]?.day).toBe('2026-10-01');
  });

  it('returns a BIGINT such as COUNT(*) as a number', async () => {
    const { rows } = await pool.query<{ total: unknown }>('SELECT COUNT(*) AS total FROM plans');

    expect(typeof rows[0]?.total).toBe('number');
  });

  it('returns TIMESTAMPTZ values as Date objects', async () => {
    const { rows } = await pool.query<{ moment: unknown }>('SELECT now() AS moment');

    expect(rows[0]?.moment).toBeInstanceOf(Date);
  });
});

describe('pool lifecycle', () => {
  it('survives an error on an idle connection instead of crashing the process', () => {
    expect(() => pool.emit('error', new Error('an idle client was terminated'))).not.toThrow();
  });

  it('closePool closes every connection, and the pool refuses new queries afterwards', async () => {
    vi.resetModules();
    const { pool: freshPool, closePool } = await import('../../src/db/pool.js');
    await freshPool.query('SELECT 1');

    await closePool();

    await expect(freshPool.query('SELECT 1')).rejects.toThrow();
  });
});