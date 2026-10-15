import { z } from 'zod';
import { MAX_PLAN_LIMIT } from '../../core/constants';
import { paginationQuerySchema } from '../../core/utils/pagination';

const planNameSchema = z.string().trim().min(1).max(100);
const monthlyAllowanceSchema = z.number().int().min(0).max(MAX_PLAN_LIMIT);
const maxPerRequestSchema = z.number().int().min(1).max(MAX_PLAN_LIMIT);

export const planIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listPlansQuerySchema = paginationQuerySchema.extend({
  scope: z.enum(['account', 'user']).optional(),
});

export const createPlanBodySchema = z.strictObject({
  scope: z.enum(['account', 'user']),
  name: planNameSchema,
  monthlyAllowance: monthlyAllowanceSchema,
  maxPerRequest: maxPerRequestSchema,
});

export const updatePlanBodySchema = z
  .strictObject({
    name: planNameSchema.optional(),
    monthlyAllowance: monthlyAllowanceSchema.optional(),
    maxPerRequest: maxPerRequestSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export type PlanIdParams = z.infer<typeof planIdParamsSchema>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;
export type CreatePlanBody = z.infer<typeof createPlanBodySchema>;
export type UpdatePlanBody = z.infer<typeof updatePlanBodySchema>;