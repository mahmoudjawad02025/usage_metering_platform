import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { createFreshDemoAccount, ensureDemoAccount } from '../demo_setup';
import { MeteringClient, createAccount } from '../metering_client';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getApiKey,
  readSessionId,
  setSessionCookie,
} from '../session_store';

const signUpBody = z.strictObject({
  name: z.string().trim().min(1).max(200),
  planName: z.enum(['Starter', 'Pro']).optional(),
});

const signInBody = z.strictObject({
  apiKey: z.string().trim().min(1),
});

const demoBody = z.strictObject({
  fresh: z.boolean().optional(),
});

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/sign-up', async (req, res) => {
    const body = signUpBody.parse(req.body);
    const created = await createAccount(config.SERVICE_URL, config.ADMIN_KEY, {
      name: body.name,
    });
    const client = new MeteringClient(config.SERVICE_URL, created.apiKey);
    let account = created.account;
    if (body.planName && body.planName !== account.plan.name) {
      const plans = await client.listPlans({ scope: 'account', limit: 100 });
      const plan = plans.items.find(
        (item) => item.isPredefined && item.scope === 'account' && item.name === body.planName,
      );
      if (!plan) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Unknown account plan "${body.planName}"` },
        });
        return;
      }
      account = await client.changeAccountPlan(plan.id);
    }
    const sessionId = createSession(created.apiKey);
    setSessionCookie(res, sessionId);
    res.status(201).json({ account, apiKey: created.apiKey });
  });

  router.post('/sign-in', async (req, res) => {
    const body = signInBody.parse(req.body);
    const client = new MeteringClient(config.SERVICE_URL, body.apiKey);
    const account = await client.getAccount();
    const sessionId = createSession(body.apiKey);
    setSessionCookie(res, sessionId);
    res.json({ account });
  });

  router.post('/demo', async (req, res) => {
    const body = demoBody.parse(req.body ?? {});
    const demo = body.fresh ? await createFreshDemoAccount() : await ensureDemoAccount();
    const sessionId = createSession(demo.apiKey);
    setSessionCookie(res, sessionId);
    res.json({ account: demo.account });
  });

  router.post('/sign-out', (req, res) => {
    const sessionId = readSessionId(req);
    if (sessionId) destroySession(sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/session', async (req, res) => {
    const sessionId = readSessionId(req);
    if (!sessionId) {
      res.json({ authenticated: false });
      return;
    }
    const apiKey = getApiKey(sessionId);
    if (!apiKey) {
      clearSessionCookie(res);
      res.json({ authenticated: false });
      return;
    }
    try {
      const account = await new MeteringClient(config.SERVICE_URL, apiKey).getAccount();
      res.json({ authenticated: true, accountName: account.name });
    } catch {
      destroySession(sessionId);
      clearSessionCookie(res);
      res.json({ authenticated: false });
    }
  });

  return router;
}
