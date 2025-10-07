import { NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { identifiers } from '@/src/constants/identifiers';
import {
  afterQueryPromiseType,
  afterQueryType,
  beforeQueryPromiseType,
  beforeQueryType,
  importBladeCompilerStoredObjectType,
  importBladeUtilsType,
  includingQueryPromiseType,
  includingQueryType,
  jsonArrayType,
  jsonObjectType,
  jsonPrimitiveType,
  limitedToQueryPromiseType,
  limitedToQueryType,
  orderedByQueryPromiseType,
  orderedByQueryType,
  resolveSchemaType,
  resultRecordType,
  rootCallerQueryPromiseType,
  rootCallerQueryType,
  selectingQueryPromiseType,
  selectingQueryType,
  toQueryPromiseType,
  toQueryType,
  withQueryPromiseType,
  withQueryType,
} from '@/src/declarations';
import { importBladeCompilerQueryTypesType } from '@/src/declarations';
import { generateQueryTypeComment } from '@/src/generators/comment';
import { createImportDeclaration } from '@/src/generators/import';
import { generateModelTypes } from '@/src/generators/model';
import { generateNamespaces } from '@/src/generators/namespaces';
import { printNodes } from '@/src/utils/print';
import { convertToPascalCase } from '@/src/utils/slug';

import type { PopulatedModel } from 'blade-compiler';
import type { Node, TypeAliasDeclaration } from 'typescript';

/**
 * Generates the complete `index.d.ts` file for a list of RONIN models.
 *
 * @param models - A list of models to generate the the types for.
 *
 * @returns A string of the complete `index.d.ts` file.
 */
export const generate = (models: Array<PopulatedModel>): string => {
  // Each node represents any kind of "block" like
  // an import statement, interface, namespace, etc.
  const nodes = new Array<Node>(importBladeCompilerQueryTypesType, importBladeUtilsType);

  // If there is any models that have a `blob()` field, we need to import the
  // `StoredObject` type from the `blade-compiler` package.
  const hasStoredObjectFields = models.some((model) =>
    Object.values(model.fields).some((field) => field.type === 'blob'),
  );
  if (hasStoredObjectFields) nodes.push(importBladeCompilerStoredObjectType);

  /**
   * ```ts
   * import { User, Users } from "blade/types";
   * ```
   */
  nodes.push(
    createImportDeclaration({
      identifiers: models.flatMap((model) => [
        { name: factory.createIdentifier(convertToPascalCase(model.slug)) },
        { name: factory.createIdentifier(convertToPascalCase(model.pluralSlug)) },
      ]),
      module: identifiers.blade.module.types,
      type: true,
    }),
  );

  const hasJsonFields = models.some((model) =>
    Object.values(model.fields).some((field) => field.type === 'json'),
  );
  if (hasJsonFields) nodes.push(jsonArrayType, jsonObjectType, jsonPrimitiveType);

  /**
   * ```ts
   * export type { User, Users };
   * ```
   */
  nodes.push(
    factory.createExportDeclaration(
      undefined,
      true,
      factory.createNamedExports(
        models.flatMap((model) => [
          factory.createExportSpecifier(
            false,
            undefined,
            convertToPascalCase(model.slug),
          ),
          factory.createExportSpecifier(
            false,
            undefined,
            convertToPascalCase(model.pluralSlug),
          ),
        ]),
      ),
    ),
  );

  const utilsNamespaceStatements = new Array<TypeAliasDeclaration>(
    afterQueryType,
    afterQueryPromiseType,
    beforeQueryType,
    beforeQueryPromiseType,
    includingQueryType,
    includingQueryPromiseType,
    limitedToQueryType,
    limitedToQueryPromiseType,
    orderedByQueryType,
    orderedByQueryPromiseType,
    resultRecordType,
    rootCallerQueryType,
    rootCallerQueryPromiseType,
    selectingQueryType,
    selectingQueryPromiseType,
    toQueryType,
    toQueryPromiseType,
    withQueryType,
    withQueryPromiseType,
  );

  // If there is any models that have a `link()` field, we need to add the
  // `ResolveSchemaType` type.
  const hasLinkFields = models.some((model) =>
    Object.values(model.fields).some((field) => field.type === 'link'),
  );
  if (hasLinkFields) utilsNamespaceStatements.push(resolveSchemaType);

  /**
   * ```ts
   * declare namespace Utils {
   *  // ...
   * }
   * ```
   */
  nodes.push(
    factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      identifiers.namespace.utils.name,
      factory.createModuleBlock(utilsNamespaceStatements),
      NodeFlags.Namespace,
    ),
  );

  /**
   * ```ts
   * declare namespace Syntax {
   *  // ...
   * }
   * ```
   */
  nodes.push(
    factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      identifiers.namespace.syntax.name,
      factory.createModuleBlock(generateNamespaces(models)),
      NodeFlags.Namespace,
    ),
  );

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
   *    user: ReducedFunction & Syntax.User.Singular.RootQueryCaller & { ... };
   *    // Get multiple user records
   *    users: ReducedFunction & Syntax.User.Plural.RootQueryCaller & { ... };
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
                factory.createTypeLiteralNode(
                  models.flatMap((model) => {
                    const comment = generateQueryTypeComment(model, 'use');

                    const modelSyntaxIdentifier = factory.createIdentifier(
                      convertToPascalCase(model.slug),
                    );

                    /**
                     * @example
                     * ```ts
                     * user: ReducedFunction & Syntax.User.Singular.RootQueryCaller & { ... };
                     * ```
                     */
                    const singularProperty = factory.createPropertySignature(
                      undefined,
                      model.slug,
                      undefined,
                      factory.createIntersectionTypeNode([
                        factory.createExpressionWithTypeArguments(
                          identifiers.blade.reducedFunction,
                          undefined,
                        ),
                        factory.createTypeReferenceNode(
                          factory.createQualifiedName(
                            factory.createQualifiedName(
                              factory.createQualifiedName(
                                identifiers.namespace.syntax.name,
                                modelSyntaxIdentifier,
                              ),
                              identifiers.namespace.syntax.singular,
                            ),
                            identifiers.namespace.utils.rootQueryCaller,
                          ),
                        ),
                        factory.createTypeLiteralNode(
                          Object.entries({
                            after: identifiers.namespace.utils.afterQuery,
                            before: identifiers.namespace.utils.beforeQuery,
                            including: identifiers.namespace.utils.includingQuery,
                            limitedTo: identifiers.namespace.utils.limitedToQuery,
                            orderedBy: identifiers.namespace.utils.orderedByQuery,
                            selecting: identifiers.namespace.utils.selectingQuery,
                            using: identifiers.namespace.utils.usingQuery,
                            with: identifiers.namespace.utils.withQuery,
                          }).map(([instruction, utilIdentifier]) =>
                            factory.createPropertySignature(
                              undefined,
                              instruction,
                              undefined,
                              factory.createTypeReferenceNode(
                                factory.createQualifiedName(
                                  factory.createQualifiedName(
                                    factory.createQualifiedName(
                                      identifiers.namespace.syntax.name,
                                      modelSyntaxIdentifier,
                                    ),
                                    identifiers.namespace.syntax.singular,
                                  ),
                                  utilIdentifier,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ]),
                    );

                    /**
                     * @example
                     * ```ts
                     * users: ReducedFunction & Syntax.User.Plural.RootQueryCaller & { ... };
                     * ```
                     */
                    const pluralProperty = factory.createPropertySignature(
                      undefined,
                      model.pluralSlug,
                      undefined,
                      factory.createIntersectionTypeNode([
                        factory.createExpressionWithTypeArguments(
                          identifiers.blade.reducedFunction,
                          undefined,
                        ),
                        factory.createTypeReferenceNode(
                          factory.createQualifiedName(
                            factory.createQualifiedName(
                              factory.createQualifiedName(
                                identifiers.namespace.syntax.name,
                                modelSyntaxIdentifier,
                              ),
                              identifiers.namespace.syntax.plural,
                            ),
                            identifiers.namespace.utils.rootQueryCaller,
                          ),
                        ),
                        factory.createTypeLiteralNode(
                          Object.entries({
                            after: identifiers.namespace.utils.afterQuery,
                            before: identifiers.namespace.utils.beforeQuery,
                            including: identifiers.namespace.utils.includingQuery,
                            limitedTo: identifiers.namespace.utils.limitedToQuery,
                            orderedBy: identifiers.namespace.utils.orderedByQuery,
                            selecting: identifiers.namespace.utils.selectingQuery,
                            using: identifiers.namespace.utils.usingQuery,
                            with: identifiers.namespace.utils.withQuery,
                          }).map(([instruction, utilIdentifier]) =>
                            factory.createPropertySignature(
                              undefined,
                              instruction,
                              undefined,
                              factory.createTypeReferenceNode(
                                factory.createQualifiedName(
                                  factory.createQualifiedName(
                                    factory.createQualifiedName(
                                      identifiers.namespace.syntax.name,
                                      modelSyntaxIdentifier,
                                    ),
                                    identifiers.namespace.syntax.plural,
                                  ),
                                  utilIdentifier,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ]),
                    );

                    return [
                      addSyntheticLeadingComment(
                        singularProperty,
                        SyntaxKind.MultiLineCommentTrivia,
                        comment.singular,
                        true,
                      ),
                      addSyntheticLeadingComment(
                        pluralProperty,
                        SyntaxKind.MultiLineCommentTrivia,
                        comment.plural,
                        true,
                      ),
                    ];
                  }),
                ),
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
                  factory.createTypeLiteralNode([
                    factory.createPropertySignature(
                      undefined,
                      'add',
                      undefined,
                      factory.createTypeReferenceNode(
                        factory.createQualifiedName(
                          identifiers.namespace.syntax.name,
                          identifiers.namespace.syntax.addQuery,
                        ),
                      ),
                    ),
                    factory.createPropertySignature(
                      undefined,
                      'remove',
                      undefined,
                      factory.createTypeReferenceNode(
                        factory.createQualifiedName(
                          identifiers.namespace.syntax.name,
                          identifiers.namespace.syntax.removeQuery,
                        ),
                      ),
                    ),
                    factory.createPropertySignature(
                      undefined,
                      'set',
                      undefined,
                      factory.createTypeReferenceNode(
                        factory.createQualifiedName(
                          identifiers.namespace.syntax.name,
                          identifiers.namespace.syntax.setQuery,
                        ),
                      ),
                    ),
                  ]),
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
