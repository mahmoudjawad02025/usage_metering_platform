import type { Plan } from '../plans/plans.types';

export interface AuthenticatedAccount {
  id: string;
  name: string;
  planId: string;
}

export interface Account {
  id: string;
  name: string;
  plan: Plan;
  createdAt: Date;
}

export interface CreatedAccount {
  account: Account;
  apiKey: string;
}