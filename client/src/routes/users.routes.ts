import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/require_session';

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const registerBody = z.strictObject({
  externalId: z.string().trim().min(1).max(255),
  planId: z.uuid().optional(),
});

const changePlanBody = z.strictObject({ planId: z.uuid() });
const idParams = z.object({ id: z.uuid() });

export function createUsersRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req, res) => {
    const query = listQuery.parse(req.query);
    res.json(await req.metering!.listUsers(query));
  });

  router.post('/', async (req, res) => {
    const body = registerBody.parse(req.body);
    res.status(201).json(await req.metering!.registerUser(body));
  });

  router.get('/:id', async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json(await req.metering!.getUser(id));
  });

  router.put('/:id/plan', async (req, res) => {
    const { id } = idParams.parse(req.params);
    const body = changePlanBody.parse(req.body);
    res.json(await req.metering!.changeUserPlan(id, body.planId));
  });

  return router;
}
