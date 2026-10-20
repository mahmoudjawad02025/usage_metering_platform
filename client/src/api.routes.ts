import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Router } from 'express';
import { z } from 'zod';
import type { DemoSession } from './demo_setup';
const PROCESSING_TIME_MS = 300;
const processDocumentBody = z.strictObject({
  userId: z.uuid(),
  units: z.number().int().min(1),
  requestId: z.string().trim().min(1).max(128).optional(),
});
const changePlanBody = z.strictObject({ planId: z.uuid() });
const userParams = z.object({ id: z.uuid() });
export function createApiRouter(session: DemoSession): Router {
  const router = Router();
  router.get('/status', async (_req, res) => {
    const client = session.client;
    const [account, usage, plans] = await Promise.all([
      client.getAccount(),
      client.getUsage(),
      client.listPlans(),
    ]);
    res.json({
      accountName: account.name,
      period: usage.period,
      account: usage.account,
      users: usage.users.items,
      plans: {
        account: plans.items.filter((plan) => plan.scope === 'account'),
        user: plans.items.filter((plan) => plan.scope === 'user'),
      },
    });
  });
  router.post('/process-document', async (req, res) => {
    const body = processDocumentBody.parse(req.body);
    const decision = await session.client.consume({
      userId: body.userId,
      units: body.units,
      requestId: body.requestId ?? randomUUID(),
    });
    // App policy: only newly accepted units count as processing (not metering's job).
    const processed = decision.accepted && !decision.replayed;
    if (processed) await sleep(PROCESSING_TIME_MS);
    res.json({ processed, decision });
  });
  router.put('/users/:id/plan', async (req, res) => {
    const { id } = userParams.parse(req.params);
    const body = changePlanBody.parse(req.body);
    res.json(await session.client.changeUserPlan(id, body.planId));
  });
  router.put('/account/plan', async (req, res) => {
    const body = changePlanBody.parse(req.body);
    res.json(await session.client.changeAccountPlan(body.planId));
  });
  router.post('/reset', async (_req, res) => {
    await session.reset();
    res.json({ ok: true });
  });
  return router;
}