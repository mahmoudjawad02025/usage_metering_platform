import type { Request, Response } from 'express';
import { requireAccount } from '../../core/middleware/authenticate_api_key.middleware';
import type {
  ConsumeBody,
  UsageQuery,
  UserUsageParams,
  UserUsageQuery,
} from './usage.schemas';
import * as usageService from './usage.service';

export async function consumeController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const body = req.body as ConsumeBody;
  res.json(await usageService.consumeUnits(account.id, body));
}

export async function getUsageController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const query = req.query as unknown as UsageQuery;
  res.json(await usageService.getUsageSummary(account.id, query));
}

export async function getUserUsageController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const { userId } = req.params as unknown as UserUsageParams;
  const query = req.query as unknown as UserUsageQuery;
  res.json(await usageService.getUserUsage(account.id, userId, query.period));
}