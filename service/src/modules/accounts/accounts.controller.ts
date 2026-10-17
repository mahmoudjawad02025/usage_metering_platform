import type { Request, Response } from 'express';
import { requireAccount } from '../../core/middleware/authenticate_api_key.middleware';
import type { CreateAccountBody } from './accounts.schemas';
import * as accountsService from './accounts.service';

export async function createAccountController(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateAccountBody;
  res.status(201).json(await accountsService.createAccount(body));
}

export async function getMyAccountController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  res.json(await accountsService.getAccount(account.id));
}