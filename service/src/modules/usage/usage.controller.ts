import type { Request, Response } from 'express';
import { requireAccount } from '../../core/middleware/authenticate_api_key.middleware';
import type { ConsumeBody } from './usage.schemas';
import * as usageService from './usage.service';

export async function consumeController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const body = req.body as ConsumeBody;
  res.json(await usageService.consumeUnits(account.id, body));
}