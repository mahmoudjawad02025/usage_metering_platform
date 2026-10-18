import { Router } from 'express';
import { validate } from '../../core/middleware/validate.middleware';
import { listHistoryController } from './history.controller';
import { historyQuerySchema } from './history.schemas';

export const historyRouter = Router();

historyRouter.get('/', validate({ query: historyQuerySchema }), listHistoryController);