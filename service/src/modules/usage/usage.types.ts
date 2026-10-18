export type RuleLevel = 'account' | 'user';

export type RejectedRule = 'max_per_request' | 'monthly_allowance';

export interface LevelState {
  monthlyAllowance: number;
  maxPerRequest: number;
  consumed: number;
}

export interface EvaluationInput {
  units: number;
  account: LevelState;
  user: LevelState;
}

export type Decision =
  | { accepted: true }
  | { accepted: false; rule: RejectedRule; level: RuleLevel };

export interface Rejection {
  rule: RejectedRule;
  level: RuleLevel;
  limit: number;
  remaining?: number;
}

export interface PlanSnapshot {
  planId: string;
  planName: string;
  monthlyAllowance: number;
  maxPerRequest: number;
}

export interface LevelSnapshot extends PlanSnapshot {
  consumedBefore: number;
}

export interface AppliedLimits {
  account: LevelSnapshot;
  user: LevelSnapshot;
}

export interface Counters {
  accountConsumed: number;
  userConsumed: number;
}

export interface StoredRequest {
  id: string;
  requestId: string;
  userId: string;
  units: number;
  period: string;
  accepted: boolean;
  rejectedRule: RejectedRule | null;
  rejectedLevel: RuleLevel | null;
  appliedLimits: AppliedLimits;
  createdAt: Date;
}

export interface NewRequest {
  accountId: string;
  userId: string;
  requestId: string;
  units: number;
  period: string;
  decision: Decision;
  appliedLimits: AppliedLimits;
}

export interface ConsumeInput {
  userId: string;
  units: number;
  requestId: string;
}

export interface PlanView {
  id: string;
  name: string;
  monthlyAllowance: number;
  maxPerRequest: number;
}

export interface LevelView {
  plan: PlanView;
  consumed: number;
  remaining: number;
}

export interface ConsumeResponse {
  accepted: boolean;
  replayed: boolean;
  requestId: string;
  units: number;
  period: string;
  rejection: Rejection | null;
  account: LevelView;
  user: LevelView & { id: string };
}