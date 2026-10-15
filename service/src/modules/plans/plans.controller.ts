import type { Request, Response } from 'express';
import { requireAccount } from '../../core/middleware/authenticate_api_key.middleware';
import type {
  CreatePlanBody,
  ListPlansQuery,
  PlanIdParams,
  UpdatePlanBody,
} from './plans.schemas';
import * as plansService from './plans.service';

export async function listPlansController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const query = req.query as unknown as ListPlansQuery;
  res.json(await plansService.listPlans(account.id, query));
}

export async function getPlanController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const { id } = req.params as unknown as PlanIdParams;
  res.json(await plansService.getPlan(account.id, id));
}

export async function createPlanController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const body = req.body as CreatePlanBody;
  res.status(201).json(await plansService.createPlan(account.id, body));
}

export async function updatePlanController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const { id } = req.params as unknown as PlanIdParams;
  const body = req.body as UpdatePlanBody;
  res.json(await plansService.updatePlan(account.id, id, body));
}