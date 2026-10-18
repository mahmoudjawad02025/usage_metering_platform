import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runMigrations } from '../../src/db/migrate';
import { pool } from '../../src/db/pool';

const SEED_FILE = path.join(__dirname, '../../src/db/migrations/003_seed_predefined_plans.sql');

export async function resetDatabase(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>('SELECT current_database() AS name');
  const databaseName = rows[0]?.name ?? '';
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to reset "${databaseName}": it is not a test database`);
  }

  await runMigrations();
  await pool.query('TRUNCATE usage_requests, user_usage, account_usage, users, accounts, plans');
  await pool.query(await readFile(SEED_FILE, 'utf8'));
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export async function readConsumed(
  accountId: string,
  userId: string,
): Promise<{ account: number; user: number }> {
  const account = await pool.query<{ total: number }>(
    'SELECT COALESCE(SUM(consumed), 0)::int AS total FROM account_usage WHERE account_id = $1',
    [accountId],
  );
  const user = await pool.query<{ total: number }>(
    'SELECT COALESCE(SUM(consumed), 0)::int AS total FROM user_usage WHERE user_id = $1',
    [userId],
  );
  return { account: account.rows[0]?.total ?? 0, user: user.rows[0]?.total ?? 0 };
}