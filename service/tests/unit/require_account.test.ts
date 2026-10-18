import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../src/core/errors/app_error';
import { requireAccount } from '../../src/core/middleware/authenticate_api_key.middleware';

describe('requireAccount', () => {
  it('returns the account that the authentication middleware stored on the request', () => {
    const account = { id: 'account-1', name: 'Acme', planId: 'plan-1' };

    expect(requireAccount({ account } as Request)).toBe(account);
  });

  it('throws a 401 error when the route was mounted without authentication', () => {
    expect(() => requireAccount({} as Request)).toThrow(UnauthorizedError);
  });
});