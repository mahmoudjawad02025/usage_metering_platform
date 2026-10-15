import { Router } from 'express';
import { validate } from '../../core/middleware/validate.middleware';
import {
  createPlanController,
  getPlanController,
  listPlansController,
  updatePlanController,
} from './plans.controller';
import {
  createPlanBodySchema,
  listPlansQuerySchema,
  planIdParamsSchema,
  updatePlanBodySchema,
} from './plans.schemas';

export const plansRouter = Router();

plansRouter.get('/', validate({ query: listPlansQuerySchema }), listPlansController);
plansRouter.post('/', validate({ body: createPlanBodySchema }), createPlanController);
plansRouter.get('/:id', validate({ params: planIdParamsSchema }), getPlanController);
plansRouter.patch(
  '/:id',
  validate({ params: planIdParamsSchema, body: updatePlanBodySchema }),
  updatePlanController,
);