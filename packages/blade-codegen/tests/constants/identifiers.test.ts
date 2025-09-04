import { expect, test } from 'bun:test';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';

test('identifiers', () => {
  expect(identifiers).toMatchSnapshot();
});

test('generic identifiers', () => {
  expect(typeArgumentIdentifiers).toMatchSnapshot();
});
