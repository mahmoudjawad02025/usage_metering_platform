import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/app_error';
import { ERROR_CODES } from '../../core/errors/error_codes';
import { buildPage, type Page } from '../../core/utils/pagination';
import { isUniqueViolation } from '../../db/pg_errors';
import * as plansRepository from './plans.repository';
import type { ListPlansQuery } from './plans.schemas';
import type { CreatePlanInput, Plan, PlanScope, UpdatePlanInput } from './plans.types';

const PLAN_NAME_CONSTRAINT = 'plans_unique_name_per_owner_and_scope';

function duplicateNameError(name: string): ConflictError {
  return new ConflictError(`A plan named "${name}" already exists for this scope`);
}

export async function listPlans(accountId: string, query: ListPlansQuery): Promise<Page<Plan>> {
  const { items, total } = await plansRepository.listVisiblePlans(accountId, query);
  return buildPage(items, total, query);
}

export async function getPlan(accountId: string, planId: string): Promise<Plan> {
  const plan = await plansRepository.findVisiblePlanById(accountId, planId);
  if (!plan) throw new NotFoundError('Plan not found');
  return plan;
}

export async function createPlan(accountId: string, input: CreatePlanInput): Promise<Plan> {
  try {
    return await plansRepository.insertPlan(accountId, input);
  } catch (err) {
    if (isUniqueViolation(err, PLAN_NAME_CONSTRAINT)) throw duplicateNameError(input.name);
    throw err;
  }
}

export async function updatePlan(
  accountId: string,
  planId: string,
  patch: UpdatePlanInput,
): Promise<Plan> {
  const existing = await getPlan(accountId, planId);
  if (existing.isPredefined) {
    throw new ForbiddenError('Predefined plans are read-only', ERROR_CODES.PLAN_READ_ONLY);
  }

  try {
    const updated = await plansRepository.updateOwnedPlan(accountId, planId, patch);
    if (!updated) throw new NotFoundError('Plan not found');
    return updated;
  } catch (err) {
    if (patch.name !== undefined && isUniqueViolation(err, PLAN_NAME_CONSTRAINT)) {
      throw duplicateNameError(patch.name);
    }
    throw err;
  }
}

export async function getAssignablePlan(
  accountId: string | null,
  planId: string,
  scope: PlanScope,
): Promise<Plan> {
  const plan = await plansRepository.findVisiblePlanById(accountId, planId);
  if (!plan) throw new NotFoundError('Plan not found');

  if (plan.scope !== scope) {
    throw new AppError(
      400,
      ERROR_CODES.PLAN_SCOPE_MISMATCH,
      `Plan "${plan.name}" is a ${plan.scope} plan, but a ${scope} plan is required here`,
    );
  }
  return plan;
}