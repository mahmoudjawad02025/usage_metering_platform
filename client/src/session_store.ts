import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

const COOKIE_NAME = 'session_id';
const sessions = new Map<string, string>();

export function createSession(apiKey: string): string {
  const sessionId = randomUUID();
  sessions.set(sessionId, apiKey);
  return sessionId;
}

export function getApiKey(sessionId: string): string | undefined {
  return sessions.get(sessionId);
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function readSessionId(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== COOKIE_NAME) continue;
    return decodeURIComponent(trimmed.slice(eq + 1).trim());
  }
  return undefined;
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`,
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}
