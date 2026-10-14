import { pool } from '../../db/pool';
import type { AuthenticatedAccount } from './accounts.types';

interface AccountAuthRow {
  id: string;
  name: string;
  plan_id: string;
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