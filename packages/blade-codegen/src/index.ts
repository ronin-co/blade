import { NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

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
import { generateQueryTypeComment } from '@/src/generators/comment';
import { createImportDeclaration } from '@/src/generators/import';
import { generateModelFieldsTypes } from '@/src/generators/types/fields';
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
import { convertToPascalCase } from '@/src/utils/slug';

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
  nodes.push(...generateModelFieldsTypes(models));

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
   *    user: ReducedFunction & {
   *      // ...
   *    };
   *    // Get multiple user records
   *    users: ReducedFunction & {
   *      // ...
   *    };
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

                    /**
                     * ```ts
                     * User | null
                     * ```
                     */
                    const singularModelNode = factory.createUnionTypeNode([
                      factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
                      factory.createLiteralTypeNode(factory.createNull()),
                    ]);

                    /**
                     * ```ts
                     * user: ReducedFunction & { ... };
                     * ```
                     */
                    const singularProperty = factory.createPropertySignature(
                      undefined,
                      model.slug,
                      undefined,
                      factory.createIntersectionTypeNode([
                        factory.createExpressionWithTypeArguments(
                          identifiers.syntax.reducedFunction,
                          undefined,
                        ),
                        factory.createTypeLiteralNode([
                          generateRootQueryCallSignature(singularModelNode),
                          generateDefaultSyntaxProperty('after', singularModelNode),
                          generateDefaultSyntaxProperty('before', singularModelNode),
                          generateDefaultSyntaxProperty('including', singularModelNode),
                          generateDefaultSyntaxProperty('limitedTo', singularModelNode),
                          generateOrderedBySyntaxProperty(model, singularModelNode),
                          generateSelectingSyntaxProperty(model, singularModelNode),
                          generateUsingSyntaxProperty(
                            model,
                            singularModelNode,
                            convertToPascalCase(model.slug),
                          ),
                          generateWithSyntaxProperty(model, singularModelNode),
                        ]),
                      ]),
                    );

                    /**
                     * ```ts
                     * Users
                     * ```
                     */
                    const pluralModelNode = factory.createTypeReferenceNode(
                      convertToPascalCase(model.pluralSlug),
                    );

                    /**
                     * ```ts
                     * users: ReducedFunction & { ... };
                     * ```
                     */
                    const pluralProperty = factory.createPropertySignature(
                      undefined,
                      model.pluralSlug,
                      undefined,
                      factory.createIntersectionTypeNode([
                        factory.createExpressionWithTypeArguments(
                          identifiers.syntax.reducedFunction,
                          undefined,
                        ),
                        factory.createTypeLiteralNode([
                          generateRootQueryCallSignature(pluralModelNode),
                          generateDefaultSyntaxProperty('after', pluralModelNode),
                          generateDefaultSyntaxProperty('before', pluralModelNode),
                          generateDefaultSyntaxProperty('including', pluralModelNode),
                          generateDefaultSyntaxProperty('limitedTo', pluralModelNode),
                          generateOrderedBySyntaxProperty(model, pluralModelNode),
                          generateSelectingSyntaxProperty(model, pluralModelNode),
                          generateUsingSyntaxProperty(
                            model,
                            pluralModelNode,
                            convertToPascalCase(model.pluralSlug),
                            true,
                          ),
                          generateWithSyntaxProperty(model, pluralModelNode),
                        ]),
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
                      factory.createTypeLiteralNode(
                        models.flatMap((model) => {
                          const comment = generateQueryTypeComment(model, 'add');

                          /**
                           * ```ts
                           * User | null
                           * ```
                           */
                          const singularModelNode = factory.createUnionTypeNode([
                            factory.createTypeReferenceNode(
                              convertToPascalCase(model.slug),
                            ),
                            factory.createLiteralTypeNode(factory.createNull()),
                          ]);

                          /**
                           * ```ts
                           * user: ReducedFunction & { ... };
                           * ```
                           */
                          const singularProperty = factory.createPropertySignature(
                            undefined,
                            model.slug,
                            undefined,
                            factory.createIntersectionTypeNode([
                              factory.createExpressionWithTypeArguments(
                                identifiers.syntax.reducedFunction,
                                undefined,
                              ),
                              factory.createTypeLiteralNode([
                                generateRootQueryCallSignature(singularModelNode),
                                generateDefaultSyntaxProperty('after', singularModelNode),
                                generateDefaultSyntaxProperty(
                                  'before',
                                  singularModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'including',
                                  singularModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'limitedTo',
                                  singularModelNode,
                                ),
                                generateOrderedBySyntaxProperty(model, singularModelNode),
                                generateSelectingSyntaxProperty(model, singularModelNode),
                                generateUsingSyntaxProperty(
                                  model,
                                  singularModelNode,
                                  convertToPascalCase(model.slug),
                                ),
                                generateWithSyntaxProperty(model, singularModelNode),
                              ]),
                            ]),
                          );

                          /**
                           * ```ts
                           * Users
                           * ```
                           */
                          const pluralModelNode = factory.createTypeReferenceNode(
                            convertToPascalCase(model.pluralSlug),
                          );

                          /**
                           * ```ts
                           * users: ReducedFunction & { ... };
                           * ```
                           */
                          const pluralProperty = factory.createPropertySignature(
                            undefined,
                            model.pluralSlug,
                            undefined,
                            factory.createIntersectionTypeNode([
                              factory.createExpressionWithTypeArguments(
                                identifiers.syntax.reducedFunction,
                                undefined,
                              ),
                              factory.createTypeLiteralNode([
                                generateRootQueryCallSignature(pluralModelNode),
                                generateDefaultSyntaxProperty('after', pluralModelNode),
                                generateDefaultSyntaxProperty('before', pluralModelNode),
                                generateDefaultSyntaxProperty(
                                  'including',
                                  pluralModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'limitedTo',
                                  pluralModelNode,
                                ),
                                generateOrderedBySyntaxProperty(model, pluralModelNode),
                                generateSelectingSyntaxProperty(model, pluralModelNode),
                                generateUsingSyntaxProperty(
                                  model,
                                  pluralModelNode,
                                  convertToPascalCase(model.pluralSlug),
                                  true,
                                ),
                                generateWithSyntaxProperty(model, pluralModelNode),
                              ]),
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
                    factory.createPropertySignature(
                      undefined,
                      'remove',
                      undefined,
                      factory.createTypeLiteralNode(
                        models.flatMap((model) => {
                          const comment = generateQueryTypeComment(model, 'remove');

                          /**
                           * ```ts
                           * User | null
                           * ```
                           */
                          const singularModelNode = factory.createUnionTypeNode([
                            factory.createTypeReferenceNode(
                              convertToPascalCase(model.slug),
                            ),
                            factory.createLiteralTypeNode(factory.createNull()),
                          ]);

                          /**
                           * ```ts
                           * user: ReducedFunction & { ... };
                           * ```
                           */
                          const singularProperty = factory.createPropertySignature(
                            undefined,
                            model.slug,
                            undefined,
                            factory.createIntersectionTypeNode([
                              factory.createExpressionWithTypeArguments(
                                identifiers.syntax.reducedFunction,
                                undefined,
                              ),
                              factory.createTypeLiteralNode([
                                generateRootQueryCallSignature(singularModelNode),
                                generateDefaultSyntaxProperty('after', singularModelNode),
                                generateDefaultSyntaxProperty(
                                  'before',
                                  singularModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'including',
                                  singularModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'limitedTo',
                                  singularModelNode,
                                ),
                                generateOrderedBySyntaxProperty(model, singularModelNode),
                                generateSelectingSyntaxProperty(model, singularModelNode),
                                generateUsingSyntaxProperty(
                                  model,
                                  singularModelNode,
                                  convertToPascalCase(model.slug),
                                ),
                                generateWithSyntaxProperty(model, singularModelNode),
                              ]),
                            ]),
                          );

                          /**
                           * ```ts
                           * Users
                           * ```
                           */
                          const pluralModelNode = factory.createTypeReferenceNode(
                            convertToPascalCase(model.pluralSlug),
                          );

                          /**
                           * ```ts
                           * users: ReducedFunction & { ... };
                           * ```
                           */
                          const pluralProperty = factory.createPropertySignature(
                            undefined,
                            model.pluralSlug,
                            undefined,
                            factory.createIntersectionTypeNode([
                              factory.createExpressionWithTypeArguments(
                                identifiers.syntax.reducedFunction,
                                undefined,
                              ),
                              factory.createTypeLiteralNode([
                                generateRootQueryCallSignature(pluralModelNode),
                                generateDefaultSyntaxProperty('after', pluralModelNode),
                                generateDefaultSyntaxProperty('before', pluralModelNode),
                                generateDefaultSyntaxProperty(
                                  'including',
                                  pluralModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'limitedTo',
                                  pluralModelNode,
                                ),
                                generateOrderedBySyntaxProperty(model, pluralModelNode),
                                generateSelectingSyntaxProperty(model, pluralModelNode),
                                generateUsingSyntaxProperty(
                                  model,
                                  pluralModelNode,
                                  convertToPascalCase(model.pluralSlug),
                                  true,
                                ),
                                generateWithSyntaxProperty(model, pluralModelNode),
                              ]),
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
                    factory.createPropertySignature(
                      undefined,
                      'set',
                      undefined,
                      factory.createTypeLiteralNode(
                        models.flatMap((model) => {
                          const comment = generateQueryTypeComment(model, 'set');

                          /**
                           * ```ts
                           * User | null
                           * ```
                           */
                          const singularModelNode = factory.createUnionTypeNode([
                            factory.createTypeReferenceNode(
                              convertToPascalCase(model.slug),
                            ),
                            factory.createLiteralTypeNode(factory.createNull()),
                          ]);

                          /**
                           * ```ts
                           * user: ReducedFunction & { ... };
                           * ```
                           */
                          const singularProperty = factory.createPropertySignature(
                            undefined,
                            model.slug,
                            undefined,
                            factory.createIntersectionTypeNode([
                              factory.createExpressionWithTypeArguments(
                                identifiers.syntax.reducedFunction,
                                undefined,
                              ),
                              factory.createTypeLiteralNode([
                                generateRootQueryCallSignature(singularModelNode),
                                generateDefaultSyntaxProperty('after', singularModelNode),
                                generateDefaultSyntaxProperty(
                                  'before',
                                  singularModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'including',
                                  singularModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'limitedTo',
                                  singularModelNode,
                                ),
                                generateOrderedBySyntaxProperty(model, singularModelNode),
                                generateSelectingSyntaxProperty(model, singularModelNode),
                                generateUsingSyntaxProperty(
                                  model,
                                  singularModelNode,
                                  convertToPascalCase(model.slug),
                                ),
                                generateWithSyntaxProperty(model, singularModelNode),
                              ]),
                            ]),
                          );

                          /**
                           * ```ts
                           * Users
                           * ```
                           */
                          const pluralModelNode = factory.createTypeReferenceNode(
                            convertToPascalCase(model.pluralSlug),
                          );

                          /**
                           * ```ts
                           * users: ReducedFunction & { ... };
                           * ```
                           */
                          const pluralProperty = factory.createPropertySignature(
                            undefined,
                            model.pluralSlug,
                            undefined,
                            factory.createIntersectionTypeNode([
                              factory.createExpressionWithTypeArguments(
                                identifiers.syntax.reducedFunction,
                                undefined,
                              ),
                              factory.createTypeLiteralNode([
                                generateRootQueryCallSignature(pluralModelNode),
                                generateDefaultSyntaxProperty('after', pluralModelNode),
                                generateDefaultSyntaxProperty('before', pluralModelNode),
                                generateDefaultSyntaxProperty(
                                  'including',
                                  pluralModelNode,
                                ),
                                generateDefaultSyntaxProperty(
                                  'limitedTo',
                                  pluralModelNode,
                                ),
                                generateOrderedBySyntaxProperty(model, pluralModelNode),
                                generateSelectingSyntaxProperty(model, pluralModelNode),
                                generateDefaultSyntaxProperty('to', pluralModelNode),
                                generateUsingSyntaxProperty(
                                  model,
                                  pluralModelNode,
                                  convertToPascalCase(model.pluralSlug),
                                  true,
                                ),
                                generateWithSyntaxProperty(model, pluralModelNode),
                              ]),
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
