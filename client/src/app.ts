import express from 'express';
import type { Express, RequestHandler } from 'express';
import { config } from './config';
import { apiNotFound, errorHandler } from './error_handler';
import { createAccountRouter } from './routes/account.routes';
import { createAuthRouter } from './routes/auth.routes';
import { createPlansRouter } from './routes/plans.routes';
import { createUsageRouter } from './routes/usage.routes';
import { createUsersRouter } from './routes/users.routes';

const allowDevelopmentCors: RequestHandler = (req, res, next) => {
  res.setHeader('access-control-allow-origin', config.CORS_ORIGIN ?? '');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
};

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  if (config.CORS_ORIGIN) app.use(allowDevelopmentCors);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = express.Router();
  api.use('/auth', createAuthRouter());
  api.use('/account', createAccountRouter());
  api.use('/plans', createPlansRouter());
  api.use('/users', createUsersRouter());
  api.use('/usage', createUsageRouter());
  app.use('/api', api, apiNotFound);

  app.use(express.static(config.PUBLIC_DIR));
  app.use(errorHandler);
  return app;
}
