import { DEFAULT_USER_PLAN_ID } from '../../core/constants';
import { ConflictError, NotFoundError } from '../../core/errors/app_error';
import { buildPage, type Page } from '../../core/utils/pagination';
import { isUniqueViolation } from '../../db/pg_errors';
import { getAssignablePlan } from '../plans/plans.service';
import * as usersRepository from './users.repository';
import type { ListUsersQuery, RegisterUserBody } from './users.schemas';
import type { User } from './users.types';

const EXTERNAL_ID_CONSTRAINT = 'users_unique_external_id_per_account';

export async function getUser(accountId: string, userId: string): Promise<User> {
  const user = await usersRepository.findUserById(accountId, userId);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function listUsers(accountId: string, query: ListUsersQuery): Promise<Page<User>> {
  const { items, total } = await usersRepository.listUsers(accountId, query);
  return buildPage(items, total, query);
}

export async function registerUser(accountId: string, input: RegisterUserBody): Promise<User> {
  const plan = await getAssignablePlan(accountId, input.planId ?? DEFAULT_USER_PLAN_ID, 'user');

  try {
    const userId = await usersRepository.insertUser(accountId, input.externalId, plan.id);
    return await getUser(accountId, userId);
  } catch (err) {
    if (isUniqueViolation(err, EXTERNAL_ID_CONSTRAINT)) {
      throw new ConflictError(`A user with externalId "${input.externalId}" already exists`);
    }
    throw err;
  }
}

export async function changeUserPlan(
  accountId: string,
  userId: string,
  planId: string,
): Promise<User> {
  await getUser(accountId, userId);
  const plan = await getAssignablePlan(accountId, planId, 'user');

  const updated = await usersRepository.updateUserPlan(accountId, userId, plan.id);
  if (!updated) throw new NotFoundError('User not found');

  return getUser(accountId, userId);
}