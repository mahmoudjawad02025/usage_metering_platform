import { existsSync } from 'node:fs';
import { createApp } from './app';
import { config } from './config';
import { DemoSession } from './demo_setup';
async function main(): Promise<void> {
  if (!existsSync(config.PUBLIC_DIR)) {
    console.warn(`The Flutter build was not found at ${config.PUBLIC_DIR}. Run "flutter build web" in demo.`);
  }
  const session = new DemoSession();
  await session.start();
  const server = createApp(session).listen(config.CLIENT_PORT, () => {
    console.log(`demo client listening on port ${config.CLIENT_PORT}`);
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