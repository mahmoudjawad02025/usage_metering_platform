import type {
    Decision,
    EvaluationInput,
    LevelState,
    RejectedRule,
    Rejection,
    RuleLevel,
  } from './usage.types';
  
  interface RuleCheck {
    rule: RejectedRule;
    level: RuleLevel;
    isSatisfied: (input: EvaluationInput) => boolean;
  }
  
  export function remainingUnits(state: LevelState): number {
    // Clamp at 0 when a plan edit lowers the allowance below already-consumed usage.
    return Math.max(0, state.monthlyAllowance - state.consumed);
  }

  // Array order is precedence: per-request limits before monthly (matches the brief's 25-unit example).
  const RULE_CHECKS: readonly RuleCheck[] = [
    {
      rule: 'max_per_request',
      level: 'user',
      isSatisfied: ({ units, user }) => units <= user.maxPerRequest,
    },
    {
      rule: 'max_per_request',
      level: 'account',
      isSatisfied: ({ units, account }) => units <= account.maxPerRequest,
    },
    {
      rule: 'monthly_allowance',
      level: 'user',
      isSatisfied: ({ units, user }) => units <= remainingUnits(user),
    },
    {
      rule: 'monthly_allowance',
      level: 'account',
      isSatisfied: ({ units, account }) => units <= remainingUnits(account),
    },
  ];
  
  export function evaluateRules(input: EvaluationInput): Decision {
    const failedCheck = RULE_CHECKS.find((check) => !check.isSatisfied(input));
    if (!failedCheck) return { accepted: true };
    return { accepted: false, rule: failedCheck.rule, level: failedCheck.level };
  }
  
  export function describeRejection(
    rule: RejectedRule,
    level: RuleLevel,
    state: LevelState,
  ): Rejection {
    if (rule === 'max_per_request') {
      return { rule, level, limit: state.maxPerRequest };
    }
    return { rule, level, limit: state.monthlyAllowance, remaining: remainingUnits(state) };
  }