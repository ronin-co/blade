import { describe, expect, test } from 'bun:test';
import { blob, json, model, number, string } from '@ronin/syntax/schema';

import { generateZodSchema } from '@/src/zod';

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
    const output = generateZodSchema([AccountModel]);
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
    const output = generateZodSchema([AccountModel]);
    expect(output).toMatchSnapshot();
  });

  test('with multiple models', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
        email: string({ required: true }),
      },
    });

    const PostModel = model({
      slug: 'post',
      pluralSlug: 'posts',
      fields: {
        title: string({ required: true }),
        describe: string(),
      },
    });

    // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
    // @ts-expect-error Codegen models types differ from the schema model types.
    const output = generateZodSchema([AccountModel, PostModel]);
    expect(output).toMatchSnapshot();
  });

  test('with dot notation keys', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        'foo.bar': string(),
      },
    });

    // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
    // @ts-expect-error Codegen models types differ from the schema model types.
    const output = generateZodSchema([AccountModel]);
    expect(output).toMatchSnapshot();
  });

  test('with a JSON field', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
        email: string({ required: true }),
        settings: json(),
      },
    });

    // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
    // @ts-expect-error Codegen models types differ from the schema model types.
    const output = generateZodSchema([AccountModel]);
    expect(output).toMatchSnapshot();
  });

  test('with a default value', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
        email: string({ required: true }),
        role: string({ defaultValue: 'user' }),
      },
    });

    // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
    // @ts-expect-error Codegen models types differ from the schema model types.
    const output = generateZodSchema([AccountModel]);
    expect(output).toMatchSnapshot();
  });

  test('with a nested field', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
        'nested.foo': string({ required: true }),
        'nested.bar': number(),
      },
    });

    // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
    // @ts-expect-error Codegen models types differ from the schema model types.
    const output = generateZodSchema([AccountModel]);
    expect(output).toMatchSnapshot();
  });

  test('with `id` field being read-only', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        // @ts-expect-error `id` is a reserved field.
        id: string(),
        name: string(),
      },
    });

    // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
    // @ts-expect-error Codegen models types differ from the schema model types.
    const output = generateZodSchema([AccountModel]);
    expect(output).toMatchSnapshot();
  });

  test('with no models', () => {
    const output = generateZodSchema([]);
    expect(output).toMatchSnapshot();
  });
});
