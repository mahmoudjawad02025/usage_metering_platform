import { NotFoundError } from '../../core/errors/app_error';
import { buildPage, type Page } from '../../core/utils/pagination';
import * as plansRepository from './plans.repository';
import type { ListPlansQuery } from './plans.schemas';
import type { Plan } from './plans.types';

export async function listPlans(accountId: string, query: ListPlansQuery): Promise<Page<Plan>> {
  const { items, total } = await plansRepository.listVisiblePlans(accountId, query);
  return buildPage(items, total, query);
}

export async function getPlan(accountId: string, planId: string): Promise<Plan> {
  const plan = await plansRepository.findVisiblePlanById(accountId, planId);
  if (!plan) throw new NotFoundError('Plan not found');
  return plan;
}