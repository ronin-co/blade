import { SyntaxKind, factory } from 'typescript';

import { identifiers } from '@/src/constants/identifiers';
import {
  importQueryHandlerOptionsType,
  importRoninQueryTypesType,
  importRoninStoredObjectType,
  importSyntaxUtiltypesType,
  jsonArrayType,
  jsonObjectType,
  jsonPrimitiveType,
  resolveSchemaType,
} from '@/src/declarations';
import {
  generateExportTypeModuleStatements,
  generateQueryDeclarationStatement,
} from '@/src/generators/module';
import { generateTypes } from '@/src/generators/types';
import { printNodes } from '@/src/utils/print';

import type { Node } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * Generates the complete `index.d.ts` file for a list of RONIN models.
 *
 * @param models - A list of models to generate the the types for.
 *
 * @returns A string of the complete `index.d.ts` file.
 */
export const generate = (models: Array<Model>): string => {
  // If there is any models that have a `blob()` field, we need to import the
  // `StoredObject` type from the `blade-compiler` package.
  const hasStoredObjectFields = models.some((model) =>
    Object.values(model.fields).some((field) => field.type === 'blob'),
  );

  // Each node represents any kind of "block" like
  // an import statement, interface, namespace, etc.
  const nodes = new Array<Node>(
    importRoninQueryTypesType,
    ...(hasStoredObjectFields ? [importRoninStoredObjectType] : []),
    importSyntaxUtiltypesType,
    importQueryHandlerOptionsType,
  );

  // If there is any models that have a `link()` field, we need to add the
  // `ResolveSchemaType` type.
  const hasLinkFields = models.some((model) =>
    Object.values(model.fields).some((field) => field.type === 'link'),
  );
  if (hasLinkFields) nodes.push(resolveSchemaType);

  const hasJsonFields = models.some((model) =>
    Object.values(model.fields).some((field) => field.type === 'json'),
  );
  if (hasJsonFields) nodes.push(jsonArrayType, jsonObjectType, jsonPrimitiveType);

  /**
   * Generate and add the type declarations for each model.
   *
   * @example
   * ```ts
   * type User = ResultRecord & {
   *    email: string;
   *    name: string;
   * };
   *
   * type Users = Array<User> & {
   *    moreBefore?: string;
   *    moreAfter?: string;
   * };
   * ```
   */
  const typeDeclarations = generateTypes(models);
  nodes.push(...typeDeclarations);

  /**
   * Generate and add the `blade/types` module augmentations.
   *
   * @example
   * ```ts
   * declare module "blade/types" {
   *   export type { ... };
   * }
   * ```
   */
  nodes.push(
    factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      identifiers.blade.module.types,
      factory.createModuleBlock([generateExportTypeModuleStatements(models)]),
    ),
  );

  /**
   * Generate and add the `blade/server/hooks` module augmentations.
   *
   * @example
   * ```ts
   * declare module "blade/server/hooks" {
   *   declare const use: { ... };
   * }
   * ```
   */
  nodes.push(
    factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      identifiers.blade.module.server.hooks,
      factory.createModuleBlock([generateQueryDeclarationStatement(models, 'use')]),
    ),
  );

  return printNodes(nodes);
};
