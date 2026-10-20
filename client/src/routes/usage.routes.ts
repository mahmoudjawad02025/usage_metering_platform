import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/require_session';

const MAX_UNITS = 1_000_000_000;
const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period must be in the format YYYY-MM');

const consumeBody = z.strictObject({
  userId: z.uuid(),
  units: z.number().int().min(1).max(MAX_UNITS),
  requestId: z.string().trim().min(1).max(128),
});

const usageQuery = z.object({
  period: periodSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const userUsageParams = z.object({ userId: z.uuid() });
const userUsageQuery = z.object({ period: periodSchema.optional() });

const historyQuery = z.object({
  userId: z.uuid().optional(),
  accepted: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  period: periodSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createUsageRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.post('/consume', async (req, res) => {
    const body = consumeBody.parse(req.body);
    res.json(await req.metering!.consume(body));
  });

  router.get('/', async (req, res) => {
    const query = usageQuery.parse(req.query);
    res.json(await req.metering!.getUsage(query));
  });

  router.get('/users/:userId', async (req, res) => {
    const { userId } = userUsageParams.parse(req.params);
    const query = userUsageQuery.parse(req.query);
    res.json(await req.metering!.getUserUsage(userId, query.period));
  });

  router.get('/history', async (req, res) => {
    const query = historyQuery.parse(req.query);
    res.json(await req.metering!.getHistory(query));
  });

  return router;
}
