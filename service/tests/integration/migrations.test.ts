import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/db/migrate';

const SCRATCH_DATABASE = 'usage_metering_migration_scratch_test';

function urlFor(databaseName: string): string {
  const url = new URL(process.env.TEST_DATABASE_URL ?? '');
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function withScratchDatabase(work: (scratch: pg.Pool) => Promise<void>): Promise<void> {
  const admin = new pg.Client({ connectionString: urlFor('postgres') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${SCRATCH_DATABASE}`);

  const scratch = new pg.Pool({ connectionString: urlFor(SCRATCH_DATABASE), max: 5 });
  scratch.on('error', () => undefined);
  try {
    await work(scratch);
  } finally {
    await scratch.end();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DATABASE} WITH (FORCE)`);
    await admin.end();
  }
}

async function appliedFiles(scratch: pg.Pool): Promise<string[]> {
  const { rows } = await scratch.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename',
  );
  return rows.map((row) => row.filename);
}

async function tableExists(scratch: pg.Pool, table: string): Promise<boolean> {
  const { rows } = await scratch.query<{ found: boolean }>(
    'SELECT to_regclass($1) IS NOT NULL AS found',
    [`public.${table}`],
  );
  return rows[0]?.found ?? false;
}

async function countPredefinedPlans(scratch: pg.Pool): Promise<number> {
  const { rows } = await scratch.query<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM plans WHERE is_predefined',
  );
  return rows[0]?.total ?? 0;
}

describe('the real migrations on an empty database', () => {
  it('create the whole schema and the four predefined plans', async () => {
    await withScratchDatabase(async (scratch) => {
      await runMigrations({ pool: scratch });

      expect(await appliedFiles(scratch)).toEqual([
        '001_create_core_tables.sql',
        '002_create_usage_tables.sql',
        '003_seed_predefined_plans.sql',
      ]);
      for (const table of ['plans', 'accounts', 'users', 'account_usage', 'user_usage', 'usage_requests']) {
        expect(await tableExists(scratch, table)).toBe(true);
      }
      expect(await countPredefinedPlans(scratch)).toBe(4);
    });
  });

  it('do nothing the second time and never duplicate the predefined plans', async () => {
    await withScratchDatabase(async (scratch) => {
      await runMigrations({ pool: scratch });
      await runMigrations({ pool: scratch });

      expect(await appliedFiles(scratch)).toHaveLength(3);
      expect(await countPredefinedPlans(scratch)).toBe(4);
    });
  });

  it('are safe when three service instances start at the same time', async () => {
    await withScratchDatabase(async (scratch) => {
      await Promise.all([
        runMigrations({ pool: scratch }),
        runMigrations({ pool: scratch }),
        runMigrations({ pool: scratch }),
      ]);

      expect(await appliedFiles(scratch)).toHaveLength(3);
      expect(await countPredefinedPlans(scratch)).toBe(4);
    });
  });
});

describe('the migration runner with custom files', () => {
  it('rolls a failing file back completely and applies it later once it is fixed', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'migrations-'));
    try {
      await writeFile(path.join(directory, '001_good.sql'), 'CREATE TABLE good_one (id INTEGER);');
      await writeFile(
        path.join(directory, '002_bad.sql'),
        'CREATE TABLE half_done (id INTEGER); SELECT * FROM table_that_does_not_exist;',
      );

      await withScratchDatabase(async (scratch) => {
        await expect(runMigrations({ pool: scratch, directory })).rejects.toThrow(/table_that_does_not_exist/);

        expect(await tableExists(scratch, 'good_one')).toBe(true);
        expect(await tableExists(scratch, 'half_done')).toBe(false);
        expect(await appliedFiles(scratch)).toEqual(['001_good.sql']);

        await writeFile(path.join(directory, '002_bad.sql'), 'CREATE TABLE fixed_two (id INTEGER);');
        await runMigrations({ pool: scratch, directory });

        expect(await tableExists(scratch, 'fixed_two')).toBe(true);
        expect(await appliedFiles(scratch)).toEqual(['001_good.sql', '002_bad.sql']);
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('applies files in name order and ignores files that are not SQL', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'migrations-'));
    try {
      await writeFile(path.join(directory, '002_second.sql'), 'INSERT INTO ordered (step) VALUES (2);');
      await writeFile(path.join(directory, '001_first.sql'), 'CREATE TABLE ordered (step INTEGER); INSERT INTO ordered (step) VALUES (1);');
      await writeFile(path.join(directory, 'notes.txt'), 'this is not a migration');

      await withScratchDatabase(async (scratch) => {
        await runMigrations({ pool: scratch, directory });

        const { rows } = await scratch.query<{ step: number }>('SELECT step FROM ordered');
        expect(rows.map((row) => row.step)).toEqual([1, 2]);
        expect(await appliedFiles(scratch)).toEqual(['001_first.sql', '002_second.sql']);
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});