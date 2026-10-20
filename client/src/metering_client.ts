import { setTimeout as sleep } from 'node:timers/promises';

export type PlanScope = 'account' | 'user';

export interface PlanView {
  id: string;
  name: string;
  monthlyAllowance: number;
  maxPerRequest: number;
}

export interface Plan extends PlanView {
  scope: PlanScope;
  isPredefined: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LevelView {
  plan: PlanView;
  consumed: number;
  remaining: number;
}

export interface UserLevelView extends LevelView {
  id: string;
  externalId: string;
}

export interface Rejection {
  rule: 'max_per_request' | 'monthly_allowance';
  level: 'account' | 'user';
  limit: number;
  remaining?: number;
}

export interface AppliedLimitSnapshot {
  planId: string;
  planName: string;
  monthlyAllowance: number;
  maxPerRequest: number;
  consumedBefore: number;
}

export interface AppliedLimits {
  account: AppliedLimitSnapshot;
  user: AppliedLimitSnapshot;
}

export interface ConsumeResult {
  accepted: boolean;
  replayed: boolean;
  requestId: string;
  units: number;
  period: string;
  rejection: Rejection | null;
  account: LevelView;
  user: LevelView & { id: string };
}

export interface HistoryItem {
  id: string;
  requestId: string;
  userId: string;
  units: number;
  period: string;
  accepted: boolean;
  rejection: Rejection | null;
  appliedLimits: AppliedLimits;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface UsageSummary {
  period: string;
  account: LevelView;
  users: Page<UserLevelView>;
}

export interface UserUsageResult {
  period: string;
  user: UserLevelView;
}

export interface AccountInfo {
  id: string;
  name: string;
  plan: Plan;
  createdAt?: string;
}

export interface UserInfo {
  id: string;
  externalId: string;
  plan: Plan;
  createdAt?: string;
}

export interface CreatedAccount {
  account: AccountInfo;
  apiKey: string;
}

export interface NewPlanInput {
  scope: PlanScope;
  name: string;
  monthlyAllowance: number;
  maxPerRequest: number;
}

export interface UpdatePlanInput {
  name?: string;
  monthlyAllowance?: number;
  maxPerRequest?: number;
}

export interface ConsumeInput {
  userId: string;
  units: number;
  requestId: string;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface ListPlansQuery extends PaginationQuery {
  scope?: PlanScope;
}

export interface UsageQuery extends PaginationQuery {
  period?: string;
}

export interface HistoryQuery extends PaginationQuery {
  userId?: string;
  accepted?: boolean;
  period?: string;
}

export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

function parseJson(text: string): unknown {
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readError(
  payload: unknown,
  status: number,
): { code: string; message: string; details?: unknown } {
  const fallback = {
    code: 'SERVICE_ERROR',
    message: `Metering service answered with status ${status}`,
  };
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback;
  const error = (payload as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) return fallback;
  const { code, message, details } = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  return {
    code: typeof code === 'string' ? code : fallback.code,
    message: typeof message === 'string' ? message : fallback.message,
    details,
  };
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

interface RequestInput {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(baseUrl: string, path: string, input: RequestInput = {}): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
    method: input.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...input.headers },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const payload = parseJson(await response.text());
  if (!response.ok) {
    const error = readError(payload, response.status);
    throw new ServiceError(response.status, error.code, error.message, error.details);
  }
  return payload as T;
}

export function createAccount(
  baseUrl: string,
  adminKey: string,
  input: { name: string; planId?: string },
): Promise<CreatedAccount> {
  return request<CreatedAccount>(baseUrl, '/accounts', {
    method: 'POST',
    body: input,
    headers: { 'x-admin-key': adminKey },
  });
}

export async function waitForService(baseUrl: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await request(baseUrl, '/health');
      return;
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`The metering service at ${baseUrl} did not become healthy in time`);
      }
      await sleep(1000);
    }
  }
}

export class MeteringClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    return request<T>(this.baseUrl, path, {
      method,
      body,
      headers: { 'x-api-key': this.apiKey },
    });
  }

  getAccount(): Promise<AccountInfo> {
    return this.call<AccountInfo>('/accounts/me');
  }

  changeAccountPlan(planId: string): Promise<AccountInfo> {
    return this.call<AccountInfo>('/accounts/me/plan', 'PUT', { planId });
  }

  listPlans(query: ListPlansQuery = {}): Promise<Page<Plan>> {
    return this.call<Page<Plan>>(
      `/plans${toQuery({
        scope: query.scope,
        limit: query.limit ?? 100,
        offset: query.offset,
      })}`,
    );
  }

  getPlan(id: string): Promise<Plan> {
    return this.call<Plan>(`/plans/${id}`);
  }

  createPlan(input: NewPlanInput): Promise<Plan> {
    return this.call<Plan>('/plans', 'POST', input);
  }

  updatePlan(id: string, input: UpdatePlanInput): Promise<Plan> {
    return this.call<Plan>(`/plans/${id}`, 'PATCH', input);
  }

  registerUser(input: { externalId: string; planId?: string }): Promise<UserInfo> {
    return this.call<UserInfo>('/users', 'POST', input);
  }

  listUsers(query: PaginationQuery = {}): Promise<Page<UserInfo>> {
    return this.call<Page<UserInfo>>(
      `/users${toQuery({ limit: query.limit ?? 20, offset: query.offset })}`,
    );
  }

  getUser(id: string): Promise<UserInfo> {
    return this.call<UserInfo>(`/users/${id}`);
  }

  changeUserPlan(userId: string, planId: string): Promise<UserInfo> {
    return this.call<UserInfo>(`/users/${userId}/plan`, 'PUT', { planId });
  }

  consume(input: ConsumeInput): Promise<ConsumeResult> {
    return this.call<ConsumeResult>('/usage/consume', 'POST', input);
  }

  getUsage(query: UsageQuery = {}): Promise<UsageSummary> {
    return this.call<UsageSummary>(
      `/usage${toQuery({
        period: query.period,
        limit: query.limit ?? 100,
        offset: query.offset,
      })}`,
    );
  }

  getUserUsage(userId: string, period?: string): Promise<UserUsageResult> {
    return this.call<UserUsageResult>(
      `/usage/users/${userId}${toQuery({ period })}`,
    );
  }

  getHistory(query: HistoryQuery = {}): Promise<Page<HistoryItem>> {
    return this.call<Page<HistoryItem>>(
      `/usage/history${toQuery({
        userId: query.userId,
        accepted: query.accepted === undefined ? undefined : query.accepted ? 'true' : 'false',
        period: query.period,
        limit: query.limit ?? 20,
        offset: query.offset,
      })}`,
    );
  }
}
