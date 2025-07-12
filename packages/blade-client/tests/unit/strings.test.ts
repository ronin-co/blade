import { describe, expect, test } from 'bun:test';

import { toDashCase } from '@/src/utils/helpers';

describe('toDashCase', () => {
  test('correctly convert camelCase to dash case', () => {
    expect(toDashCase('superLongSlug')).toBe('super-long-slug');
  });

  test('correctly convert mixed case to dash case', () => {
    expect(toDashCase('even-MoreWords')).toBe('even-more-words');
  });

  test('correctly convert space-separated words to dash case', () => {
    expect(toDashCase('oh wow okay')).toBe('oh-wow-okay');
  });

  test('correctly handle empty string', () => {
    expect(toDashCase('')).toBe('');
  });

  test('correctly handle null input', () => {
    expect(toDashCase(null)).toBe('');
  });

  test('correctly handle undefined input', () => {
    expect(toDashCase(undefined)).toBe('');
  });
});
