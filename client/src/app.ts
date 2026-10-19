import express from 'express';
import type { Express, RequestHandler } from 'express';
import { createApiRouter } from './api.routes';
import { config } from './config';
import type { DemoSession } from './demo_setup';
import { apiNotFound, errorHandler } from './error_handler';
const allowDevelopmentCors: RequestHandler = (req, res, next) => {
  res.setHeader('access-control-allow-origin', config.CORS_ORIGIN ?? '');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
};
export function createApp(session: DemoSession): Express {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  if (config.CORS_ORIGIN) app.use(allowDevelopmentCors);
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', createApiRouter(session), apiNotFound);
  app.use(express.static(config.PUBLIC_DIR));
  app.use(errorHandler);
  return app;
}