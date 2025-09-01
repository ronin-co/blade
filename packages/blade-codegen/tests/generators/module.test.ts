import { describe, expect, test } from 'bun:test';
import { model, string } from 'blade-syntax/schema';

import {
  generateModelTypesModule,
  generateQueryDeclarationStatements,
} from '@/src/generators/module';
import { printNodes } from '@/src/utils/print';

import type { Model } from '@/src/types/model';

describe('module', () => {
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
      const moduleDeclaration = generateModelTypesModule(models);
      const moduleDeclarationStr = printNodes([moduleDeclaration]);
      expect(moduleDeclarationStr).toMatchSnapshot();
    });

    test('with no models', () => {
      const moduleDeclaration = generateModelTypesModule([]);
      const moduleDeclarationStr = printNodes([moduleDeclaration]);
      expect(moduleDeclarationStr).toMatchSnapshot();
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
      const moduleDeclaration = generateModelTypesModule(models);
      const moduleDeclarationStr = printNodes([moduleDeclaration]);
      expect(moduleDeclarationStr).toMatchSnapshot();
    });
  });

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
      const statements = generateQueryDeclarationStatements(models, 'get');
      const statementsStr = printNodes([statements]);
      expect(statementsStr).toMatchSnapshot();
    });

    test('with no modules', () => {
      const statements = generateQueryDeclarationStatements([], 'get');
      const statementsStr = printNodes([statements]);
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
      const statements = generateQueryDeclarationStatements(models, 'get');
      const statementsStr = printNodes([statements]);
      expect(statementsStr).toMatchSnapshot();
    });
  });
});
