import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

export function api() {
  return request(app);
}

export function adminKey(): string {
  return process.env.ADMIN_KEY ?? '';
}

export function newRequestId(): string {
  return randomUUID();
}

export function consume(apiKey: string, body: { userId: string; units: number; requestId?: string }) {
  return api()
    .post('/usage/consume')
    .set('x-api-key', apiKey)
    .send({ requestId: newRequestId(), ...body });
} 