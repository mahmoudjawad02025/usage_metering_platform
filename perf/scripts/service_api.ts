import { settings } from './config';

export interface PlanLimits {
  monthlyAllowance: number;
  maxPerRequest: number;
}

export interface LoadAccount {
  accountId: string;
  apiKey: string;
  userIds: string[];
}

interface CallOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const response = await fetch(`${settings.serviceUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} answered ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

export function createAccount(name: string): Promise<{ apiKey: string; account: { id: string } }> {
  return call('/accounts', { method: 'POST', body: { name }, headers: { 'x-admin-key': settings.adminKey } });
}

export function createPlan(
  apiKey: string,
  input: { scope: 'account' | 'user'; name: string } & PlanLimits,
): Promise<{ id: string }> {
  return call('/plans', { method: 'POST', body: input, headers: { 'x-api-key': apiKey } });
}

export function assignAccountPlan(apiKey: string, planId: string): Promise<unknown> {
  return call('/accounts/me/plan', { method: 'PUT', body: { planId }, headers: { 'x-api-key': apiKey } });
}

export function registerUser(apiKey: string, externalId: string, planId: string): Promise<{ id: string }> {
  return call('/users', { method: 'POST', body: { externalId, planId }, headers: { 'x-api-key': apiKey } });
}