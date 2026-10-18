import type { Request, Response } from 'express';
import { requireAccount } from '../../core/middleware/authenticate_api_key.middleware';
import type {
  ChangeUserPlanBody,
  ListUsersQuery,
  RegisterUserBody,
  UserIdParams,
} from './users.schemas';
import * as usersService from './users.service';

export async function registerUserController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const body = req.body as RegisterUserBody;
  res.status(201).json(await usersService.registerUser(account.id, body));
}

export async function listUsersController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const query = req.query as unknown as ListUsersQuery;
  res.json(await usersService.listUsers(account.id, query));
}

export async function getUserController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const { id } = req.params as unknown as UserIdParams;
  res.json(await usersService.getUser(account.id, id));
}

export async function changeUserPlanController(req: Request, res: Response): Promise<void> {
  const account = requireAccount(req);
  const { id } = req.params as unknown as UserIdParams;
  const body = req.body as ChangeUserPlanBody;
  res.json(await usersService.changeUserPlan(account.id, id, body.planId));
}