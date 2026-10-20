import { config } from './config';
import { loadState, saveState } from './demo_state';
import {
  MeteringClient,
  ServiceError,
  createAccount,
  type AccountInfo,
  type Plan,
} from './metering_client';

const DEMO_ACCOUNT_PLAN = {
  scope: 'account' as const,
  name: 'Demo Tiny',
  monthlyAllowance: 100,
  maxPerRequest: 50,
};

const DEMO_USER_PLAN = {
  scope: 'user' as const,
  name: 'Demo Boost',
  monthlyAllowance: 1000,
  maxPerRequest: 100,
};

const DEMO_INTERN_PLAN = {
  scope: 'user' as const,
  name: 'Intern',
  monthlyAllowance: 200,
  maxPerRequest: 10,
};

function findPlan(plans: Plan[], scope: Plan['scope'], name: string): Plan {
  const plan = plans.find((candidate) => candidate.scope === scope && candidate.name === name);
  if (!plan) throw new Error(`The ${scope} plan "${name}" was not found`);
  return plan;
}

async function createDemoAccount(): Promise<{ client: MeteringClient; apiKey: string; account: AccountInfo }> {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const created = await createAccount(config.SERVICE_URL, config.ADMIN_KEY, {
    name: `Acme Docs (demo ${stamp} UTC)`,
  });
  const client = new MeteringClient(config.SERVICE_URL, created.apiKey);
  const tinyAccountPlan = await client.createPlan(DEMO_ACCOUNT_PLAN);
  await client.changeAccountPlan(tinyAccountPlan.id);
  await client.createPlan(DEMO_USER_PLAN);
  try {
    await client.createPlan(DEMO_INTERN_PLAN);
  } catch (err) {
    if (!(err instanceof ServiceError && err.status === 409)) throw err;
  }
  const plans = (await client.listPlans()).items;
  await client.registerUser({ externalId: 'alice', planId: findPlan(plans, 'user', 'Basic').id });
  await client.registerUser({ externalId: 'bob', planId: findPlan(plans, 'user', 'Premium').id });
  await saveState({ apiKey: created.apiKey });
  console.log(`demo account created: ${created.account.name}`);
  return { client, apiKey: created.apiKey, account: created.account };
}

async function reuseSavedAccount(): Promise<{
  client: MeteringClient;
  apiKey: string;
  account: AccountInfo;
} | null> {
  const state = await loadState();
  if (!state) return null;
  const client = new MeteringClient(config.SERVICE_URL, state.apiKey);
  try {
    const account = await client.getAccount();
    console.log(`reusing the saved demo account: ${account.name}`);
    return { client, apiKey: state.apiKey, account };
  } catch (err) {
    if (err instanceof ServiceError && err.status === 401) {
      console.log('the saved API key is no longer valid, creating a new demo account');
      return null;
    }
    throw err;
  }
}

/** Reuse saved demo key when valid; otherwise create a fresh demo account. */
export async function ensureDemoAccount(): Promise<{
  apiKey: string;
  account: AccountInfo;
}> {
  const reused = await reuseSavedAccount();
  if (reused) return { apiKey: reused.apiKey, account: reused.account };
  const created = await createDemoAccount();
  return { apiKey: created.apiKey, account: created.account };
}

/** Always create a brand-new demo account (sign-out + start demo again). */
export async function createFreshDemoAccount(): Promise<{
  apiKey: string;
  account: AccountInfo;
}> {
  const created = await createDemoAccount();
  return { apiKey: created.apiKey, account: created.account };
}
