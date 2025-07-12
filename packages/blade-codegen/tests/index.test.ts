import { describe, expect, test } from 'bun:test';
import { blob, model, string } from '@ronin/syntax/schema';

import { generate } from '@/src/index';

describe('generate', () => {
  test('a basic model', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
        email: string({ required: true }),
      },
    });

    // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
    // @ts-expect-error Codegen models types differ from the schema model types.
    const output = generate([AccountModel]);
    expect(output).toMatchSnapshot();
  });

  test('a basic model with blob field', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
        email: string({ required: true }),
        image: blob(),
      },
    });

    // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
    // @ts-expect-error Codegen models types differ from the schema model types.
    const output = generate([AccountModel]);
    expect(output).toMatchSnapshot();
  });

  test('with no models', () => {
    const output = generate([]);
    expect(output).toMatchSnapshot();
  });
});
