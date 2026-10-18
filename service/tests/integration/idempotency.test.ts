import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool';
import { consumeUnits } from '../../src/modules/usage/usage.service';
import { closeDatabase, readConsumed, resetDatabase } from '../helpers/database';
import {
  createTestAccount,
  createTestPlan,
  createTestUser,
  type TestAccount,
  type TestUser,
} from '../helpers/factories';
import { consume } from '../helpers/test_app';

let account: TestAccount;
let user: TestUser;

beforeEach(async () => {
  await resetDatabase();
  account = await createTestAccount();
  user = await createTestUser(account.id);
});

afterAll(closeDatabase);

async function countLoggedRequests(): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM usage_requests WHERE account_id = $1',
    [account.id],
  );
  return rows[0]?.total ?? 0;
}

describe('retrying an accepted request', () => {
  it('returns the same decision and does not count the units twice', async () => {
    const first = await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'retry-1' });
    const retry = await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'retry-1' });

    expect(first.body.replayed).toBe(false);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual({ ...first.body, replayed: true });
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 10, user: 10 });
    expect(await countLoggedRequests()).toBe(1);
  });

  it('returns the balances from the moment of the decision, not the current ones', async () => {
    const first = await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'a' });
    await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'b' });

    const retryOfFirst = await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'a' });

    expect(retryOfFirst.body.account.consumed).toBe(10);
    expect(retryOfFirst.body).toEqual({ ...first.body, replayed: true });
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 20, user: 20 });
  });
});

describe('retrying a rejected request', () => {
  it('returns the original rejection even if the limits have changed since', async () => {
    const first = await consume(account.apiKey, { userId: user.id, units: 25, requestId: 'big-1' });
    expect(first.body.accepted).toBe(false);

    const biggerPlan = await createTestPlan(account.id, {
      scope: 'user',
      monthlyAllowance: 1000,
      maxPerRequest: 500,
    });
    await pool.query('UPDATE users SET plan_id = $2 WHERE id = $1', [user.id, biggerPlan]);

    const retry = await consume(account.apiKey, { userId: user.id, units: 25, requestId: 'big-1' });

    expect(retry.body).toEqual({ ...first.body, replayed: true });
    expect(retry.body.accepted).toBe(false);
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 0, user: 0 });
  });
});

describe('reusing a request id with a different payload', () => {
  it('returns 409 when the units differ and consumes nothing', async () => {
    await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'same-id' });

    const res = await consume(account.apiKey, { userId: user.id, units: 11, requestId: 'same-id' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REQUEST_ID_REUSED');
    expect(await readConsumed(account.id, user.id)).toEqual({ account: 10, user: 10 });
  });

  it('returns 409 when the user differs', async () => {
    const otherUser = await createTestUser(account.id);
    await consume(account.apiKey, { userId: user.id, units: 10, requestId: 'same-id' });

    const res = await consume(account.apiKey, { userId: otherUser.id, units: 10, requestId: 'same-id' });

    expect(res.status).toBe(409);
    expect(await readConsumed(account.id, otherUser.id)).toEqual({ account: 10, user: 0 });
  });
});

describe('scope of a request id', () => {
  it('is unique per account, so two accounts can use the same id', async () => {
    const otherAccount = await createTestAccount();
    const otherUser = await createTestUser(otherAccount.id);

    const mine = await consume(account.apiKey, { userId: user.id, units: 5, requestId: 'shared-id' });
    const theirs = await consume(otherAccount.apiKey, {
      userId: otherUser.id,
      units: 7,
      requestId: 'shared-id',
    });

    expect(mine.body.replayed).toBe(false);
    expect(theirs.body.replayed).toBe(false);
    expect(theirs.body.units).toBe(7);
  });

  it('still replays a request that was made in an earlier month', async () => {
    const september = new Date('2026-09-30T23:59:59Z');
    const october = new Date('2026-10-01T00:00:01Z');
    const input = { userId: user.id, units: 10, requestId: 'month-end' };

    const first = await consumeUnits(account.id, input, september);
    const retry = await consumeUnits(account.id, input, october);

    expect(first.period).toBe('2026-09');
    expect(retry).toEqual({ ...first, replayed: true });
    const { rows } = await pool.query<{ total: number }>(
      "SELECT COALESCE(SUM(consumed), 0)::int AS total FROM account_usage WHERE period = '2026-10-01'",
    );
    expect(rows[0]?.total).toBe(0);
  });
});