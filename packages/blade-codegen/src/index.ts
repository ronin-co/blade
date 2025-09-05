import { NodeFlags, SyntaxKind, factory } from 'typescript';

import { identifiers } from '@/src/constants/identifiers';
import {
  importBladeCompilerStoredObjectType,
  importSyntaxUtilTypesType,
  jsonArrayType,
  jsonObjectType,
  jsonPrimitiveType,
  resolveSchemaType,
} from '@/src/declarations';
import { importBladeCompilerQueryTypesType } from '@/src/declarations';
import { generateTypedQueryMembers } from '@/src/generators/module';
import { generateModelFieldsTypes } from '@/src/generators/types/fields';
import { generateModelTypes } from '@/src/generators/types/model';
import { generateTypeReExports } from '@/src/generators/types/re-exports';
import { generateModelSyntaxTypes } from '@/src/generators/types/syntax';
import { printNodes } from '@/src/utils/print';

import type { Node } from 'typescript';

import type { Model } from '@/src/types/model';
import type { QueryType } from '@/src/types/query';

/**
 * Generates the complete `index.d.ts` file for a list of RONIN models.
 *
 * @param models - A list of models to generate the the types for.
 *
 * @returns A string of the complete `index.d.ts` file.
 */
export const generate = (models: Array<Model>): string => {
  // Each node represents any kind of "block" like
  // an import statement, interface, namespace, etc.
  const nodes = new Array<Node>(
    importBladeCompilerQueryTypesType,
    importSyntaxUtilTypesType,
  );

  // If there is any models that have a `blob()` field, we need to import the
  // `StoredObject` type from the `blade-compiler` package.
  const hasStoredObjectFields = models.some((model) =>
    Object.values(model.fields).some((field) => field.type === 'blob'),
  );
  if (hasStoredObjectFields) nodes.push(importBladeCompilerStoredObjectType);

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

  for (const model of models) {
    /**
     * @example
     * ```ts
     * type User = import('blade/types').User;
     * type Users = import('blade/types').Users;
     * ```
     */
    const reExportTypes = generateTypeReExports(model);

    /**
     * @example
     * ```ts
     * type UserFieldSlug =
     *  | 'id'
     *  | 'ronin.createdAt'
     *  | 'ronin.createdBy'
     *  | 'ronin.updatedAt'
     *  | 'ronin.updatedBy'
     *  | 'email'
     *  | 'name'
     *  // [...]
     * ```
     */
    const fieldSlugType = generateModelFieldsTypes(model);

    /**
     * @example
     * ```ts
     * type UserSyntax <S, Q> = ReducedFunction & { ... };
     * ```
     */
    const syntaxType = generateModelSyntaxTypes(model);

    nodes.push(...reExportTypes, fieldSlugType, syntaxType);
  }

  /**
   * @example
   * ```ts
   * declare module "blade/types" {
   *  type User = ResultRecord & {
   *    email: string;
   *    name: string;
   *  };
   *  type Users = Array<User> & {
   *    moreBefore?: string;
   *    moreAfter?: string;
   *  };
   * }
   * ```
   */
  nodes.push(
    factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      identifiers.blade.module.types,
      factory.createModuleBlock(generateModelTypes(models)),
    ),
  );

  /**
   * @example
   * ```ts
   * declare module "blade/server/hooks" {
   *  declare const use: {
   *    // Get a single user record
   *    user: UserSyntax<User | null>;
   *    // Get multiple user records
   *    users: UserSyntax<Users>
   *  };
   * }
   * ```
   */
  nodes.push(
    factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      identifiers.blade.module.server.hooks,
      factory.createModuleBlock([
        factory.createVariableStatement(
          [factory.createModifier(SyntaxKind.DeclareKeyword)],
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                'use',
                undefined,
                factory.createTypeLiteralNode(generateTypedQueryMembers(models, 'use')),
              ),
            ],
            NodeFlags.Const,
          ),
        ),
      ]),
    ),
  );

  /**
   * @example
   * ```ts
   * declare module "blade/client/hooks" {
   *  declare const useMutation: () => {
   *    add: { ... }
   *    remove: { ... }
   *    set: { ... }
   *  };
   * }
   * ```
   */
  nodes.push(
    factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      identifiers.blade.module.client.hooks,
      factory.createModuleBlock([
        factory.createVariableStatement(
          [factory.createModifier(SyntaxKind.DeclareKeyword)],
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier('useMutation'),
                undefined,
                factory.createFunctionTypeNode(
                  undefined,
                  [],
                  factory.createTypeLiteralNode(
                    (['add', 'remove', 'set'] satisfies Array<QueryType>).map(
                      (queryType) =>
                        factory.createPropertySignature(
                          undefined,
                          queryType,
                          undefined,
                          factory.createTypeLiteralNode(
                            generateTypedQueryMembers(models, queryType),
                          ),
                        ),
                    ),
                  ),
                ),
              ),
            ],
            NodeFlags.Const,
          ),
        ),
      ]),
    ),
  );

  return printNodes(nodes);
};
