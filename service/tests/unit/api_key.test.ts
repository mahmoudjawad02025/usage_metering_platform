import { describe, expect, it } from 'vitest';
import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  secretsMatch,
} from '../../src/core/utils/api_key';

describe('api key helpers', () => {
  it('generates unique keys with the expected prefix', () => {
    const first = generateApiKey();
    const second = generateApiKey();
    expect(first.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(first).not.toBe(second);
    expect(looksLikeApiKey(first)).toBe(true);
  });

  it('hashes deterministically and never returns the raw key', () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).toHaveLength(64);
    expect(hashApiKey(key)).not.toContain(key);
  });

  it('rejects values that cannot be keys', () => {
    expect(looksLikeApiKey('abc')).toBe(false);
    expect(looksLikeApiKey(API_KEY_PREFIX + 'x'.repeat(200))).toBe(false);
  });

  it('compares secrets safely', () => {
    expect(secretsMatch('same-secret', 'same-secret')).toBe(true);
    expect(secretsMatch('same-secret', 'other-secret')).toBe(false);
    expect(secretsMatch('', 'x')).toBe(false);
  });
});