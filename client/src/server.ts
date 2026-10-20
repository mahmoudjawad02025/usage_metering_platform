import { existsSync } from 'node:fs';
import { createApp } from './app';
import { config } from './config';
import { waitForService } from './metering_client';

/** Clickable base URL for the log line. Override with PUBLIC_URL or CLIENT_HOST. */
function publicListenUrl(port: number): string {
  const override = process.env.PUBLIC_URL?.trim();
  if (override) {
    return override.endsWith('/') ? override : `${override}/`;
  }
  const host = process.env.CLIENT_HOST?.trim() || 'localhost';
  return `http://${host}:${port}/`;
}

async function main(): Promise<void> {
  if (!existsSync(config.PUBLIC_DIR)) {
    console.warn(
      `The Flutter build was not found at ${config.PUBLIC_DIR}. Run "flutter build web" in demo.`,
    );
  }
  await waitForService(config.SERVICE_URL);
  const server = createApp().listen(config.CLIENT_PORT, () => {
    console.log(`demo client listening at ${publicListenUrl(config.CLIENT_PORT)}`);
  });
  const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('failed to start the demo client', err);
  process.exit(1);
});
