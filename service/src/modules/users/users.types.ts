import type { Plan } from '../plans/plans.types';

export interface User {
  id: string;
  externalId: string;
  plan: Plan;
  createdAt: Date;
} 