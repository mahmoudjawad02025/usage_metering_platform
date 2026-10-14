import { describe, expect, it } from 'vitest';
import { getCurrentUtcPeriod, monthToPeriod, periodToMonth } from '../../src/core/utils/utc_period';

describe('getCurrentUtcPeriod', () => {
  it('returns the first day of the current UTC month', () => {
    expect(getCurrentUtcPeriod(new Date('2026-10-13T08:30:00Z'))).toBe('2026-10-01');
  });

  it('switches month exactly at UTC midnight', () => {
    expect(getCurrentUtcPeriod(new Date('2026-10-31T23:59:59.999Z'))).toBe('2026-10-01');
    expect(getCurrentUtcPeriod(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026-11-01');
  });

  it('uses UTC, not the local timezone', () => {
    expect(getCurrentUtcPeriod(new Date('2026-10-31T23:30:00-05:00'))).toBe('2026-11-01');
  });

  it('handles the year boundary', () => {
    expect(getCurrentUtcPeriod(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-01');
    expect(getCurrentUtcPeriod(new Date('2027-01-01T00:00:00Z'))).toBe('2027-01-01');
  });
});

describe('monthToPeriod', () => {
  it('converts YYYY-MM to a period date', () => {
    expect(monthToPeriod('2026-10')).toBe('2026-10-01');
  });

  it.each(['2026-13', '2026-00', '26-10', '2026-1', '2026-10-01', ''])('rejects %j', (value) => {
    expect(() => monthToPeriod(value)).toThrow();
  });
});

describe('periodToMonth', () => {
  it('converts a period date back to YYYY-MM', () => {
    expect(periodToMonth('2026-10-01')).toBe('2026-10');
  });
});