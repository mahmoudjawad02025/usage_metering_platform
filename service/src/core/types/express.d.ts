import type { AuthenticatedAccount } from '../../modules/accounts/accounts.types';

declare global {
  namespace Express {
    interface Request {
      account?: AuthenticatedAccount;
    }
  }
}

export {};