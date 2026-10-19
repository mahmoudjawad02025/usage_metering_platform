import { runScenarios } from './scenario_runner';

runScenarios([
  {
    name: 'hot-account',
    description: '1 account x 100 users, huge limits: every request locks the same account counter row',
    seed: {
      accounts: 1,
      usersPerAccount: 100,
      accountPlan: { monthlyAllowance: 1_000_000_000, maxPerRequest: 1000 },
      userPlan: { monthlyAllowance: 1_000_000_000, maxPerRequest: 100 },
    },
    maxUnits: 10,
  },
  {
    name: 'hot-account-limited',
    description: '1 account x 100 users, account allowance of 5000 units: most requests are rejected',
    seed: {
      accounts: 1,
      usersPerAccount: 100,
      accountPlan: { monthlyAllowance: 5_000, maxPerRequest: 10 },
      userPlan: { monthlyAllowance: 1_000_000, maxPerRequest: 10 },
    },
    maxUnits: 10,
  },
  {
    name: 'hot-user-limited',
    description: '1 account x 1 user, user allowance of 3000 units: most requests are rejected',
    seed: {
      accounts: 1,
      usersPerAccount: 1,
      accountPlan: { monthlyAllowance: 1_000_000_000, maxPerRequest: 1000 },
      userPlan: { monthlyAllowance: 3_000, maxPerRequest: 10 },
    },
    maxUnits: 10,
  },
]).catch((err) => {
  console.error(err);
  process.exit(1);
});