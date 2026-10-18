import { z } from 'zod';
import { paginationQuerySchema } from '../../core/utils/pagination';
import { periodSchema } from '../usage/usage.schemas';

export const historyQuerySchema = paginationQuerySchema.extend({
  userId: z.uuid().optional(),
  accepted: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  period: periodSchema.optional(),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;