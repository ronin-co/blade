import { describe, expect, test } from 'bun:test';
import { getProperty, setProperty } from '@/src/utils';

describe('miscellaneous', () => {
  test('getProperty', () => {
    const contents = {
      item: true,
    };

    expect(getProperty(contents, 'item')).toBe(true);
  });

  test('setPropertyProperty', () => {
    const contents = {
      item: true,
    };

    setProperty(contents, 'item', false);

    expect(contents.item).toBe(false);
  });
});
