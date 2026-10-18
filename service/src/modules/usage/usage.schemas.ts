import { z } from 'zod';
import { MAX_PLAN_LIMIT } from '../../core/constants';
import { paginationQuerySchema } from '../../core/utils/pagination';

export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period must be in the format YYYY-MM');

export const consumeBodySchema = z.strictObject({
  userId: z.uuid(),
  units: z.number().int().min(1).max(MAX_PLAN_LIMIT),
  requestId: z.string().trim().min(1).max(128),
});

export const usageQuerySchema = paginationQuerySchema.extend({
  period: periodSchema.optional(),
});

export const userUsageQuerySchema = z.object({
  period: periodSchema.optional(),
});

export const userUsageParamsSchema = z.object({
  userId: z.uuid(),
});

export type ConsumeBody = z.infer<typeof consumeBodySchema>;
export type UsageQuery = z.infer<typeof usageQuerySchema>;
export type UserUsageQuery = z.infer<typeof userUsageQuerySchema>;
export type UserUsageParams = z.infer<typeof userUsageParamsSchema>;