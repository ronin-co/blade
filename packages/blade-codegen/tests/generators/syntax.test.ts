import { describe, expect, test } from 'bun:test';
import { link, model, string } from 'blade-syntax/schema';
import { factory } from 'typescript';

import { generateUsingSyntax, generateWithSyntax } from '@/src/generators/syntax';
import { printNodes } from '@/src/utils/print';
import { convertToPascalCase } from '@/src/utils/slug';

import type { PopulatedModel as Model } from 'blade-compiler';

describe('syntax', () => {
  describe('using', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
      },
    }) as unknown as Model;
    const SingularAccountModelNode = factory.createUnionTypeNode([
      factory.createTypeReferenceNode(convertToPascalCase(AccountModel.slug)),
      factory.createLiteralTypeNode(factory.createNull()),
    ]);
    const PluralAccountModelNode = factory.createArrayTypeNode(
      factory.createTypeReferenceNode(convertToPascalCase(AccountModel.slug)),
    );

    const PostModel = model({
      slug: 'post',
      pluralSlug: 'posts',
      fields: {
        title: string(),
        author: link({ target: 'account' }),
      },
    }) as unknown as Model;
    const SingularPostModelNode = factory.createUnionTypeNode([
      factory.createTypeReferenceNode(convertToPascalCase(PostModel.slug)),
      factory.createLiteralTypeNode(factory.createNull()),
    ]);
    const PluralPostModelNode = factory.createArrayTypeNode(
      factory.createTypeReferenceNode(convertToPascalCase(PostModel.slug)),
    );

    describe('singular', () => {
      describe('synchronous', () => {
        test('with no link fields', () => {
          const typesResult = generateUsingSyntax(
            AccountModel,
            SingularAccountModelNode,
            false,
            false,
          );

          const typesResultStr = printNodes([typesResult]);

          expect(typesResultStr).toMatchSnapshot();
        });

        test('with a link field', () => {
          const typesResult = generateUsingSyntax(
            PostModel,
            SingularPostModelNode,
            false,
            false,
          );

          const typesResultStr = printNodes([typesResult]);

          expect(typesResultStr).toMatchSnapshot();
        });
      });
      describe('asynchronous', () => {
        test('with no link fields', () => {
          const typesResult = generateUsingSyntax(
            AccountModel,
            SingularAccountModelNode,
            true,
            false,
          );

          const typesResultStr = printNodes([typesResult]);

          expect(typesResultStr).toMatchSnapshot();
        });

        test('with a link field', () => {
          const typesResult = generateUsingSyntax(
            PostModel,
            SingularPostModelNode,
            true,
            false,
          );

          const typesResultStr = printNodes([typesResult]);

          expect(typesResultStr).toMatchSnapshot();
        });
      });
    });

    describe('plural', () => {
      describe('synchronous', () => {
        test('with no link fields', () => {
          const typesResult = generateUsingSyntax(
            AccountModel,
            PluralAccountModelNode,
            false,
            true,
          );

          const typesResultStr = printNodes([typesResult]);

          expect(typesResultStr).toMatchSnapshot();
        });

        test('with a link field', () => {
          const typesResult = generateUsingSyntax(
            PostModel,
            PluralPostModelNode,
            false,
            true,
          );

          const typesResultStr = printNodes([typesResult]);

          expect(typesResultStr).toMatchSnapshot();
        });
      });
      describe('asynchronous', () => {
        test('with no link fields', () => {
          const typesResult = generateUsingSyntax(
            AccountModel,
            PluralAccountModelNode,
            true,
            true,
          );

          const typesResultStr = printNodes([typesResult]);

          expect(typesResultStr).toMatchSnapshot();
        });

        test('with a link field', () => {
          const typesResult = generateUsingSyntax(
            PostModel,
            PluralPostModelNode,
            true,
            true,
          );

          const typesResultStr = printNodes([typesResult]);

          expect(typesResultStr).toMatchSnapshot();
        });
      });
    });
  });

  describe('with', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
        email: string({ required: true, unique: true }),
      },
    }) as unknown as Model;
    const SingularAccountModelNode = factory.createUnionTypeNode([
      factory.createTypeReferenceNode(convertToPascalCase(AccountModel.slug)),
      factory.createLiteralTypeNode(factory.createNull()),
    ]);
    const PluralAccountModelNode = factory.createArrayTypeNode(
      factory.createTypeReferenceNode(convertToPascalCase(AccountModel.slug)),
    );

    describe('singular', () => {
      test('synchronous', () => {
        const typesResult = generateWithSyntax(
          AccountModel,
          SingularAccountModelNode,
          false,
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
      test('asynchronous', () => {
        const typesResult = generateWithSyntax(
          AccountModel,
          SingularAccountModelNode,
          true,
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
    });

    describe('plural', () => {
      test('synchronous', () => {
        const typesResult = generateWithSyntax(
          AccountModel,
          PluralAccountModelNode,
          false,
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
      test('asynchronous', () => {
        const typesResult = generateWithSyntax(
          AccountModel,
          PluralAccountModelNode,
          true,
        );

        const typesResultStr = printNodes([typesResult]);

        expect(typesResultStr).toMatchSnapshot();
      });
    });
  });
});
