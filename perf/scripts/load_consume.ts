import { runScenarios } from './scenario_runner';

runScenarios([
  {
    name: 'spread',
    description: '20 accounts x 50 users, limits so high that every request is accepted',
    seed: {
      accounts: 20,
      usersPerAccount: 50,
      accountPlan: { monthlyAllowance: 1_000_000_000, maxPerRequest: 1000 },
      userPlan: { monthlyAllowance: 1_000_000_000, maxPerRequest: 100 },
    },
    maxUnits: 10,
  },
]).catch((err) => {
  console.error(err);
  process.exit(1);
});