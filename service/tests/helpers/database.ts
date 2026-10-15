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