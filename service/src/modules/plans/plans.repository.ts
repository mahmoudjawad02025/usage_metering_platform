import { pool } from '../../db/pool';
import type { ListPlansQuery } from './plans.schemas';
import type { CreatePlanInput, Plan, PlanScope, UpdatePlanInput } from './plans.types';

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

export interface JoinedPlanRow {
  plan_id: string;
  plan_scope: PlanScope;
  plan_name: string;
  plan_monthly_allowance: number;
  plan_max_per_request: number;
  plan_is_predefined: boolean;
  plan_created_at: Date;
  plan_updated_at: Date;
}

export const JOINED_PLAN_COLUMNS = `
  p.id AS plan_id,
  p.scope AS plan_scope,
  p.name AS plan_name,
  p.monthly_allowance AS plan_monthly_allowance,
  p.max_per_request AS plan_max_per_request,
  p.is_predefined AS plan_is_predefined,
  p.created_at AS plan_created_at,
  p.updated_at AS plan_updated_at`;

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

export function toPlanFromJoin(row: JoinedPlanRow): Plan {
  return {
    id: row.plan_id,
    scope: row.plan_scope,
    name: row.plan_name,
    monthlyAllowance: row.plan_monthly_allowance,
    maxPerRequest: row.plan_max_per_request,
    isPredefined: row.plan_is_predefined,
    createdAt: row.plan_created_at,
    updatedAt: row.plan_updated_at,
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

export async function insertPlan(accountId: string, input: CreatePlanInput): Promise<Plan> {
  const { rows } = await pool.query<PlanRow>(
    `INSERT INTO plans (account_id, scope, name, monthly_allowance, max_per_request, is_predefined)
     VALUES ($1, $2, $3, $4, $5, FALSE)
     RETURNING ${PLAN_COLUMNS}`,
    [accountId, input.scope, input.name, input.monthlyAllowance, input.maxPerRequest],
  );
  const row = rows[0];
  if (!row) throw new Error('Plan insert returned no row');
  return toPlan(row);
}

export async function updateOwnedPlan(
  accountId: string,
  planId: string,
  patch: UpdatePlanInput,
): Promise<Plan | null> {
  const { rows } = await pool.query<PlanRow>(
    `UPDATE plans
     SET name = COALESCE($3, name),
         monthly_allowance = COALESCE($4, monthly_allowance),
         max_per_request = COALESCE($5, max_per_request),
         updated_at = now()
     WHERE id = $1 AND account_id = $2 AND NOT is_predefined
     RETURNING ${PLAN_COLUMNS}`,
    [planId, accountId, patch.name ?? null, patch.monthlyAllowance ?? null, patch.maxPerRequest ?? null],
  );
  const row = rows[0];
  return row ? toPlan(row) : null;
}