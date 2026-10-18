import type { Request, Response } from 'express';
import { requireAccount } from '../../core/middleware/authenticate_api_key.middleware';
import type { HistoryQuery } from './history.schemas';
import * as historyService from './history.service';

export async function listHistoryController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const query = req.query as unknown as HistoryQuery;
  res.json(await historyService.listHistory(account.id, query));
}