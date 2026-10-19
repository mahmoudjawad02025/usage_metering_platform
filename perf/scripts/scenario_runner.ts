import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import autocannon from 'autocannon';
import { settings } from './config';
import { seedLoadData, type SeedOptions } from './seed_load_data';
import type { LoadAccount, PlanLimits } from './service_api';
import { verifyInvariants, type Verification } from './verify_invariants';

export interface Scenario {
  name: string;
  description: string;
  seed: Omit<SeedOptions, 'name'>;
  maxUnits: number;
}

export interface ScenarioReport {
  label: string;
  notes: string;
  scenario: string;
  description: string;
  startedAt: string;
  environment: { node: string; platform: string; cpus: number; cpuModel: string; memoryGb: number; serviceUrl: string };
  parameters: {
    connections: number;
    durationSeconds: number;
    warmupSeconds: number;
    accounts: number;
    usersPerAccount: number;
    maxUnits: number;
    accountPlan: PlanLimits;
    userPlan: PlanLimits;
  };
  results: {
    requestsPerSecond: number;
    totalRequests: number;
    latencyMs: { average: number; p50: number; p97_5: number; p99: number; max: number };
    successfulResponses: number;
    non2xx: number;
    errors: number;
    timeouts: number;
  };
  outcomes: { accepted: number; rejected: number };
  verification: Verification;
}

interface Target {
  apiKey: string;
  userId: string;
}

const RESULTS_DIR = path.join(__dirname, '..', 'results');
const HUGE_ACCOUNT_PLAN: PlanLimits = { monthlyAllowance: 1_000_000_000, maxPerRequest: 1000 };
const HUGE_USER_PLAN: PlanLimits = { monthlyAllowance: 1_000_000_000, maxPerRequest: 100 };

function toTargets(accounts: LoadAccount[]): Target[] {
  return accounts.flatMap((account) => account.userIds.map((userId) => ({ apiKey: account.apiKey, userId })));
}

function fire(targets: Target[], seconds: number, idPrefix: string, maxUnits: number) {
  let counter = 0;
  return autocannon({
    url: settings.serviceUrl,
    connections: settings.connections,
    duration: seconds,
    timeout: 30,
    requests: [
      {
        method: 'POST',
        path: '/usage/consume',
        headers: { 'content-type': 'application/json' },
        setupRequest: (request) => {
          const target = targets[Math.floor(Math.random() * targets.length)];
          if (!target) throw new Error('There are no load targets');
          counter += 1;
          request.headers = { ...request.headers, 'x-api-key': target.apiKey };
          request.body = JSON.stringify({
            userId: target.userId,
            units: 1 + Math.floor(Math.random() * maxUnits),
            requestId: `${idPrefix}${counter}`,
          });
          return request;
        },
      },
    ],
  });
}

async function runScenario(scenario: Scenario): Promise<ScenarioReport> {
  console.log(`\n== ${scenario.name}: ${scenario.description}`);
  const accounts = await seedLoadData({ name: scenario.name, ...scenario.seed });
  const startedAt = new Date().toISOString();

  const result = await fire(toTargets(accounts), settings.durationSeconds, `${scenario.name}-`, scenario.maxUnits);
  await sleep(1500);

  const verification = await verifyInvariants({
    accountIds: accounts.map((account) => account.accountId),
    successfulResponses: result['2xx'],
    connections: settings.connections,
  });
  const outcomes = await countOutcomes(accounts);

  const cpus = os.cpus();
  const report: ScenarioReport = {
    label: settings.label,
    notes: settings.notes,
    scenario: scenario.name,
    description: scenario.description,
    startedAt,
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      cpus: cpus.length,
      cpuModel: cpus[0]?.model ?? 'unknown',
      memoryGb: Math.round(os.totalmem() / 1024 ** 3),
      serviceUrl: settings.serviceUrl,
    },
    parameters: {
      connections: settings.connections,
      durationSeconds: settings.durationSeconds,
      warmupSeconds: settings.warmupSeconds,
      accounts: scenario.seed.accounts,
      usersPerAccount: scenario.seed.usersPerAccount,
      maxUnits: scenario.maxUnits,
      accountPlan: scenario.seed.accountPlan,
      userPlan: scenario.seed.userPlan,
    },
    results: {
      requestsPerSecond: result.requests.average,
      totalRequests: result.requests.total,
      latencyMs: {
        average: result.latency.average,
        p50: result.latency.p50,
        p97_5: result.latency.p97_5,
        p99: result.latency.p99,
        max: result.latency.max,
      },
      successfulResponses: result['2xx'],
      non2xx: result.non2xx,
      errors: result.errors,
      timeouts: result.timeouts,
    },
    outcomes,
    verification,
  };

  await saveReport(report);
  printReport(report);
  return report;
}

async function countOutcomes(accounts: LoadAccount[]): Promise<{ accepted: number; rejected: number }> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: settings.databaseUrl, max: 1 });
  try {
    const { rows } = await pool.query<{ accepted: boolean; total: number }>(
      `SELECT accepted, COUNT(*)::int AS total FROM usage_requests
       WHERE account_id = ANY($1::uuid[]) GROUP BY accepted`,
      [accounts.map((account) => account.accountId)],
    );
    return {
      accepted: rows.find((row) => row.accepted)?.total ?? 0,
      rejected: rows.find((row) => !row.accepted)?.total ?? 0,
    };
  } finally {
    await pool.end();
  }
}

async function saveReport(report: ScenarioReport): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${report.label}__${report.scenario}.json`);
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`saved ${file}`);
}

function printReport(report: ScenarioReport): void {
  const { results, outcomes, verification } = report;
  console.log(`requests per second: ${results.requestsPerSecond.toFixed(0)}`);
  console.log(
    `latency ms: avg ${results.latencyMs.average.toFixed(1)}, p50 ${results.latencyMs.p50}, p99 ${results.latencyMs.p99}, max ${results.latencyMs.max}`,
  );
  console.log(
    `responses: ${results.successfulResponses} ok, ${results.non2xx} non-2xx, ${results.errors} errors, ${results.timeouts} timeouts`,
  );
  console.log(`decisions: ${outcomes.accepted} accepted, ${outcomes.rejected} rejected`);
  for (const check of verification.checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`);
  }
}

export async function runScenarios(scenarios: Scenario[]): Promise<void> {
  const warmup = await seedLoadData({
    name: 'warmup',
    accounts: 1,
    usersPerAccount: 5,
    accountPlan: HUGE_ACCOUNT_PLAN,
    userPlan: HUGE_USER_PLAN,
  });
  console.log(`label "${settings.label}": warming up for ${settings.warmupSeconds}s`);
  await fire(toTargets(warmup), settings.warmupSeconds, 'warmup-', 10);

  let failed = false;
  for (const scenario of scenarios) {
    const report = await runScenario(scenario);
    if (!report.verification.passed || report.results.non2xx > 0) failed = true;
  }
  if (failed) {
    console.error('\nAt least one scenario failed verification or returned non-2xx answers.');
    process.exitCode = 1;
  }
}