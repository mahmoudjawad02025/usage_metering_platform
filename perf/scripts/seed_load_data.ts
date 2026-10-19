import {
    assignAccountPlan,
    createAccount,
    createPlan,
    registerUser,
    type LoadAccount,
    type PlanLimits,
  } from './service_api';
  
  export interface SeedOptions {
    name: string;
    accounts: number;
    usersPerAccount: number;
    accountPlan: PlanLimits;
    userPlan: PlanLimits;
  }
  
  const USER_BATCH_SIZE = 20;
  
  async function seedAccount(options: SeedOptions, index: number): Promise<LoadAccount> {
    const created = await createAccount(`${options.name}-${index}`);
    const apiKey = created.apiKey;
  
    const accountPlan = await createPlan(apiKey, { scope: 'account', name: 'Load Account', ...options.accountPlan });
    await assignAccountPlan(apiKey, accountPlan.id);
    const userPlan = await createPlan(apiKey, { scope: 'user', name: 'Load User', ...options.userPlan });
  
    const userIds: string[] = [];
    for (let start = 0; start < options.usersPerAccount; start += USER_BATCH_SIZE) {
      const size = Math.min(USER_BATCH_SIZE, options.usersPerAccount - start);
      const batch = await Promise.all(
        Array.from({ length: size }, (_, offset) =>
          registerUser(apiKey, `load-user-${start + offset}`, userPlan.id),
        ),
      );
      userIds.push(...batch.map((user) => user.id));
    }
  
    return { accountId: created.account.id, apiKey, userIds };
  }
  
  export async function seedLoadData(options: SeedOptions): Promise<LoadAccount[]> {
    const accounts: LoadAccount[] = [];
    for (let index = 0; index < options.accounts; index += 1) {
      accounts.push(await seedAccount(options, index));
    }
    return accounts;
  }