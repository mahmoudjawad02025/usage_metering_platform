import type { Request, Response } from 'express';
import { requireAccount } from '../../core/middleware/authenticate_api_key.middleware';
import type { ChangeAccountPlanBody, CreateAccountBody } from './accounts.schemas';
import * as accountsService from './accounts.service';

export async function createAccountController(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateAccountBody;
  res.status(201).json(await accountsService.createAccount(body));
}

export async function getMyAccountController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  res.json(await accountsService.getAccount(account.id));
}

export async function changeMyAccountPlanController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const body = req.body as ChangeAccountPlanBody;
  res.json(await accountsService.changeAccountPlan(account.id, body.planId));
}