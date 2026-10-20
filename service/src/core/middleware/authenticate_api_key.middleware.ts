import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app_error';
import { hashApiKey, looksLikeApiKey } from '../utils/api_key';
import { findAccountByApiKeyHash } from '../../modules/accounts/accounts.repository';
import type { AuthenticatedAccount } from '../../modules/accounts/accounts.types';

export const authenticateApiKey: RequestHandler = async (req, _res, next) => {
  const apiKey = req.header('x-api-key');
  if (!apiKey) throw new UnauthorizedError('Missing API key');
  // Same message for malformed and unknown keys so attackers cannot tell which check failed.
  if (!looksLikeApiKey(apiKey)) throw new UnauthorizedError('Invalid API key');

  const account = await findAccountByApiKeyHash(hashApiKey(apiKey));
  if (!account) throw new UnauthorizedError('Invalid API key');

  req.account = account;
  next();
};

export function requireAccount(req: Request): AuthenticatedAccount {
  if (!req.account) throw new UnauthorizedError('Authentication required');
  return req.account;
}