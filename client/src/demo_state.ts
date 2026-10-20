import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';
export interface DemoState {
  apiKey: string;
}
export async function loadState(): Promise<DemoState | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(config.STATE_FILE, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'apiKey' in parsed && typeof parsed.apiKey === 'string') {
      return { apiKey: parsed.apiKey };
    }
    return null;
  } catch {
    return null;
  }
}
export async function saveState(state: DemoState): Promise<void> {
  await mkdir(path.dirname(config.STATE_FILE), { recursive: true });
  await writeFile(config.STATE_FILE, JSON.stringify(state), { mode: 0o600 });
}