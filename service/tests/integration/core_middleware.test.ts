import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool';
import { runMigrations } from '../../src/db/migrate';
import { authenticateApiKey } from '../../src/core/middleware/authenticate_api_key.middleware';
import { authenticateAdmin } from '../../src/core/middleware/authenticate_admin.middleware';
import { validate } from '../../src/core/middleware/validate.middleware';
import {
  errorHandler,
  notFoundHandler,
} from '../../src/core/middleware/error_handler.middleware';
import { generateApiKey, hashApiKey } from '../../src/core/utils/api_key';
import { paginationQuerySchema } from '../../src/core/utils/pagination';
import { NotFoundError } from '../../src/core/errors/app_error';

const STARTER_PLAN_ID = 'a0000000-0000-4000-8000-000000000001';

const app = express();
app.use(express.json({ limit: '1kb' }));

app.get('/whoami', authenticateApiKey, (req, res) => {
  res.json({ id: req.account?.id });
});
app.post('/admin-only', authenticateAdmin, (_req, res) => {
  res.json({ ok: true });
});
app.post(
  '/echo',
  validate({ body: z.object({ units: z.number().int().positive() }) }),
  (req, res) => {
    res.json(req.body);
  },
);
app.get('/list', validate({ query: paginationQuerySchema }), (req, res) => {
  res.json(req.query);
});
app.get('/known-error', async () => {
  throw new NotFoundError('nope');
});
app.get('/unknown-error', async () => {
  throw new Error('secret internals');
});
app.use(notFoundHandler);
app.use(errorHandler);

const apiKey = generateApiKey();
let accountId = '';

beforeAll(async () => {
  await runMigrations();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO accounts (name, api_key_hash, plan_id)
     VALUES ('core-middleware-test', $1, $2) RETURNING id`,
    [hashApiKey(apiKey), STARTER_PLAN_ID],
  );
  accountId = rows[0]!.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM accounts WHERE id = $1', [accountId]);
  await pool.end();
});

describe('authenticateApiKey', () => {
  it('rejects a missing key with 401', async () => {
    const res = await request(app).get('/whoami');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed key with 401', async () => {
    const res = await request(app).get('/whoami').set('x-api-key', 'abc');
    expect(res.status).toBe(401);
  });

  it('rejects a well-formed but unknown key with 401', async () => {
    const res = await request(app).get('/whoami').set('x-api-key', generateApiKey());
    expect(res.status).toBe(401);
  });

  it('accepts a valid key and attaches the account', async () => {
    const res = await request(app).get('/whoami').set('x-api-key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(accountId);
  });
});

describe('authenticateAdmin', () => {
  it('requires the correct admin key', async () => {
    expect((await request(app).post('/admin-only')).status).toBe(401);
    expect((await request(app).post('/admin-only').set('x-admin-key', 'wrong')).status).toBe(401);
    const ok = await request(app).post('/admin-only').set('x-admin-key', process.env.ADMIN_KEY ?? '');
    expect(ok.status).toBe(200);
  });
});

describe('validate', () => {
  it.each([0, -1, 1.5, '5', undefined])('rejects units = %j', async (units) => {
    const res = await request(app).post('/echo').send({ units });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('units');
  });

  it('passes valid input through', async () => {
    const res = await request(app).post('/echo').send({ units: 10 });
    expect(res.body).toEqual({ units: 10 });
  });

  it('applies query defaults and limits', async () => {
    expect((await request(app).get('/list')).body).toEqual({ limit: 20, offset: 0 });
    expect((await request(app).get('/list?limit=5&offset=10')).body).toEqual({ limit: 5, offset: 10 });
    expect((await request(app).get('/list?limit=1000')).status).toBe(400);
  });
});

describe('error handling', () => {
  it('maps invalid JSON to 400 and oversized bodies to 413', async () => {
    const bad = await request(app)
      .post('/echo')
      .set('content-type', 'application/json')
      .send('{bad');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');

    const big = await request(app).post('/echo').send({ units: 1, padding: 'x'.repeat(5000) });
    expect(big.status).toBe(413);
  });

  it('uses the status of known errors and hides unknown ones', async () => {
    expect((await request(app).get('/known-error')).status).toBe(404);

    const crash = await request(app).get('/unknown-error');
    expect(crash.status).toBe(500);
    expect(JSON.stringify(crash.body)).not.toContain('secret');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});