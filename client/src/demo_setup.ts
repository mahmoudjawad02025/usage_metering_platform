import { config } from './config';
import { loadState, saveState } from './demo_state';
import {
  MeteringClient,
  ServiceError,
  createAccount,
  waitForService,
  type Plan,
} from './metering_client';
const DEMO_ACCOUNT_PLAN = {
  scope: 'account',
  name: 'Demo Tiny',
  monthlyAllowance: 100,
  maxPerRequest: 50,
} as const;
const DEMO_USER_PLAN = {
  scope: 'user',
  name: 'Demo Boost',
  monthlyAllowance: 1000,
  maxPerRequest: 100,
} as const;
function findPlan(plans: Plan[], scope: Plan['scope'], name: string): Plan {
  const plan = plans.find((candidate) => candidate.scope === scope && candidate.name === name);
  if (!plan) throw new Error(`The ${scope} plan "${name}" was not found`);
  return plan;
}
async function createDemoAccount(): Promise<MeteringClient> {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const created = await createAccount(config.SERVICE_URL, config.ADMIN_KEY, {
    name: `Acme Docs (demo ${stamp} UTC)`,
  });
  const client = new MeteringClient(config.SERVICE_URL, created.apiKey);
  const tinyAccountPlan = await client.createPlan(DEMO_ACCOUNT_PLAN);
  await client.changeAccountPlan(tinyAccountPlan.id);
  await client.createPlan(DEMO_USER_PLAN);
  const plans = (await client.listPlans()).items;
  await client.registerUser({ externalId: 'alice', planId: findPlan(plans, 'user', 'Basic').id });
  await client.registerUser({ externalId: 'bob', planId: findPlan(plans, 'user', 'Premium').id });
  await saveState({ apiKey: created.apiKey });
  console.log(`demo account created: ${created.account.name}`);
  return client;
}
export class DemoSession {
  private current: MeteringClient | null = null;
  get client(): MeteringClient {
    if (!this.current) throw new Error('The demo session is not ready yet');
    return this.current;
  }
  async start(): Promise<void> {
    await waitForService(config.SERVICE_URL);
    this.current = (await this.reuseSavedAccount()) ?? (await createDemoAccount());
  }
  async reset(): Promise<void> {
    this.current = await createDemoAccount();
  }
  private async reuseSavedAccount(): Promise<MeteringClient | null> {
    const state = await loadState();
    if (!state) return null;
    const client = new MeteringClient(config.SERVICE_URL, state.apiKey);
    try {
      const account = await client.getAccount();
      console.log(`reusing the saved demo account: ${account.name}`);
      return client;
    } catch (err) {
      if (err instanceof ServiceError && err.status === 401) {
        console.log('the saved API key is no longer valid, creating a new demo account');
        return null;
      }
      throw err;
    }
  }
}