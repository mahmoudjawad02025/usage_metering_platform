import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVICE_DIRECTORY = path.join(__dirname, '../..');
const NODE_ARGUMENTS = ['--import', 'tsx', 'src/server.ts'];

function startServer(overrides: Record<string, string>): ChildProcess {
  return spawn(process.execPath, NODE_ARGUMENTS, {
    cwd: SERVICE_DIRECTORY,
    env: { ...process.env, LOG_LEVEL: 'info', ...overrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function exitCodeOf(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => child.once('exit', (code) => resolve(code)));
}

async function waitUntilHealthy(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // the server is not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('The server did not become healthy in time');
}

describe('starting the service with a wrong configuration', () => {
  it('stops with exit code 1 and names a too short admin key', () => {
    const result = spawnSync(process.execPath, NODE_ARGUMENTS, {
      cwd: SERVICE_DIRECTORY,
      env: { ...process.env, ADMIN_KEY: 'short' },
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid environment variables');
    expect(result.stderr).toContain('ADMIN_KEY');
  });

  it('stops with exit code 1 and names a missing database url', () => {
    const result = spawnSync(process.execPath, NODE_ARGUMENTS, {
      cwd: SERVICE_DIRECTORY,
      env: { ...process.env, DATABASE_URL: '' },
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('DATABASE_URL');
  });

  it('stops with exit code 1 when the port is not a valid port number', () => {
    const result = spawnSync(process.execPath, NODE_ARGUMENTS, {
      cwd: SERVICE_DIRECTORY,
      env: { ...process.env, PORT: '70000' },
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PORT');
  });
});

async function launchServer() {
  const port = 41000 + Math.floor(Math.random() * 4000);
  const baseUrl = `http://localhost:${port}`;
  const child = startServer({ PORT: String(port) });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const exited = exitCodeOf(child);
  await waitUntilHealthy(baseUrl);
  return { child, baseUrl, exited, readOutput: () => output };
}

describe('starting and stopping the real server process', () => {
  it('migrates and serves requests', async () => {
    const { child, baseUrl, exited } = await launchServer();

    try {
      const unauthorized = await fetch(`${baseUrl}/plans`);
      const unknown = await fetch(`${baseUrl}/nothing`);
      expect(unauthorized.status).toBe(401);
      expect(unknown.status).toBe(404);
    } finally {
      child.kill();
      await exited;
    }
  }, 40_000);

  // Windows has no SIGTERM: kill() ends the process at once and the exit code is null.
  // Docker runs Linux, where the signal is delivered, so the check stays for other systems.
  it.skipIf(process.platform === 'win32')('shuts down cleanly on SIGTERM', async () => {
    const { child, exited, readOutput } = await launchServer();

    child.kill('SIGTERM');

    expect(await exited).toBe(0);
    expect(readOutput()).toContain('usage metering service started');
    expect(readOutput()).toContain('shutting down');
  }, 40_000);
});