import express from 'express';
import type { Express } from 'express';
import { pool } from './db/pool';
import { authenticateApiKey } from './core/middleware/authenticate_api_key.middleware';
import { errorHandler, notFoundHandler } from './core/middleware/error_handler.middleware';
import { plansRouter } from './modules/plans/plans.routes';

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/plans', authenticateApiKey, plansRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}