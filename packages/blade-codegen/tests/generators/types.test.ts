import { describe, expect, test } from 'bun:test';
import {
  blob,
  boolean,
  date,
  json,
  link,
  model,
  number,
  string,
} from 'blade-syntax/schema';

import { generateTypeReExports, generateTypes } from '@/src/generators/types';
import { printNodes } from '@/src/utils/print';

import type { Model } from '@/src/types/model';

describe('types', () => {
  describe('re-export model types', () => {
    test('a basic model', () => {
      const AccountModel = model({
        slug: 'account',
        pluralSlug: 'accounts',
        fields: {
          name: string(),
          email: string({ required: true }),
        },
      });

      const models = [AccountModel] as unknown as Array<Model>;
      const types = generateTypeReExports(models);
      const typesStr = printNodes(types);
      expect(typesStr).toMatchSnapshot();
    });

    test('with no models', () => {
      const types = generateTypeReExports([]);
      const typesStr = printNodes(types);
      expect(typesStr).toMatchSnapshot();
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
          description: string(),
        },
      });

      const models = [AccountModel, PostModel] as unknown as Array<Model>;
      const types = generateTypeReExports(models);
      const typesStr = printNodes(types);
      expect(typesStr).toMatchSnapshot();
    });
  });

  describe('generate types', () => {
    test('a basic model', () => {
      const AccountModel = model({
        slug: 'account',
        pluralSlug: 'accounts',
        fields: {
          avatar: blob(),
          email: string({ required: true }),
          isActive: boolean(),
          lastActiveAt: date(),
          name: string(),
          rewardPoints: number({ defaultValue: 0, required: true }),
          settings: json({ defaultValue: {}, required: true }),
        },
      });

      // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
      // @ts-expect-error Codegen models types differ from the schema model types.
      const typesResult = generateTypes([AccountModel], AccountModel);

      expect(typesResult).toHaveLength(2);

      const typesResultStr = printNodes(typesResult);

      expect(typesResultStr).toMatchSnapshot();
    });

    test('a model with a summary', () => {
      const AccountModel = model({
        slug: 'account',
        pluralSlug: 'accounts',
        fields: {
          name: string(),
          email: string({ required: true }),
        },
        // @ts-expect-error This property is not native to RONIN models.
        summary: 'A user account.',
      });

      // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
      // @ts-expect-error Codegen models types differ from the schema model types.
      const typesResult = generateTypes([AccountModel], AccountModel);

      expect(typesResult).toHaveLength(2);

      const typesResultStr = printNodes(typesResult);

      expect(typesResultStr).toMatchSnapshot();
    });

    test('a model with an invalid field type', () => {
      const field = string();

      // @ts-expect-error These properties are designed to be read-only.
      field.type = 'invalid';

      const AccountModel = model({
        slug: 'account',
        pluralSlug: 'accounts',
        fields: {
          name: field,
        },
      });

      // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
      // @ts-expect-error Codegen models types differ from the schema model types.
      const typesResult = generateTypes([AccountModel], AccountModel);

      expect(typesResult).toHaveLength(2);

      const typesResultStr = printNodes(typesResult);

      expect(typesResultStr).toMatchSnapshot();
    });

    test('a model with a link field', () => {
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
          title: string(),
          author: link({ target: 'account' }),
        },
      });

      // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
      // @ts-expect-error Codegen models types differ from the schema model types.
      const typesResult = generateTypes([AccountModel, PostModel], PostModel);

      expect(typesResult).toHaveLength(4);

      const typesResultStr = printNodes(typesResult);

      expect(typesResultStr).toMatchSnapshot();
    });

    test('a model with a many-to-many link field', () => {
      const AccountModel = model({
        slug: 'account',
        pluralSlug: 'accounts',
        fields: {
          name: string(),
          email: string({ required: true }),
        },
      });

      const SpaceModel = model({
        slug: 'space',
        pluralSlug: 'spaces',
        fields: {
          name: string(),
          members: link({ target: 'account', kind: 'many' }),
        },
      });

      // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
      // @ts-expect-error Codegen models types differ from the schema model types.
      const typesResult = generateTypes([AccountModel, SpaceModel], SpaceModel);

      expect(typesResult).toHaveLength(4);

      const typesResultStr = printNodes(typesResult);

      expect(typesResultStr).toMatchSnapshot();
    });

    test('a model with a link field that does not exist', () => {
      const AccountModel = model({
        slug: 'account',
        pluralSlug: 'accounts',
        fields: {
          name: string(),
          email: string({ required: true }),
          latestPost: link({ target: 'does_not_exist' }),
        },
      });

      // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
      // @ts-expect-error Codegen models types differ from the schema model types.
      const typesResult = generateTypes([AccountModel], AccountModel);

      expect(typesResult).toHaveLength(2);

      const typesResultStr = printNodes(typesResult);

      expect(typesResultStr).toMatchSnapshot();
    });

    test('a model with nested fields', () => {
      const AccountModel = model({
        slug: 'account',
        pluralSlug: 'accounts',
        fields: {
          name: string(),
          'nested.foo': string(),
          'nested.bar': number(),
        },
        // @ts-expect-error This property is not native to RONIN models.
        summary: 'A user account.',
      });

      // TODO(@nurodev): Refactor the `Model` type to be more based on current schema models.
      // @ts-expect-error Codegen models types differ from the schema model types.
      const typesResult = generateTypes([AccountModel], AccountModel);

      expect(typesResult).toHaveLength(2);

      const typesResultStr = printNodes(typesResult);

      expect(typesResultStr).toMatchSnapshot();
    });
  });
});
