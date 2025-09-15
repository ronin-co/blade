import { SyntaxKind, factory } from 'typescript';

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
  rootCallerQueryPromiseType,
  rootCallerQueryType,
  withQueryPromiseType,
  withQueryType,
} from '@/src/declarations';
import { importBladeCompilerQueryTypesType } from '@/src/declarations';
import { createImportDeclaration } from '@/src/generators/import';
import { generateModelTypes } from '@/src/generators/types/model';
import { generateNamespaces } from '@/src/generators/types/syntax';
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

  /**
   * ```ts
   * type OrderedByQuery<U, T> = ReducedFunction & { ... };
   * type OrderedByQueryPromise<U, T> = ReducedFunction & { ... };
   * type WithQuery<U> = ReducedFunction & { ... };
   * type WithQueryPromise<U> = ReducedFunction & { ... };
   * ```
   */
  nodes.push(
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
    rootCallerQueryType,
    rootCallerQueryPromiseType,
    withQueryType,
    withQueryPromiseType,
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
   * ```ts
   * declare namespace UserSyntax {
   *  // ...
   * }
   * ```
   */
  nodes.push(...generateNamespaces(models));

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

  // /**
  //  * @example
  //  * ```ts
  //  * declare module "blade/server/hooks" {
  //  *  declare const use: {
  //  *    // Get a single user record
  //  *    user: ReducedFunction & {
  //  *      // ...
  //  *    };
  //  *    // Get multiple user records
  //  *    users: ReducedFunction & {
  //  *      // ...
  //  *    };
  //  *  };
  //  * }
  //  * ```
  //  */
  // nodes.push(
  //   factory.createModuleDeclaration(
  //     [factory.createModifier(SyntaxKind.DeclareKeyword)],
  //     identifiers.blade.module.server.hooks,
  //     factory.createModuleBlock([
  //       factory.createVariableStatement(
  //         [factory.createModifier(SyntaxKind.DeclareKeyword)],
  //         factory.createVariableDeclarationList(
  //           [
  //             factory.createVariableDeclaration(
  //               'use',
  //               undefined,
  //               factory.createTypeLiteralNode(
  //                 models.flatMap((model) => {
  //                   const comment = generateQueryTypeComment(model, 'use');

  //                   const modelSyntaxIdentifier = factory.createIdentifier(
  //                     `${convertToPascalCase(model.slug)}Syntax`,
  //                   );

  //                   // /**
  //                   //  * ```ts
  //                   //  * User | null
  //                   //  * ```
  //                   //  */
  //                   // const singularModelNode = factory.createUnionTypeNode([
  //                   //   factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
  //                   //   factory.createLiteralTypeNode(factory.createNull()),
  //                   // ]);

  //                   /**
  //                    * ```ts
  //                    * user: ReducedFunction & UserSyntax.Singular.RootCaller & { ... };
  //                    * ```
  //                    */
  //                   const singularProperty = factory.createPropertySignature(
  //                     undefined,
  //                     model.slug,
  //                     undefined,
  //                     factory.createIntersectionTypeNode([
  //                       factory.createExpressionWithTypeArguments(
  //                         identifiers.blade.reducedFunction,
  //                         undefined,
  //                       ),
  //                       factory.createTypeReferenceNode(
  //                         factory.createQualifiedName(
  //                           factory.createQualifiedName(
  //                             modelSyntaxIdentifier,
  //                             identifiers.syntax.singular,
  //                           ),
  //                           identifiers.syntax.rootCaller,
  //                         ),
  //                       ),
  //                       factory.createTypeLiteralNode([
  //                         // generateRootQueryCallSignature({
  //                         //   modelNode: singularModelNode,
  //                         // }),
  //                         // generateDefaultSyntaxProperty({
  //                         //   name: 'after',
  //                         //   modelNode: singularModelNode,
  //                         // }),
  //                         // generateDefaultSyntaxProperty({
  //                         //   name: 'before',
  //                         //   modelNode: singularModelNode,
  //                         // }),
  //                         // generateDefaultSyntaxProperty({
  //                         //   name: 'including',
  //                         //   modelNode: singularModelNode,
  //                         // }),
  //                         // generateDefaultSyntaxProperty({
  //                         //   name: 'limitedTo',
  //                         //   modelNode: singularModelNode,
  //                         // }),
  //                         // generateOrderedBySyntaxProperty({
  //                         //   model,
  //                         //   modelNode: singularModelNode,
  //                         // }),
  //                         // generateSelectingSyntaxProperty({
  //                         //   model,
  //                         //   modelNode: singularModelNode,
  //                         // }),
  //                         // generateUsingSyntaxProperty({
  //                         //   model,
  //                         //   modelNode: singularModelNode,
  //                         //   slug: convertToPascalCase(model.slug),
  //                         // }),
  //                         // generateWithSyntaxProperty({
  //                         //   model,
  //                         //   modelNode: singularModelNode,
  //                         // }),
  //                       ]),
  //                     ]),
  //                   );

  //                   // /**
  //                   //  * ```ts
  //                   //  * Users
  //                   //  * ```
  //                   //  */
  //                   // const pluralModelNode = factory.createTypeReferenceNode(
  //                   //   convertToPascalCase(model.pluralSlug),
  //                   // );

  //                   /**
  //                    * ```ts
  //                    * users: ReducedFunction & UserSyntax.Plural.RootCaller & { ... };
  //                    * ```
  //                    */
  //                   const pluralProperty = factory.createPropertySignature(
  //                     undefined,
  //                     model.pluralSlug,
  //                     undefined,
  //                     factory.createIntersectionTypeNode([
  //                       factory.createExpressionWithTypeArguments(
  //                         identifiers.blade.reducedFunction,
  //                         undefined,
  //                       ),
  //                       factory.createTypeReferenceNode(
  //                         factory.createQualifiedName(
  //                           factory.createQualifiedName(
  //                             modelSyntaxIdentifier,
  //                             identifiers.syntax.plural,
  //                           ),
  //                           identifiers.syntax.rootCaller,
  //                         ),
  //                       ),

  //                       factory.createTypeLiteralNode([
  //                         // generateRootQueryCallSignature({ modelNode: pluralModelNode }),
  //                         // generateDefaultSyntaxProperty({
  //                         //   name: 'after',
  //                         //   modelNode: pluralModelNode,
  //                         // }),
  //                         // generateDefaultSyntaxProperty({
  //                         //   name: 'before',
  //                         //   modelNode: pluralModelNode,
  //                         // }),
  //                         // generateDefaultSyntaxProperty({
  //                         //   name: 'including',
  //                         //   modelNode: pluralModelNode,
  //                         // }),
  //                         // generateDefaultSyntaxProperty({
  //                         //   name: 'limitedTo',
  //                         //   modelNode: pluralModelNode,
  //                         // }),
  //                         // generateOrderedBySyntaxProperty({
  //                         //   model,
  //                         //   modelNode: pluralModelNode,
  //                         // }),
  //                         // generateSelectingSyntaxProperty({
  //                         //   model,
  //                         //   modelNode: pluralModelNode,
  //                         // }),
  //                         // generateUsingSyntaxProperty({
  //                         //   model,
  //                         //   modelNode: pluralModelNode,
  //                         //   slug: convertToPascalCase(model.pluralSlug),
  //                         //   isPlural: true,
  //                         // }),
  //                         // generateWithSyntaxProperty({
  //                         //   model,
  //                         //   modelNode: pluralModelNode,
  //                         // }),
  //                       ]),
  //                     ]),
  //                   );

  //                   return [
  //                     addSyntheticLeadingComment(
  //                       singularProperty,
  //                       SyntaxKind.MultiLineCommentTrivia,
  //                       comment.singular,
  //                       true,
  //                     ),
  //                     addSyntheticLeadingComment(
  //                       pluralProperty,
  //                       SyntaxKind.MultiLineCommentTrivia,
  //                       comment.plural,
  //                       true,
  //                     ),
  //                   ];
  //                 }),
  //               ),
  //             ),
  //           ],
  //           NodeFlags.Const,
  //         ),
  //       ),
  //     ]),
  //   ),
  // );

  // /**
  //  * @example
  //  * ```ts
  //  * declare module "blade/client/hooks" {
  //  *  declare const useMutation: () => {
  //  *    add: { ... }
  //  *    remove: { ... }
  //  *    set: { ... }
  //  *  };
  //  * }
  //  * ```
  //  */
  // nodes.push(
  //   factory.createModuleDeclaration(
  //     [factory.createModifier(SyntaxKind.DeclareKeyword)],
  //     identifiers.blade.module.client.hooks,
  //     factory.createModuleBlock([
  //       factory.createVariableStatement(
  //         [factory.createModifier(SyntaxKind.DeclareKeyword)],
  //         factory.createVariableDeclarationList(
  //           [
  //             factory.createVariableDeclaration(
  //               factory.createIdentifier('useMutation'),
  //               undefined,
  //               factory.createFunctionTypeNode(
  //                 undefined,
  //                 [],
  //                 factory.createTypeLiteralNode([
  //                   factory.createPropertySignature(
  //                     undefined,
  //                     'add',
  //                     undefined,
  //                     factory.createTypeLiteralNode(
  //                       models.flatMap((model) => {
  //                         const comment = generateQueryTypeComment(model, 'add');

  //                         /**
  //                          * ```ts
  //                          * User | null
  //                          * ```
  //                          */
  //                         const singularModelNode = factory.createUnionTypeNode([
  //                           factory.createTypeReferenceNode(
  //                             convertToPascalCase(model.slug),
  //                           ),
  //                           factory.createLiteralTypeNode(factory.createNull()),
  //                         ]);

  //                         /**
  //                          * ```ts
  //                          * user: ReducedFunction & { ... };
  //                          * ```
  //                          */
  //                         const singularProperty = factory.createPropertySignature(
  //                           undefined,
  //                           model.slug,
  //                           undefined,
  //                           factory.createIntersectionTypeNode([
  //                             factory.createExpressionWithTypeArguments(
  //                               identifiers.blade.reducedFunction,
  //                               undefined,
  //                             ),
  //                             factory.createTypeLiteralNode([
  //                               // generateRootQueryCallSignature({
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'after',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'before',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'including',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'limitedTo',
  //                               //   promise: true,
  //                               // }),
  //                               // generateOrderedBySyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateSelectingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateUsingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               //   slug: convertToPascalCase(model.slug),
  //                               // }),
  //                               // generateWithSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                             ]),
  //                           ]),
  //                         );

  //                         /**
  //                          * ```ts
  //                          * Users
  //                          * ```
  //                          */
  //                         const pluralModelNode = factory.createTypeReferenceNode(
  //                           convertToPascalCase(model.pluralSlug),
  //                         );

  //                         /**
  //                          * ```ts
  //                          * users: ReducedFunction & { ... };
  //                          * ```
  //                          */
  //                         const pluralProperty = factory.createPropertySignature(
  //                           undefined,
  //                           model.pluralSlug,
  //                           undefined,
  //                           factory.createIntersectionTypeNode([
  //                             factory.createExpressionWithTypeArguments(
  //                               identifiers.blade.reducedFunction,
  //                               undefined,
  //                             ),
  //                             factory.createTypeLiteralNode([
  //                               // generateRootQueryCallSignature({
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'after',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'before',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'including',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'limitedTo',
  //                               //   promise: true,
  //                               // }),
  //                               // generateOrderedBySyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateSelectingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateUsingSyntaxProperty({
  //                               //   isPlural: true,
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               //   slug: convertToPascalCase(model.pluralSlug),
  //                               // }),
  //                               // generateWithSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                             ]),
  //                           ]),
  //                         );

  //                         return [
  //                           addSyntheticLeadingComment(
  //                             singularProperty,
  //                             SyntaxKind.MultiLineCommentTrivia,
  //                             comment.singular,
  //                             true,
  //                           ),
  //                           addSyntheticLeadingComment(
  //                             pluralProperty,
  //                             SyntaxKind.MultiLineCommentTrivia,
  //                             comment.plural,
  //                             true,
  //                           ),
  //                         ];
  //                       }),
  //                     ),
  //                   ),
  //                   factory.createPropertySignature(
  //                     undefined,
  //                     'remove',
  //                     undefined,
  //                     factory.createTypeLiteralNode(
  //                       models.flatMap((model) => {
  //                         const comment = generateQueryTypeComment(model, 'remove');

  //                         /**
  //                          * ```ts
  //                          * User | null
  //                          * ```
  //                          */
  //                         const singularModelNode = factory.createUnionTypeNode([
  //                           factory.createTypeReferenceNode(
  //                             convertToPascalCase(model.slug),
  //                           ),
  //                           factory.createLiteralTypeNode(factory.createNull()),
  //                         ]);

  //                         /**
  //                          * ```ts
  //                          * user: ReducedFunction & { ... };
  //                          * ```
  //                          */
  //                         const singularProperty = factory.createPropertySignature(
  //                           undefined,
  //                           model.slug,
  //                           undefined,
  //                           factory.createIntersectionTypeNode([
  //                             factory.createExpressionWithTypeArguments(
  //                               identifiers.blade.reducedFunction,
  //                               undefined,
  //                             ),
  //                             factory.createTypeLiteralNode([
  //                               // generateRootQueryCallSignature({
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'after',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'before',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'including',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'limitedTo',
  //                               //   promise: true,
  //                               // }),
  //                               // generateOrderedBySyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateSelectingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateUsingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               //   slug: convertToPascalCase(model.slug),
  //                               // }),
  //                               // generateWithSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                             ]),
  //                           ]),
  //                         );

  //                         /**
  //                          * ```ts
  //                          * Users
  //                          * ```
  //                          */
  //                         const pluralModelNode = factory.createTypeReferenceNode(
  //                           convertToPascalCase(model.pluralSlug),
  //                         );

  //                         /**
  //                          * ```ts
  //                          * users: ReducedFunction & { ... };
  //                          * ```
  //                          */
  //                         const pluralProperty = factory.createPropertySignature(
  //                           undefined,
  //                           model.pluralSlug,
  //                           undefined,
  //                           factory.createIntersectionTypeNode([
  //                             factory.createExpressionWithTypeArguments(
  //                               identifiers.blade.reducedFunction,
  //                               undefined,
  //                             ),
  //                             factory.createTypeLiteralNode([
  //                               // generateRootQueryCallSignature({
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'after',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'before',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'including',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'limitedTo',
  //                               //   promise: true,
  //                               // }),
  //                               // generateOrderedBySyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateSelectingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateUsingSyntaxProperty({
  //                               //   isPlural: true,
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               //   slug: convertToPascalCase(model.pluralSlug),
  //                               // }),
  //                               // generateWithSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                             ]),
  //                           ]),
  //                         );

  //                         return [
  //                           addSyntheticLeadingComment(
  //                             singularProperty,
  //                             SyntaxKind.MultiLineCommentTrivia,
  //                             comment.singular,
  //                             true,
  //                           ),
  //                           addSyntheticLeadingComment(
  //                             pluralProperty,
  //                             SyntaxKind.MultiLineCommentTrivia,
  //                             comment.plural,
  //                             true,
  //                           ),
  //                         ];
  //                       }),
  //                     ),
  //                   ),
  //                   factory.createPropertySignature(
  //                     undefined,
  //                     'set',
  //                     undefined,
  //                     factory.createTypeLiteralNode(
  //                       models.flatMap((model) => {
  //                         const comment = generateQueryTypeComment(model, 'set');

  //                         /**
  //                          * ```ts
  //                          * User | null
  //                          * ```
  //                          */
  //                         const singularModelNode = factory.createUnionTypeNode([
  //                           factory.createTypeReferenceNode(
  //                             convertToPascalCase(model.slug),
  //                           ),
  //                           factory.createLiteralTypeNode(factory.createNull()),
  //                         ]);

  //                         /**
  //                          * ```ts
  //                          * user: ReducedFunction & { ... };
  //                          * ```
  //                          */
  //                         const singularProperty = factory.createPropertySignature(
  //                           undefined,
  //                           model.slug,
  //                           undefined,
  //                           factory.createIntersectionTypeNode([
  //                             factory.createExpressionWithTypeArguments(
  //                               identifiers.blade.reducedFunction,
  //                               undefined,
  //                             ),
  //                             factory.createTypeLiteralNode([
  //                               // generateRootQueryCallSignature({
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'after',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'before',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'including',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: singularModelNode,
  //                               //   name: 'limitedTo',
  //                               //   promise: true,
  //                               // }),
  //                               // generateOrderedBySyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateSelectingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateUsingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               //   slug: convertToPascalCase(model.slug),
  //                               // }),
  //                               // generateWithSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: singularModelNode,
  //                               //   promise: true,
  //                               // }),
  //                             ]),
  //                           ]),
  //                         );

  //                         /**
  //                          * ```ts
  //                          * Users
  //                          * ```
  //                          */
  //                         const pluralModelNode = factory.createTypeReferenceNode(
  //                           convertToPascalCase(model.pluralSlug),
  //                         );

  //                         /**
  //                          * ```ts
  //                          * users: ReducedFunction & { ... };
  //                          * ```
  //                          */
  //                         const pluralProperty = factory.createPropertySignature(
  //                           undefined,
  //                           model.pluralSlug,
  //                           undefined,
  //                           factory.createIntersectionTypeNode([
  //                             factory.createExpressionWithTypeArguments(
  //                               identifiers.blade.reducedFunction,
  //                               undefined,
  //                             ),
  //                             factory.createTypeLiteralNode([
  //                               // generateRootQueryCallSignature({
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'after',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'before',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'including',
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'limitedTo',
  //                               //   promise: true,
  //                               // }),
  //                               // generateOrderedBySyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateSelectingSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                               // generateDefaultSyntaxProperty({
  //                               //   modelNode: pluralModelNode,
  //                               //   name: 'to',
  //                               //   promise: true,
  //                               // }),
  //                               // generateUsingSyntaxProperty({
  //                               //   isPlural: true,
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               //   slug: convertToPascalCase(model.pluralSlug),
  //                               // }),
  //                               // generateWithSyntaxProperty({
  //                               //   model,
  //                               //   modelNode: pluralModelNode,
  //                               //   promise: true,
  //                               // }),
  //                             ]),
  //                           ]),
  //                         );

  //                         return [
  //                           addSyntheticLeadingComment(
  //                             singularProperty,
  //                             SyntaxKind.MultiLineCommentTrivia,
  //                             comment.singular,
  //                             true,
  //                           ),
  //                           addSyntheticLeadingComment(
  //                             pluralProperty,
  //                             SyntaxKind.MultiLineCommentTrivia,
  //                             comment.plural,
  //                             true,
  //                           ),
  //                         ];
  //                       }),
  //                     ),
  //                   ),
  //                 ]),
  //               ),
  //             ),
  //           ],
  //           NodeFlags.Const,
  //         ),
  //       ),
  //     ]),
  //   ),
  // );

  return printNodes(nodes);
};
