import { ValidationError } from '../errors/app_error';

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/; // YYYY-MM format

export function getCurrentUtcPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0'); // (0-11) + 1 = (1-12) | pad the month to 2 digits | we get 01, 02, ..., 12
  return `${year}-${month}-01`;
}

export function monthToPeriod(month: string): string {
  if (!MONTH_PATTERN.test(month)) {
    throw new ValidationError('period must be in the format YYYY-MM');
  }
  return `${month}-01`; // YYYY-MM -> YYYY-MM-01
}

export function periodToMonth(period: string): string {
  return period.slice(0, 7); // YYYY-MM-01 -> YYYY-MM
}