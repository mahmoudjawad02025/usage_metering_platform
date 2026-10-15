const PG_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const details = err as { code?: unknown; constraint?: unknown };
  if (details.code !== PG_UNIQUE_VIOLATION) return false;
  return constraint === undefined || details.constraint === constraint;
}