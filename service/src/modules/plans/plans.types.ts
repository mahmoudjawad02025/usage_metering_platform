export type PlanScope = 'account' | 'user';

export interface Plan {
  id: string;
  scope: PlanScope;
  name: string;
  monthlyAllowance: number;
  maxPerRequest: number;
  isPredefined: boolean;
  createdAt: Date;
  updatedAt: Date;
}