import { z } from 'zod';
import { paginationQuerySchema } from '../../core/utils/pagination';

export const registerUserBodySchema = z.strictObject({
  externalId: z.string().trim().min(1).max(255),
  planId: z.uuid().optional(),
});

export const changeUserPlanBodySchema = z.strictObject({
  planId: z.uuid(),
});

export const userIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listUsersQuerySchema = paginationQuerySchema;

export type RegisterUserBody = z.infer<typeof registerUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ChangeUserPlanBody = z.infer<typeof changeUserPlanBodySchema>;