import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

export function api() {
  return request(app);
}

export function adminKey(): string {
  return process.env.ADMIN_KEY ?? '';
}