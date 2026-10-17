import { z } from 'zod';

export const createAccountBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  planId: z.uuid().optional(),
});

export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;