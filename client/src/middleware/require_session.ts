import type { RequestHandler } from 'express';
import { config } from '../config';
import { MeteringClient } from '../metering_client';
import { getApiKey, readSessionId } from '../session_store';

export const requireSession: RequestHandler = (req, res, next) => {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Sign in required' },
    });
    return;
  }
  const apiKey = getApiKey(sessionId);
  if (!apiKey) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Sign in required' },
    });
    return;
  }
  req.sessionId = sessionId;
  req.metering = new MeteringClient(config.SERVICE_URL, apiKey);
  next();
};
