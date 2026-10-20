import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/require_session';

const MAX_PLAN_LIMIT = 1_000_000_000;

const listQuery = z.object({
  scope: z.enum(['account', 'user']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const createBody = z.strictObject({
  scope: z.enum(['account', 'user']),
  name: z.string().trim().min(1).max(100),
  monthlyAllowance: z.number().int().min(0).max(MAX_PLAN_LIMIT),
  maxPerRequest: z.number().int().min(1).max(MAX_PLAN_LIMIT),
});

const updateBody = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    monthlyAllowance: z.number().int().min(0).max(MAX_PLAN_LIMIT).optional(),
    maxPerRequest: z.number().int().min(1).max(MAX_PLAN_LIMIT).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

const idParams = z.object({ id: z.uuid() });

export function createPlansRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req, res) => {
    const query = listQuery.parse(req.query);
    res.json(await req.metering!.listPlans(query));
  });

  router.post('/', async (req, res) => {
    const body = createBody.parse(req.body);
    res.status(201).json(await req.metering!.createPlan(body));
  });

  router.get('/:id', async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json(await req.metering!.getPlan(id));
  });

  router.patch('/:id', async (req, res) => {
    const { id } = idParams.parse(req.params);
    const body = updateBody.parse(req.body);
    res.json(await req.metering!.updatePlan(id, body));
  });

  return router;
}
