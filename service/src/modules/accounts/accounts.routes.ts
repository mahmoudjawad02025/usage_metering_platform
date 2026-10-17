import { Router } from 'express';
import { authenticateAdmin } from '../../core/middleware/authenticate_admin.middleware';
import { authenticateApiKey } from '../../core/middleware/authenticate_api_key.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import { createAccountController, getMyAccountController } from './accounts.controller';
import { createAccountBodySchema } from './accounts.schemas';

export const accountsRouter = Router();

accountsRouter.post(
  '/',
  authenticateAdmin,
  validate({ body: createAccountBodySchema }),
  createAccountController,
);
accountsRouter.get('/me', authenticateApiKey, getMyAccountController);