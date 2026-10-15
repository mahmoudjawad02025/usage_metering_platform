import { Router } from 'express';
import { validate } from '../../core/middleware/validate.middleware';
import { getPlanController, listPlansController } from './plans.controller';
import { listPlansQuerySchema, planIdParamsSchema } from './plans.schemas';

export const plansRouter = Router();

plansRouter.get('/', validate({ query: listPlansQuerySchema }), listPlansController);
plansRouter.get('/:id', validate({ params: planIdParamsSchema }), getPlanController);