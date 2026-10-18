import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPage,
  paginationQuerySchema,
} from '../../src/core/utils/pagination';

describe('paginationQuerySchema', () => {
  it('uses the defaults when nothing is given', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
  });

  it('turns query string text into numbers', () => {
    expect(paginationQuerySchema.parse({ limit: '5', offset: '10' })).toEqual({ limit: 5, offset: 10 });
  });

  it('accepts the exact boundaries', () => {
    expect(paginationQuerySchema.parse({ limit: String(MAX_PAGE_SIZE), offset: '0' })).toEqual({
      limit: MAX_PAGE_SIZE,
      offset: 0,
    });
    expect(paginationQuerySchema.parse({ limit: '1' }).limit).toBe(1);
  });

  it.each([
    ['a zero limit', { limit: '0' }],
    ['a limit above the maximum', { limit: String(MAX_PAGE_SIZE + 1) }],
    ['a negative offset', { offset: '-1' }],
    ['a decimal limit', { limit: '2.5' }],
    ['a limit that is not a number', { limit: 'many' }],
  ])('rejects %s', (_label, query) => {
    expect(paginationQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('buildPage', () => {
  it('wraps the items with the total and the applied limit and offset', () => {
    expect(buildPage(['a', 'b'], 7, { limit: 2, offset: 4 })).toEqual({
      items: ['a', 'b'],
      total: 7,
      limit: 2,
      offset: 4,
    });
  });

  it('supports an empty page', () => {
    expect(buildPage([], 0, { limit: 20, offset: 0 })).toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });
});