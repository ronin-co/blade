import { describe, expect, test } from 'bun:test';
import { model, string } from 'blade-syntax/schema';
import { NodeFlags, SyntaxKind, factory } from 'typescript';

import { generateTypedQueryMembers } from '@/src/generators/module';
import { printNodes } from '@/src/utils/print';

import type { Model } from '@/src/types/model';

describe('module', () => {
  describe('query declaration constant', () => {
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
      const members = generateTypedQueryMembers(models, 'get');
      const statement = factory.createVariableStatement(
        [factory.createModifier(SyntaxKind.DeclareKeyword)],
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              'get',
              undefined,
              factory.createTypeLiteralNode(members),
            ),
          ],
          NodeFlags.Const,
        ),
      );
      const statementsStr = printNodes([statement]);
      expect(statementsStr).toMatchSnapshot();
    });

    test('with no modules', () => {
      const members = generateTypedQueryMembers([], 'get');
      const statement = factory.createVariableStatement(
        [factory.createModifier(SyntaxKind.DeclareKeyword)],
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              'get',
              undefined,
              factory.createTypeLiteralNode(members),
            ),
          ],
          NodeFlags.Const,
        ),
      );
      const statementsStr = printNodes([statement]);
      expect(statementsStr).toMatchSnapshot();
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
      const members = generateTypedQueryMembers(models, 'get');
      const statement = factory.createVariableStatement(
        [factory.createModifier(SyntaxKind.DeclareKeyword)],
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              'get',
              undefined,
              factory.createTypeLiteralNode(members),
            ),
          ],
          NodeFlags.Const,
        ),
      );
      const statementsStr = printNodes([statement]);
      expect(statementsStr).toMatchSnapshot();
    });
  });
});
