import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ScenarioReport } from './scenario_runner';

const RESULTS_DIR = path.join(__dirname, '..', 'results');

async function loadReports(): Promise<ScenarioReport[]> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const files = (await readdir(RESULTS_DIR)).filter((file) => file.endsWith('.json')).sort();
  const reports: ScenarioReport[] = [];
  for (const file of files) {
    reports.push(JSON.parse(await readFile(path.join(RESULTS_DIR, file), 'utf8')) as ScenarioReport);
  }
  return reports.sort(
    (a, b) => a.scenario.localeCompare(b.scenario) || a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
}

function row(report: ScenarioReport): string {
  const { results, outcomes, verification } = report;
  return [
    report.scenario,
    report.label,
    results.requestsPerSecond.toFixed(0),
    results.latencyMs.p50,
    results.latencyMs.p99,
    outcomes.accepted,
    outcomes.rejected,
    results.non2xx + results.errors + results.timeouts,
    verification.passed ? 'pass' : 'FAIL',
  ].join(' | ');
}

async function main(): Promise<void> {
  const reports = await loadReports();
  const lines = [
    '| scenario | label | requests/s | p50 ms | p99 ms | accepted | rejected | failures | invariants |',
    '| :-- | :-- | --: | --: | --: | --: | --: | --: | :-- |',
    ...reports.map((report) => `| ${row(report)} |`),
  ];
  const text = `${lines.join('\n')}\n`;
  await writeFile(path.join(RESULTS_DIR, 'summary.md'), text);
  console.log(text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});