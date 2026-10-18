import { describe, expect, it } from 'vitest';
import {
  describeRejection,
  evaluateRules,
  remainingUnits,
} from '../../src/modules/usage/rule_evaluator';
import type { EvaluationInput, LevelState } from '../../src/modules/usage/usage.types';

const ACCOUNT: LevelState = { monthlyAllowance: 10000, maxPerRequest: 100, consumed: 0 };
const USER: LevelState = { monthlyAllowance: 1000, maxPerRequest: 20, consumed: 0 };

function evaluate(
  units: number,
  overrides: { account?: Partial<LevelState>; user?: Partial<LevelState> } = {},
) {
  const input: EvaluationInput = {
    units,
    account: { ...ACCOUNT, ...overrides.account },
    user: { ...USER, ...overrides.user },
  };
  return evaluateRules(input);
}

describe('examples from the project brief', () => {
  it('rejects 25 units because of the user per-request limit', () => {
    expect(evaluate(25)).toEqual({ accepted: false, rule: 'max_per_request', level: 'user' });
  });

  it('accepts 10 units when both levels have enough allowance', () => {
    expect(evaluate(10)).toEqual({ accepted: true });
  });

  it('rejects 10 units when the account has only 5 units left', () => {
    const decision = evaluate(10, { account: { consumed: 9995 } });
    expect(decision).toEqual({ accepted: false, rule: 'monthly_allowance', level: 'account' });
  });
});

describe('monthly allowance', () => {
  it('rejects at the user level when the user has too little left', () => {
    const decision = evaluate(10, { user: { consumed: 995 } });
    expect(decision).toEqual({ accepted: false, rule: 'monthly_allowance', level: 'user' });
  });

  it('accepts exactly the remaining amount and rejects one unit more', () => {
    expect(evaluate(5, { user: { consumed: 995 } })).toEqual({ accepted: true });
    expect(evaluate(6, { user: { consumed: 995 } }).accepted).toBe(false);
  });

  it('accepts exactly the per-request limit and rejects one unit more', () => {
    expect(evaluate(20)).toEqual({ accepted: true });
    expect(evaluate(21).accepted).toBe(false);
  });

  it('rejects everything when the allowance is zero', () => {
    const decision = evaluate(1, { user: { monthlyAllowance: 0 } });
    expect(decision).toEqual({ accepted: false, rule: 'monthly_allowance', level: 'user' });
  });

  it('rejects when the allowance was reduced below the existing usage', () => {
    const decision = evaluate(1, { user: { monthlyAllowance: 100, consumed: 400 } });
    expect(decision).toEqual({ accepted: false, rule: 'monthly_allowance', level: 'user' });
  });
});

describe('rule precedence', () => {
  it('reports the user per-request limit before the account per-request limit', () => {
    const decision = evaluate(500, { account: { maxPerRequest: 100 }, user: { maxPerRequest: 20 } });
    expect(decision).toEqual({ accepted: false, rule: 'max_per_request', level: 'user' });
  });

  it('reports the account per-request limit when only the account fails it', () => {
    const decision = evaluate(150, { account: { maxPerRequest: 100 }, user: { maxPerRequest: 200 } });
    expect(decision).toEqual({ accepted: false, rule: 'max_per_request', level: 'account' });
  });

  it('checks per-request limits before monthly allowances', () => {
    const decision = evaluate(25, { user: { consumed: 995 } });
    expect(decision).toEqual({ accepted: false, rule: 'max_per_request', level: 'user' });
  });

  it('reports the user monthly allowance before the account monthly allowance', () => {
    const decision = evaluate(10, { account: { consumed: 9995 }, user: { consumed: 995 } });
    expect(decision).toEqual({ accepted: false, rule: 'monthly_allowance', level: 'user' });
  });

  it('does not let a larger user allowance raise the account allowance', () => {
    const decision = evaluate(20, {
      account: { monthlyAllowance: 10, maxPerRequest: 100 },
      user: { monthlyAllowance: 100000, maxPerRequest: 50 },
    });
    expect(decision).toEqual({ accepted: false, rule: 'monthly_allowance', level: 'account' });
  });
});

describe('remainingUnits', () => {
  it('returns the unused part of the allowance', () => {
    expect(remainingUnits({ monthlyAllowance: 100, maxPerRequest: 10, consumed: 30 })).toBe(70);
  });

  it('never returns a negative number', () => {
    expect(remainingUnits({ monthlyAllowance: 100, maxPerRequest: 10, consumed: 400 })).toBe(0);
  });
});

describe('describeRejection', () => {
  const state: LevelState = { monthlyAllowance: 100, maxPerRequest: 10, consumed: 95 };

  it('explains a per-request rejection with the limit', () => {
    expect(describeRejection('max_per_request', 'user', state)).toEqual({
      rule: 'max_per_request',
      level: 'user',
      limit: 10,
    });
  });

  it('explains a monthly rejection with the allowance and what remains', () => {
    expect(describeRejection('monthly_allowance', 'account', state)).toEqual({
      rule: 'monthly_allowance',
      level: 'account',
      limit: 100,
      remaining: 5,
    });
  });
});