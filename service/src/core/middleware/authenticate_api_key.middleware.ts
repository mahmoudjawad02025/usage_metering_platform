import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app_error';
import { hashApiKey, looksLikeApiKey } from '../utils/api_key';
import { findAccountByApiKeyHash } from '../../modules/accounts/accounts.repository';

export const authenticateApiKey: RequestHandler = async (req, _res, next) => {
  const apiKey = req.header('x-api-key');
  if (!apiKey) throw new UnauthorizedError('Missing API key');
  if (!looksLikeApiKey(apiKey)) throw new UnauthorizedError('Invalid API key');

  const account = await findAccountByApiKeyHash(hashApiKey(apiKey));
  if (!account) throw new UnauthorizedError('Invalid API key');

  req.account = account;
  next();
};