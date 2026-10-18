import { Router } from 'express';
import { validate } from '../../core/middleware/validate.middleware';
import {
  changeUserPlanController,
  getUserController,
  listUsersController,
  registerUserController,
} from './users.controller';
import {
  changeUserPlanBodySchema,
  listUsersQuerySchema,
  registerUserBodySchema,
  userIdParamsSchema,
} from './users.schemas';

export const usersRouter = Router();

usersRouter.post('/', validate({ body: registerUserBodySchema }), registerUserController);
usersRouter.get('/', validate({ query: listUsersQuerySchema }), listUsersController);
usersRouter.get('/:id', validate({ params: userIdParamsSchema }), getUserController);
usersRouter.put(
  '/:id/plan',
  validate({ params: userIdParamsSchema, body: changeUserPlanBodySchema }),
  changeUserPlanController,
);