import { expect, test } from 'bun:test';

import { genericIdentifiers, identifiers } from '@/src/constants/identifiers';

test('identifiers', () => {
  expect(identifiers).toMatchSnapshot();
});

test('generic identifiers', () => {
  expect(genericIdentifiers).toMatchSnapshot();
});
