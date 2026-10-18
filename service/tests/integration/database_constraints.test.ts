import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PREDEFINED_PLAN_IDS } from '../../src/core/constants';
import { pool } from '../../src/db/pool';
import { closeDatabase, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestPlan,
  createTestUser,
  type TestAccount,
  type TestUser,
} from '../helpers/factories';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const NOT_NULL_VIOLATION = '23502';
const CHECK_VIOLATION = '23514';

let account: TestAccount;
let otherAccount: TestAccount;
let user: TestUser;

beforeEach(async () => {
  await resetDatabase();
  account = await createTestAccount();
  otherAccount = await createTestAccount();
  user = await createTestUser(account.id);
});

afterAll(closeDatabase);

async function expectViolation(statement: Promise<unknown>, code: string, constraint?: string) {
  await expect(statement).rejects.toMatchObject(constraint ? { code, constraint } : { code });
}

function insertPlan(overrides: Partial<{
  accountId: string | null;
  scope: string;
  name: string;
  allowance: number;
  perRequest: number;
  predefined: boolean;
}> = {}) {
  const values = {
    accountId: account.id,
    scope: 'user',
    name: 'Some plan',
    allowance: 100,
    perRequest: 10,
    predefined: false,
    ...overrides,
  };
  return pool.query(
    `INSERT INTO plans (account_id, scope, name, monthly_allowance, max_per_request, is_predefined)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [values.accountId, values.scope, values.name, values.allowance, values.perRequest, values.predefined],
  );
}

function insertRequest(overrides: Partial<{
  accountId: string;
  userId: string;
  requestId: string;
  units: number;
  period: string;
  accepted: boolean;
  rule: string | null;
  level: string | null;
  limits: string | null;
}> = {}) {
  const values = {
    accountId: account.id,
    userId: user.id,
    requestId: 'request-1',
    units: 5,
    period: '2026-10-01',
    accepted: true,
    rule: null,
    level: null,
    limits: '{}',
    ...overrides,
  };
  return pool.query(
    `INSERT INTO usage_requests
       (account_id, user_id, request_id, units, period, accepted, rejected_rule, rejected_level,
        account_plan_id, user_plan_id, applied_limits)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      values.accountId,
      values.userId,
      values.requestId,
      values.units,
      values.period,
      values.accepted,
      values.rule,
      values.level,
      PREDEFINED_PLAN_IDS.STARTER,
      PREDEFINED_PLAN_IDS.BASIC,
      values.limits,
    ],
  );
}

describe('plans', () => {
  it('forbids two predefined plans with the same name and scope', async () => {
    await expectViolation(
      insertPlan({ accountId: null, scope: 'account', name: 'Starter', predefined: true }),
      UNIQUE_VIOLATION,
      'plans_unique_name_per_owner_and_scope',
    );
  });

  it('forbids a duplicate name inside one account and scope, but allows it for another account', async () => {
    await insertPlan({ name: 'Team' });

    await expectViolation(insertPlan({ name: 'Team' }), UNIQUE_VIOLATION, 'plans_unique_name_per_owner_and_scope');
    await expect(insertPlan({ accountId: otherAccount.id, name: 'Team' })).resolves.toBeDefined();
    await expect(insertPlan({ name: 'Team', scope: 'account' })).resolves.toBeDefined();
  });

  it.each([
    ['a negative allowance', { allowance: -1 }],
    ['an allowance above one billion', { allowance: 1_000_000_001 }],
    ['a zero per-request limit', { perRequest: 0 }],
    ['a per-request limit above one billion', { perRequest: 1_000_000_001 }],
    ['an unknown scope', { scope: 'team' }],
    ['a blank name', { name: '   ' }],
    ['a name longer than 100 characters', { name: 'n'.repeat(101) }],
  ])('rejects %s', async (_label, overrides) => {
    await expectViolation(insertPlan(overrides), CHECK_VIOLATION);
  });

  it('accepts the exact boundary values', async () => {
    await expect(
      insertPlan({ name: 'Edge', allowance: 0, perRequest: 1_000_000_000 }),
    ).resolves.toBeDefined();
  });

  it('keeps predefined plans ownerless and custom plans owned', async () => {
    await expectViolation(
      insertPlan({ accountId: account.id, predefined: true }),
      CHECK_VIOLATION,
      'plans_owner_matches_predefined',
    );
    await expectViolation(
      insertPlan({ accountId: null, predefined: false }),
      CHECK_VIOLATION,
      'plans_owner_matches_predefined',
    );
  });

  it('rejects a plan owned by an account that does not exist', async () => {
    await expectViolation(
      insertPlan({ accountId: 'c0000000-0000-4000-8000-000000000999' }),
      FOREIGN_KEY_VIOLATION,
      'plans_account_id_fkey',
    );
  });
});

describe('accounts and users', () => {
  it('forbids two accounts with the same API key hash', async () => {
    await expectViolation(
      pool.query('INSERT INTO accounts (name, api_key_hash, plan_id) SELECT $1, api_key_hash, plan_id FROM accounts WHERE id = $2', [
        'Copy',
        account.id,
      ]),
      UNIQUE_VIOLATION,
    );
  });

  it('rejects an account with an unknown plan or a blank name', async () => {
    await expectViolation(
      pool.query('INSERT INTO accounts (name, api_key_hash, plan_id) VALUES ($1, $2, $3)', [
        'Acme',
        'hash-1',
        'c0000000-0000-4000-8000-000000000999',
      ]),
      FOREIGN_KEY_VIOLATION,
    );
    await expectViolation(
      pool.query('INSERT INTO accounts (name, api_key_hash, plan_id) VALUES ($1, $2, $3)', [
        '  ',
        'hash-2',
        PREDEFINED_PLAN_IDS.STARTER,
      ]),
      CHECK_VIOLATION,
    );
  });

  it('forbids a duplicate external id inside one account but allows it in another', async () => {
    const insertUser = (accountId: string) =>
      pool.query('INSERT INTO users (account_id, external_id, plan_id) VALUES ($1, $2, $3)', [
        accountId,
        user.externalId,
        PREDEFINED_PLAN_IDS.BASIC,
      ]);

    await expectViolation(insertUser(account.id), UNIQUE_VIOLATION, 'users_unique_external_id_per_account');
    await expect(insertUser(otherAccount.id)).resolves.toBeDefined();
  });

  it('rejects a user with an unknown plan or an empty external id', async () => {
    await expectViolation(
      pool.query('INSERT INTO users (account_id, external_id, plan_id) VALUES ($1, $2, $3)', [
        account.id,
        'ghost',
        'c0000000-0000-4000-8000-000000000999',
      ]),
      FOREIGN_KEY_VIOLATION,
    );
    await expectViolation(
      pool.query('INSERT INTO users (account_id, external_id, plan_id) VALUES ($1, $2, $3)', [
        account.id,
        '',
        PREDEFINED_PLAN_IDS.BASIC,
      ]),
      CHECK_VIOLATION,
    );
  });
});

describe('usage counters', () => {
  it.each([
    ['account_usage', 'account_id', () => account.id],
    ['user_usage', 'user_id', () => user.id],
  ])('rejects invalid rows in %s', async (table, column, getOwnerId) => {
    const insert = (period: string, consumed: number) =>
      pool.query(`INSERT INTO ${table} (${column}, period, consumed) VALUES ($1, $2, $3)`, [
        getOwnerId(),
        period,
        consumed,
      ]);

    await expectViolation(insert('2026-10-15', 0), CHECK_VIOLATION);
    await expectViolation(insert('2026-10-01', -1), CHECK_VIOLATION);
    await expect(insert('2026-10-01', 5)).resolves.toBeDefined();
    await expectViolation(insert('2026-10-01', 7), UNIQUE_VIOLATION);
  });
});

describe('usage requests', () => {
  it('accepts a valid accepted request and a valid rejected request', async () => {
    await expect(insertRequest({ requestId: 'ok' })).resolves.toBeDefined();
    await expect(
      insertRequest({ requestId: 'no', accepted: false, rule: 'max_per_request', level: 'user' }),
    ).resolves.toBeDefined();
  });

  it('refuses a request for a user that belongs to another account', async () => {
    await expectViolation(
      insertRequest({ accountId: otherAccount.id }),
      FOREIGN_KEY_VIOLATION,
      'usage_requests_user_belongs_to_account',
    );
  });

  it('keeps the rejection fields consistent with the accepted flag', async () => {
    await expectViolation(
      insertRequest({ accepted: false }),
      CHECK_VIOLATION,
      'usage_requests_rejection_is_consistent',
    );
    await expectViolation(
      insertRequest({ accepted: true, rule: 'max_per_request', level: 'user' }),
      CHECK_VIOLATION,
      'usage_requests_rejection_is_consistent',
    );
    await expectViolation(
      insertRequest({ accepted: false, rule: 'monthly_allowance', level: null }),
      CHECK_VIOLATION,
      'usage_requests_rejection_is_consistent',
    );
  });

  it.each([
    ['an unknown rule', { accepted: false, rule: 'invented_rule', level: 'user' }],
    ['an unknown level', { accepted: false, rule: 'max_per_request', level: 'team' }],
    ['zero units', { units: 0 }],
    ['a period that is not the first of a month', { period: '2026-10-02' }],
    ['an empty request id', { requestId: '' }],
    ['a request id longer than 128 characters', { requestId: 'r'.repeat(129) }],
  ])('rejects %s', async (_label, overrides) => {
    await expectViolation(insertRequest(overrides), CHECK_VIOLATION);
  });

  it('requires the applied limits', async () => {
    await expectViolation(insertRequest({ limits: null }), NOT_NULL_VIOLATION);
  });

  it('forbids a second request with the same id in one account', async () => {
    await insertRequest({ requestId: 'same' });

    await expectViolation(
      insertRequest({ requestId: 'same' }),
      UNIQUE_VIOLATION,
      'usage_requests_unique_request_per_account',
    );
  });
});

describe('history protection', () => {
  it('refuses to delete an account or a user that still has history', async () => {
    await insertRequest();

    await expectViolation(pool.query('DELETE FROM users WHERE id = $1', [user.id]), FOREIGN_KEY_VIOLATION);
    await expectViolation(pool.query('DELETE FROM accounts WHERE id = $1', [account.id]), FOREIGN_KEY_VIOLATION);
  });

  it('refuses to delete a plan that is still in use', async () => {
    const planId = await createTestPlan(account.id, { scope: 'user', monthlyAllowance: 1, maxPerRequest: 1 });
    await createTestUser(account.id, { planId });

    await expectViolation(pool.query('DELETE FROM plans WHERE id = $1', [planId]), FOREIGN_KEY_VIOLATION);
  });
});