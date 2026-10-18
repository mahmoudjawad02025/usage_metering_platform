import { pool } from '../../db/pool';
import {
  REQUEST_COLUMNS,
  toStoredRequest,
  type RequestRow,
} from '../usage/usage.repository';
import type { StoredRequest } from '../usage/usage.types';
import type { HistoryFilters } from './history.types';

export async function listRequests(
  accountId: string,
  filters: HistoryFilters,
  limit: number,
  offset: number,
): Promise<{ items: StoredRequest[]; total: number }> {
  const conditions = ['account_id = $1'];
  const params: unknown[] = [accountId];

  if (filters.userId !== undefined) {
    params.push(filters.userId);
    conditions.push(`user_id = $${params.length}`);
  }
  if (filters.accepted !== undefined) {
    params.push(filters.accepted);
    conditions.push(`accepted = $${params.length}`);
  }
  if (filters.period !== undefined) {
    params.push(filters.period);
    conditions.push(`period = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const limitPlaceholder = params.length + 1;

  const { rows } = await pool.query<RequestRow>(
    `SELECT ${REQUEST_COLUMNS} FROM usage_requests
     WHERE ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitPlaceholder} OFFSET $${limitPlaceholder + 1}`,
    [...params, limit, offset],
  );

  const count = await pool.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM usage_requests WHERE ${where}`,
    params,
  );

  return { items: rows.map(toStoredRequest), total: count.rows[0]?.total ?? 0 };
}