import { randomUUID } from 'node:crypto';
import { pool } from '../../src/db/pool';
import { DEFAULT_ACCOUNT_PLAN_ID, DEFAULT_USER_PLAN_ID } from '../../src/core/constants';
import { generateApiKey, hashApiKey } from '../../src/core/utils/api_key';

export interface TestAccount {
  id: string;
  name: string;
  apiKey: string;
}

export interface TestUser {
  id: string;
  externalId: string;
}

export interface TestPlanInput {
  scope: 'account' | 'user';
  name?: string;
  monthlyAllowance: number;
  maxPerRequest: number;
}

export async function createTestAccount(
  options: { name?: string; planId?: string } = {},
): Promise<TestAccount> {
  const apiKey = generateApiKey();
  const name = options.name ?? `account-${randomUUID().slice(0, 8)}`;
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO accounts (name, api_key_hash, plan_id) VALUES ($1, $2, $3) RETURNING id',
    [name, hashApiKey(apiKey), options.planId ?? DEFAULT_ACCOUNT_PLAN_ID],
  );
  return { id: rows[0]!.id, name, apiKey };
}

export async function createTestPlan(accountId: string, input: TestPlanInput): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO plans (account_id, scope, name, monthly_allowance, max_per_request, is_predefined)
     VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
    [
      accountId,
      input.scope,
      input.name ?? `plan-${randomUUID().slice(0, 8)}`,
      input.monthlyAllowance,
      input.maxPerRequest,
    ],
  );
  return rows[0]!.id;
}

export async function createTestUser(
  accountId: string,
  options: { externalId?: string; planId?: string } = {},
): Promise<TestUser> {
  const externalId = options.externalId ?? `user-${randomUUID().slice(0, 8)}`;
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO users (account_id, external_id, plan_id) VALUES ($1, $2, $3) RETURNING id',
    [accountId, externalId, options.planId ?? DEFAULT_USER_PLAN_ID],
  );
  return { id: rows[0]!.id, externalId };
}