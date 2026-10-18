import { Router } from 'express';
import { validate } from '../../core/middleware/validate.middleware';
import {
  getUserController,
  listUsersController,
  registerUserController,
} from './users.controller';
import { listUsersQuerySchema, registerUserBodySchema, userIdParamsSchema } from './users.schemas';

export const usersRouter = Router();

usersRouter.post('/', validate({ body: registerUserBodySchema }), registerUserController);
usersRouter.get('/', validate({ query: listUsersQuerySchema }), listUsersController);
usersRouter.get('/:id', validate({ params: userIdParamsSchema }), getUserController);