import { z } from 'zod';
import { MAX_PLAN_LIMIT } from '../../core/constants';

export const consumeBodySchema = z.strictObject({
  userId: z.uuid(),
  units: z.number().int().min(1).max(MAX_PLAN_LIMIT),
  requestId: z.string().trim().min(1).max(128),
});

export type ConsumeBody = z.infer<typeof consumeBodySchema>;