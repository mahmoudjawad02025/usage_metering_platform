import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set. Copy it from .env.example into your .env file.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/helpers/global_setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: testDatabaseUrl,
    },
  },
});