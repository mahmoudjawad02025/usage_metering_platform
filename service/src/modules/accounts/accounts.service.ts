import { DEFAULT_ACCOUNT_PLAN_ID } from '../../core/constants';
import { NotFoundError } from '../../core/errors/app_error';
import { generateApiKey, hashApiKey } from '../../core/utils/api_key';
import { getAssignablePlan } from '../plans/plans.service';
import * as accountsRepository from './accounts.repository';
import type { CreateAccountBody } from './accounts.schemas';
import type { Account, CreatedAccount } from './accounts.types';

export async function getAccount(accountId: string): Promise<Account> {
  const account = await accountsRepository.findAccountById(accountId);
  if (!account) throw new NotFoundError('Account not found');
  return account;
}

export async function createAccount(input: CreateAccountBody): Promise<CreatedAccount> {
  const plan = await getAssignablePlan(null, input.planId ?? DEFAULT_ACCOUNT_PLAN_ID, 'account');

  const apiKey = generateApiKey();
  const accountId = await accountsRepository.insertAccount(input.name, hashApiKey(apiKey), plan.id);

  return { account: await getAccount(accountId), apiKey };
}