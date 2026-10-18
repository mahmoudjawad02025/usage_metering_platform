import { pool } from '../../db/pool';
import { JOINED_PLAN_COLUMNS, toPlanFromJoin, type JoinedPlanRow } from '../plans/plans.repository';
import type { ListUsersQuery } from './users.schemas';
import type { User } from './users.types';

interface UserRow extends JoinedPlanRow {
  id: string;
  external_id: string;
  created_at: Date;
}

const USER_SELECT = `
  SELECT u.id, u.external_id, u.created_at, ${JOINED_PLAN_COLUMNS}
  FROM users u
  JOIN plans p ON p.id = u.plan_id`;

function toUser(row: UserRow): User {
  return {
    id: row.id,
    externalId: row.external_id,
    plan: toPlanFromJoin(row),
    createdAt: row.created_at,
  };
}

export async function insertUser(
  accountId: string,
  externalId: string,
  planId: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO users (account_id, external_id, plan_id) VALUES ($1, $2, $3) RETURNING id',
    [accountId, externalId, planId],
  );
  const row = rows[0];
  if (!row) throw new Error('User insert returned no row');
  return row.id;
}

export async function findUserById(accountId: string, userId: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    `${USER_SELECT} WHERE u.account_id = $1 AND u.id = $2`,
    [accountId, userId],
  );
  const row = rows[0];
  return row ? toUser(row) : null;
}

export async function listUsers(
  accountId: string,
  query: ListUsersQuery,
): Promise<{ items: User[]; total: number }> {
  const { rows } = await pool.query<UserRow>(
    `${USER_SELECT} WHERE u.account_id = $1 ORDER BY u.created_at ASC, u.id ASC LIMIT $2 OFFSET $3`,
    [accountId, query.limit, query.offset],
  );

  const count = await pool.query<{ total: number }>(
    'SELECT COUNT(*) AS total FROM users WHERE account_id = $1',
    [accountId],
  );

  return { items: rows.map(toUser), total: count.rows[0]?.total ?? 0 };
}