import { z } from 'zod';
import { paginationQuerySchema } from '../../core/utils/pagination';

export const planIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listPlansQuerySchema = paginationQuerySchema.extend({
  scope: z.enum(['account', 'user']).optional(),
});

export type PlanIdParams = z.infer<typeof planIdParamsSchema>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;