import pg from 'pg';

export default async function setup(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL is not set');

  const url = new URL(testUrl);
  const databaseName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(databaseName)) {
    throw new Error(`Refusing to use "${databaseName}": test database names must end with _test`);
  }

  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${databaseName}`);
    }
  } finally {
    await admin.end();
  }
}