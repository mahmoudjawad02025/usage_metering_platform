import type { RequestHandler } from 'express';
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/app_error';
import { secretsMatch } from '../utils/api_key';

export const authenticateAdmin: RequestHandler = (req, _res, next) => {
  const adminKey = req.header('x-admin-key');
  if (!adminKey) throw new UnauthorizedError('Missing admin key');
  if (!secretsMatch(adminKey, env.ADMIN_KEY)) throw new UnauthorizedError('Invalid admin key');
  next();
};