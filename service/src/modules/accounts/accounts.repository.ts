import { pool } from '../../db/pool';
import { JOINED_PLAN_COLUMNS, toPlanFromJoin, type JoinedPlanRow } from '../plans/plans.repository';
import type { Account, AuthenticatedAccount } from './accounts.types';

interface AccountAuthRow {
  id: string;
  name: string;
  plan_id: string;
}

interface AccountRow extends JoinedPlanRow {
  id: string;
  name: string;
  created_at: Date;
}

export async function findAccountByApiKeyHash(
  apiKeyHash: string,
): Promise<AuthenticatedAccount | null> {
  const { rows } = await pool.query<AccountAuthRow>(
    'SELECT id, name, plan_id FROM accounts WHERE api_key_hash = $1',
    [apiKeyHash],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, planId: row.plan_id };
}

export async function insertAccount(
  name: string,
  apiKeyHash: string,
  planId: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO accounts (name, api_key_hash, plan_id) VALUES ($1, $2, $3) RETURNING id',
    [name, apiKeyHash, planId],
  );
  const row = rows[0];
  if (!row) throw new Error('Account insert returned no row');
  return row.id;
}

export async function findAccountById(accountId: string): Promise<Account | null> {
  const { rows } = await pool.query<AccountRow>(
    `SELECT a.id, a.name, a.created_at, ${JOINED_PLAN_COLUMNS}
     FROM accounts a
     JOIN plans p ON p.id = a.plan_id
     WHERE a.id = $1`,
    [accountId],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, plan: toPlanFromJoin(row), createdAt: row.created_at };
}

export async function updateAccountPlan(accountId: string, planId: string): Promise<void> {
  await pool.query('UPDATE accounts SET plan_id = $2 WHERE id = $1', [accountId, planId]);
}