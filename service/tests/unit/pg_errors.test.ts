import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../../src/db/pg_errors';

describe('isUniqueViolation', () => {
  it('recognizes the PostgreSQL unique violation code', () => {
    expect(isUniqueViolation({ code: '23505', constraint: 'some_constraint' })).toBe(true);
  });

  it('can also require one specific constraint name', () => {
    const error = { code: '23505', constraint: 'plans_unique_name_per_owner_and_scope' };

    expect(isUniqueViolation(error, 'plans_unique_name_per_owner_and_scope')).toBe(true);
    expect(isUniqueViolation(error, 'users_unique_external_id_per_account')).toBe(false);
  });

  it('ignores other database errors', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation({ code: '23514', constraint: 'x' }, 'x')).toBe(false);
  });

  it.each([null, undefined, 'unique violation', 23505, true])('ignores the value %j', (value) => {
    expect(isUniqueViolation(value)).toBe(false);
  });
});