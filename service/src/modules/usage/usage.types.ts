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