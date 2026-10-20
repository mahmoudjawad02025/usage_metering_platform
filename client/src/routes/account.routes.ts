import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/require_session';

const changePlanBody = z.strictObject({ planId: z.uuid() });

export function createAccountRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/me', async (req, res) => {
    res.json(await req.metering!.getAccount());
  });

  router.put('/me/plan', async (req, res) => {
    const body = changePlanBody.parse(req.body);
    res.json(await req.metering!.changeAccountPlan(body.planId));
  });

  return router;
}
