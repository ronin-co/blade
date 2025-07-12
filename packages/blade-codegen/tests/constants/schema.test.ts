import { describe, expect, test } from 'bun:test';

import { MODEL_TYPE_TO_SYNTAX_KIND_KEYWORD } from '@/src/constants/schema';

describe('schema', () => {
  test('MODEL_TYPE_TO_SYNTAX_KIND_KEYWORD', () => {
    expect(MODEL_TYPE_TO_SYNTAX_KIND_KEYWORD).toMatchSnapshot();
  });
});
