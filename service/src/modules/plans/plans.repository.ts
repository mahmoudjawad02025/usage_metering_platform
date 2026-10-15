import { pool } from '../../db/pool';
import type { ListPlansQuery } from './plans.schemas';
import type { Plan, PlanScope } from './plans.types';

interface PlanRow {
  id: string;
  scope: PlanScope;
  name: string;
  monthly_allowance: number;
  max_per_request: number;
  is_predefined: boolean;
  created_at: Date;
  updated_at: Date;
}

export const PLAN_COLUMNS =
  'id, scope, name, monthly_allowance, max_per_request, is_predefined, created_at, updated_at';

const VISIBLE_PLANS_FILTER =
  '(account_id IS NULL OR account_id = $1) AND ($2::text IS NULL OR scope = $2)';

export function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    scope: row.scope,
    name: row.name,
    monthlyAllowance: row.monthly_allowance,
    maxPerRequest: row.max_per_request,
    isPredefined: row.is_predefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listVisiblePlans(
  accountId: string,
  query: ListPlansQuery,
): Promise<{ items: Plan[]; total: number }> {
  const scope = query.scope ?? null;

  const { rows } = await pool.query<PlanRow>(
    `SELECT ${PLAN_COLUMNS} FROM plans
     WHERE ${VISIBLE_PLANS_FILTER}
     ORDER BY is_predefined DESC, name ASC, id ASC
     LIMIT $3 OFFSET $4`,
    [accountId, scope, query.limit, query.offset],
  );

  const count = await pool.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM plans WHERE ${VISIBLE_PLANS_FILTER}`,
    [accountId, scope],
  );

  return { items: rows.map(toPlan), total: count.rows[0]?.total ?? 0 };
}

export async function findVisiblePlanById(
  accountId: string | null,
  planId: string,
): Promise<Plan | null> {
  const { rows } = await pool.query<PlanRow>(
    `SELECT ${PLAN_COLUMNS} FROM plans
     WHERE id = $1 AND (account_id IS NULL OR account_id = $2)`,
    [planId, accountId],
  );
  const row = rows[0];
  return row ? toPlan(row) : null;
}