import { describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool';
import { api } from '../helpers/test_app';

describe('GET /health', () => {
  it('reports ok while the database is reachable', async () => {
    const res = await api().get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('requests the application cannot route or parse', () => {
  it('answers an unknown route with a JSON 404', async () => {
    const res = await api().get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Route not found: GET /does-not-exist',
    });
  });

  it('answers a body that is not valid JSON with 400', async () => {
    const res = await api()
      .post('/accounts')
      .set('content-type', 'application/json')
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('answers a body above 100 kilobytes with 413', async () => {
    const res = await api()
      .post('/accounts')
      .send({ name: 'x'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('GET /health when the database is down', () => {
  it('reports unavailable with status 503', async () => {
    await pool.end();

    const res = await api().get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable' });
  });
});