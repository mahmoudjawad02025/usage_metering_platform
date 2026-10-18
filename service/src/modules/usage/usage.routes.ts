import { Router } from 'express';
import { validate } from '../../core/middleware/validate.middleware';
import {
  consumeController,
  getUsageController,
  getUserUsageController,
} from './usage.controller';
import {
  consumeBodySchema,
  usageQuerySchema,
  userUsageParamsSchema,
  userUsageQuerySchema,
} from './usage.schemas';

export const usageRouter = Router();

usageRouter.post('/consume', validate({ body: consumeBodySchema }), consumeController);
usageRouter.get('/', validate({ query: usageQuerySchema }), getUsageController);
usageRouter.get(
  '/users/:userId',
  validate({ params: userUsageParamsSchema, query: userUsageQuerySchema }),
  getUserUsageController,
);