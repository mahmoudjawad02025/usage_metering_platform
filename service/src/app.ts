import express from 'express';
import type { Express } from 'express';
import { pool } from './db/pool';

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (err) {
        console.error('health check failed:', err);
        res.status(503).json({ status: 'unavailable' });
    }
  });

  return app;
}