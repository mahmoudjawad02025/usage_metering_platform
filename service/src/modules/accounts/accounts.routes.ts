import { Router } from 'express';
import { authenticateAdmin } from '../../core/middleware/authenticate_admin.middleware';
import { authenticateApiKey } from '../../core/middleware/authenticate_api_key.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import {
  changeMyAccountPlanController,
  createAccountController,
  getMyAccountController,
} from './accounts.controller';
import { changeAccountPlanBodySchema, createAccountBodySchema } from './accounts.schemas';

export const accountsRouter = Router();

accountsRouter.post(
  '/',
  authenticateAdmin,
  validate({ body: createAccountBodySchema }),
  createAccountController,
);
accountsRouter.get('/me', authenticateApiKey, getMyAccountController);
accountsRouter.put(
  '/me/plan',
  authenticateApiKey,
  validate({ body: changeAccountPlanBodySchema }),
  changeMyAccountPlanController,
);