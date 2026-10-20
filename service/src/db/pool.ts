import pg from 'pg';
import { env } from '../config/env';
import { logger } from '../core/logger';

const { Pool, types } = pg;

const PG_TYPE_DATE = 1082;
const PG_TYPE_INT8 = 20;

// Keep DATE as a string so Node does not shift the day across timezones.
// BIGINT as number is safe for our counters (well below Number.MAX_SAFE_INTEGER).
types.setTypeParser(PG_TYPE_DATE, (value: string) => value);
types.setTypeParser(PG_TYPE_INT8, (value: string) => Number.parseInt(value, 10));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
});

pool.on('error', (err) => {
  logger.error({ err }, 'unexpected error on idle database client');
});

export async function closePool(): Promise<void> {
  await pool.end();
}