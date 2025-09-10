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
import { factory } from 'typescript';

import { generateModelTypes } from '@/src/generators/types/model';
import {
  generateDefaultSyntaxProperty,
  generateOrderedBySyntaxProperty,
  generateRootQueryCallSignature,
  generateSelectingSyntaxProperty,
  generateUsingSyntaxProperty,
  generateWithSyntaxProperty,
} from '@/src/generators/types/syntax';
import { printNodes } from '@/src/utils/print';

import type { Model } from '@/src/types/model';

describe('types', () => {
  describe('generate the core model types', () => {
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
      const typesResult = generateModelTypes([AccountModel], AccountModel);

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
      const typesResult = generateModelTypes([AccountModel], AccountModel);

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
      const typesResult = generateModelTypes([AccountModel], AccountModel);

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
      const typesResult = generateModelTypes([AccountModel, PostModel], PostModel);

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
      const typesResult = generateModelTypes([AccountModel, SpaceModel], SpaceModel);

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
      const typesResult = generateModelTypes([AccountModel], AccountModel);

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
      const typesResult = generateModelTypes([AccountModel], AccountModel);

      expect(typesResult).toHaveLength(2);

      const typesResultStr = printNodes(typesResult);

      expect(typesResultStr).toMatchSnapshot();
    });
  });

  describe('syntax', () => {
    describe('generate root query call signature', () => {
      test('a basic model', () => {
        const typesResult = generateRootQueryCallSignature(
          factory.createTypeReferenceNode('Account'),
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
    });
    describe('generate `default` syntax property', () => {
      test('a basic model', () => {
        const typesResult = generateDefaultSyntaxProperty(
          'including',
          factory.createTypeReferenceNode('Account'),
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
    });
    describe('generate `orderedBy` syntax property', () => {
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
        }) as unknown as Model;

        const typesResult = generateOrderedBySyntaxProperty(
          AccountModel,
          factory.createTypeReferenceNode(AccountModel.slug),
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
    });
    describe('generate `selecting` syntax property', () => {
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
        }) as unknown as Model;

        const typesResult = generateSelectingSyntaxProperty(
          AccountModel,
          factory.createTypeReferenceNode(AccountModel.slug),
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
    });
    describe('generate `using` syntax property', () => {
      test('a basic model', () => {
        const PostModel = model({
          slug: 'post',
          pluralSlug: 'posts',
          fields: {
            title: string(),
            author: link({ target: 'account' }),
          },
        }) as unknown as Model;

        const singularTypesResult = generateUsingSyntaxProperty(
          PostModel,
          factory.createTypeReferenceNode('Post'),
          PostModel.slug,
          false,
        );
        const pluralTypesResult = generateUsingSyntaxProperty(
          PostModel,
          factory.createTypeReferenceNode('Post'),
          PostModel.slug,
          true,
        );

        const typesResultStr = printNodes([singularTypesResult, pluralTypesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });

      test('a basic model with no link fields', () => {
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
        }) as unknown as Model;

        const singularTypesResult = generateUsingSyntaxProperty(
          AccountModel,
          factory.createTypeReferenceNode('Account'),
          AccountModel.slug,
          false,
        );
        const pluralTypesResult = generateUsingSyntaxProperty(
          AccountModel,
          factory.createTypeReferenceNode('Account'),
          AccountModel.slug,
          true,
        );

        const typesResultStr = printNodes([singularTypesResult, pluralTypesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
    });
    describe('generate `with` syntax property', () => {
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
        }) as unknown as Model;

        const typesResult = generateWithSyntaxProperty(
          AccountModel,
          factory.createTypeReferenceNode('Account'),
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
    });
  });
});
