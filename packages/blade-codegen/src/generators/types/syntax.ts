import { NodeFlags, SyntaxKind, factory } from 'typescript';

import {
  identifiers,
  // typeArgumentIdentifiers
} from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
// import { sharedQueryOptionsParameter } from '@/src/declarations';
import { convertToPascalCase } from '@/src/utils/slug';

// import type { CombinedInstructions } from 'blade-compiler';
// import type {
//   Identifier,
//   ModuleDeclaration,
//   TypeAliasDeclaration,
//   TypeElement,
//   TypeNode,
// } from 'typescript';

import type { Model } from '@/src/types/model';

// interface BaseGeneratorOptions {
//   modelNode: TypeNode;
//   promise?: boolean;
// }

// /**
//  * Generates the call signature for the root query.
//  *
//  * @example
//  * ```ts
//  * <T = User | null>(options?: Partial<CombinedInstructions>): T;
//  * ```
//  *
//  * @param options - The options for generating the call signature.
//  *
//  * @returns A call signature node.
//  */
// export const generateRootQueryCallSignature = (options: BaseGeneratorOptions) =>
//   factory.createTypeAliasDeclaration(
//     undefined,
//     options.promise
//       ? identifiers.syntax.rootCallerPromise
//       : identifiers.syntax.rootCaller,
//     undefined,
//     factory.createFunctionTypeNode(
//       [
//         factory.createTypeParameterDeclaration(
//           undefined,
//           typeArgumentIdentifiers.default,
//           undefined,
//           options.modelNode,
//         ),
//       ],
//       [
//         factory.createParameterDeclaration(
//           undefined,
//           undefined,
//           'instructions',
//           factory.createToken(SyntaxKind.QuestionToken),
//           factory.createTypeReferenceNode(identifiers.primitive.partial, [
//             factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
//           ]),
//         ),
//         sharedQueryOptionsParameter,
//       ],
//       options?.promise
//         ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
//             factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//           ])
//         : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//     ),
//   );

// /**
//  * Generate a base or default syntax property that falls back to `CombinedInstructions`
//  *
//  * @example
//  * ```ts
//  * after: ReducedFunction & (<T = User | null>(value: CombinedInstructions["after"]) => T);
//  * ```
//  *
//  * @param options - The options for generating the syntax property.
//  *
//  * @returns A property signature node.
//  */
// export const generateDefaultSyntaxProperty = (
//   options: BaseGeneratorOptions & {
//     name: string | Identifier;
//     instruction: keyof CombinedInstructions;
//   },
// ): TypeAliasDeclaration =>
//   factory.createTypeAliasDeclaration(
//     undefined,
//     options.name,
//     undefined,
//     factory.createIntersectionTypeNode([
//       factory.createExpressionWithTypeArguments(
//         identifiers.blade.reducedFunction,
//         undefined,
//       ),
//       factory.createFunctionTypeNode(
//         [
//           factory.createTypeParameterDeclaration(
//             undefined,
//             typeArgumentIdentifiers.default,
//             undefined,
//             options.modelNode,
//           ),
//         ],
//         [
//           factory.createParameterDeclaration(
//             undefined,
//             undefined,
//             'value',
//             undefined,
//             factory.createIndexedAccessTypeNode(
//               factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
//               factory.createLiteralTypeNode(
//                 factory.createStringLiteral(options.instruction),
//               ),
//             ),
//           ),
//           sharedQueryOptionsParameter,
//         ],
//         options?.promise
//           ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
//               factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//             ])
//           : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//       ),
//     ]),
//   );

// /**
//  * Generate a strictly typed `orderedBy` syntax property.
//  *
//  * @example
//  * ```ts
//  * orderedBy: ReducedFunction & (<T = User | null>(options: {
//  *  ascending?: Array<Expression | UserFieldSlug>;
//  *  descending?: Array<Expression | UserFieldSlug>;
//  * }) => T) & {
//  *  ascending: <T = User | null>(fields: Array<Expression | UserFieldSlug>) => T;
//  *  descending: <T = User | null>(fields: Array<Expression | UserFieldSlug>) => T;
//  * };
//  * ```
//  *
//  * @param options - The options for generating the syntax property.
//  *
//  * @returns A property signature node.
//  */
// export const generateOrderedBySyntaxProperty = (
//   options: BaseGeneratorOptions & {
//     model: Model;
//   },
// ): TypeAliasDeclaration =>
//   factory.createTypeAliasDeclaration(
//     undefined,
//     options.promise ? identifiers.syntax.orderedByPromise : identifiers.syntax.orderedBy,
//     undefined,
//     factory.createIntersectionTypeNode([
//       factory.createExpressionWithTypeArguments(
//         options.promise
//           ? identifiers.syntax.utils.orderedByQueryPromise
//           : identifiers.syntax.utils.orderedByQuery,
//         [
//           options.modelNode,
//           factory.createTypeReferenceNode(
//             factory.createQualifiedName(
//               factory.createIdentifier(
//                 `${convertToPascalCase(options.model.slug)}Syntax`,
//               ),
//               identifiers.syntax.fieldSlug,
//             ),
//           ),
//         ],
//       ),
//     ]),
//   );

// /**
//  * Generates the syntax property for `selecting` fields.
//  *
//  * @example
//  * ```ts
//  * selecting: ReducedFunction & (<T = User | null>(options: Array<UserFieldSlug>) => T);
//  * ```
//  *
//  * @param options - The options for generating the syntax property.
//  *
//  * @returns A property signature node.
//  */
// export const generateSelectingSyntaxProperty = (
//   options: BaseGeneratorOptions & {
//     model: Model;
//   },
// ): TypeAliasDeclaration =>
//   factory.createTypeAliasDeclaration(
//     undefined,
//     options.promise ? identifiers.syntax.selectingPromise : identifiers.syntax.selecting,
//     undefined,
//     factory.createIntersectionTypeNode([
//       factory.createExpressionWithTypeArguments(
//         identifiers.blade.reducedFunction,
//         undefined,
//       ),
//       factory.createFunctionTypeNode(
//         [
//           factory.createTypeParameterDeclaration(
//             undefined,
//             typeArgumentIdentifiers.default,
//             undefined,
//             options.modelNode,
//           ),
//         ],
//         [
//           factory.createParameterDeclaration(
//             undefined,
//             undefined,
//             'instructions',
//             undefined,
//             factory.createTypeReferenceNode(identifiers.primitive.array, [
//               factory.createTypeReferenceNode(
//                 factory.createQualifiedName(
//                   factory.createIdentifier(
//                     `${convertToPascalCase(options.model.slug)}Syntax`,
//                   ),
//                   identifiers.syntax.fieldSlug,
//                 ),
//               ),
//             ]),
//           ),
//           sharedQueryOptionsParameter,
//         ],
//         options?.promise
//           ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
//               factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//             ])
//           : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//       ),
//     ]),
//   );

// /**
//  * Generates the syntax property for `using` fields.
//  *
//  * @example
//  * ```ts
//  * using: ReducedFunction & {
//  *  <U extends Array<"author"> | "all">(fields: U): Post<U> | null;
//  *  <T = Post | null>(fields: Array<"author"> | "all"): T;
//  * };
//  * ```
//  *
//  * @param options - The options for generating the syntax property.
//  * @returns A property signature node.
//  */
// export const generateUsingSyntaxProperty = (
//   options: BaseGeneratorOptions & {
//     model: Model;
//     slug: string;
//     isPlural?: boolean;
//   },
// ): TypeAliasDeclaration => {
//   const hasLinkFields = Object.values(options.model.fields).some(
//     (field) => field.type === 'link',
//   );
//   if (!hasLinkFields)
//     return generateDefaultSyntaxProperty({
//       instruction: 'using',
//       name: options.promise ? identifiers.syntax.usingPromise : identifiers.syntax.using,
//       modelNode: options.modelNode,
//     });

//   /**
//    * ```ts
//    * Array<'...'> | 'all'
//    * ```
//    */
//   const arrayFieldsType = factory.createUnionTypeNode([
//     factory.createTypeReferenceNode(identifiers.primitive.array, [
//       factory.createUnionTypeNode(
//         Object.entries(options.model.fields)
//           .filter(([, field]) => field.type === 'link')
//           .map(([name]) =>
//             factory.createLiteralTypeNode(factory.createStringLiteral(name)),
//           ),
//       ),
//     ]),
//     factory.createLiteralTypeNode(factory.createStringLiteral('all')),
//   ]);

//   /**
//    * ```ts
//    * User<U>
//    * ```
//    */
//   const baseModelWithFields = factory.createTypeReferenceNode(
//     factory.createIdentifier(options.slug),
//     [factory.createTypeReferenceNode(typeArgumentIdentifiers.using)],
//   );
//   const modelNodeWithFields = options?.promise
//     ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
//         baseModelWithFields,
//       ])
//     : baseModelWithFields;

//   return factory.createTypeAliasDeclaration(
//     undefined,
//     options.promise ? identifiers.syntax.usingPromise : identifiers.syntax.using,
//     undefined,
//     factory.createIntersectionTypeNode([
//       factory.createExpressionWithTypeArguments(
//         identifiers.blade.reducedFunction,
//         undefined,
//       ),
//       factory.createTypeLiteralNode([
//         factory.createCallSignature(
//           [
//             factory.createTypeParameterDeclaration(
//               undefined,
//               typeArgumentIdentifiers.using,
//               arrayFieldsType,
//             ),
//           ],
//           [
//             factory.createParameterDeclaration(
//               undefined,
//               undefined,
//               'fields',
//               undefined,
//               factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
//             ),
//             sharedQueryOptionsParameter,
//           ],
//           options.isPlural
//             ? modelNodeWithFields
//             : factory.createUnionTypeNode([
//                 modelNodeWithFields,
//                 factory.createLiteralTypeNode(factory.createNull()),
//               ]),
//         ),

//         factory.createCallSignature(
//           [
//             factory.createTypeParameterDeclaration(
//               undefined,
//               typeArgumentIdentifiers.default,
//               undefined,
//               options.modelNode,
//             ),
//           ],
//           [
//             factory.createParameterDeclaration(
//               undefined,
//               undefined,
//               'fields',
//               undefined,
//               arrayFieldsType,
//             ),
//             sharedQueryOptionsParameter,
//           ],
//           options?.promise
//             ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
//                 factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//               ])
//             : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//         ),
//       ]),
//     ]),
//   );
// };

// /**
//  * Generates the syntax property for `with` fields.
//  *
//  * @example
//  * ```ts
//  * with: ReducedFunction & {
//  *  <T = User | null>(options: CombinedInstructions["with"]): T;
//  *  id: <T = User | null>(value: ResultRecord["id"]) => T;
//  *  ronin: ReducedFunction & {
//  *    createdAt: <T = User | null>(value: ResultRecord["ronin"]["createdAt"]) => T;
//  *    createdBy: <T = User | null>(value: ResultRecord["ronin"]["createdBy"]) => T;
//  *    updatedAt: <T = User | null>(value: ResultRecord["ronin"]["updatedAt"]) => T;
//  *    updatedBy: <T = User | null>(value: ResultRecord["ronin"]["updatedBy"]) => T;
//  *  };
//  *  name: <T = User | null>(name: Post["name"]) => T;
//  *  // [...]
//  * };
//  * ```
//  *
//  * @param options - The options for generating the syntax property.
//  *
//  * @returns A property signature node.
//  */
// export const generateWithSyntaxProperty = (
//   options: BaseGeneratorOptions & {
//     model: Model;
//   },
// ): TypeAliasDeclaration => {
//   const members = new Array<TypeElement>();

//   for (const slug of Object.keys(options.model.fields)) {
//     if (DEFAULT_FIELD_SLUGS.some((field) => field.includes(slug))) continue;

//     members.push(
//       factory.createPropertySignature(
//         undefined,
//         slug,
//         undefined,
//         factory.createFunctionTypeNode(
//           [
//             factory.createTypeParameterDeclaration(
//               undefined,
//               typeArgumentIdentifiers.default,
//               undefined,
//               options.modelNode,
//             ),
//           ],
//           [
//             factory.createParameterDeclaration(
//               undefined,
//               undefined,
//               slug,
//               undefined,
//               factory.createIndexedAccessTypeNode(
//                 factory.createTypeReferenceNode(convertToPascalCase(options.model.slug)),
//                 factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
//               ),
//             ),
//             sharedQueryOptionsParameter,
//           ],
//           options?.promise
//             ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
//                 factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//               ])
//             : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
//         ),
//       ),
//     );
//   }

//   return factory.createTypeAliasDeclaration(
//     undefined,
//     options.promise ? identifiers.syntax.withPromise : identifiers.syntax.with,
//     undefined,
//     factory.createIntersectionTypeNode([
//       factory.createExpressionWithTypeArguments(
//         options.promise
//           ? identifiers.syntax.utils.withQueryPromise
//           : identifiers.syntax.utils.withQuery,
//         [options.modelNode],
//       ),
//       // TODO(@nurodev): Add support for with conditions like `startingWith`, `notStartingWith`, etc.
//       factory.createTypeLiteralNode(members),
//     ]),
//   );
// };

/**
 * @todo Add documentation
 */
export const generateNamespaces = (models: Array<Model>) =>
  models.map((model) => {
    /**
     * @example
     * ```ts
     * type FieldSlug =
     *  | "id"
     *  | "ronin.createdAt"
     *  | "ronin.createdBy"
     *  | "ronin.updatedAt"
     *  | "ronin.updatedBy"
     *  | "name"
     *  | "email";
     * ```
     */
    const fieldSlugType = factory.createTypeAliasDeclaration(
      undefined,
      identifiers.namespace.syntax.fieldSlug,
      undefined,
      factory.createUnionTypeNode(
        [...DEFAULT_FIELD_SLUGS, ...Object.keys(model.fields)].map((slug) =>
          factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
        ),
      ),
    );

    const singularModelNode = factory.createUnionTypeNode([
      factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
      factory.createLiteralTypeNode(factory.createNull()),
    ]);

    const singularNamespace = factory.createModuleDeclaration(
      undefined,
      identifiers.namespace.syntax.singular,
      factory.createModuleBlock([
        factory.createTypeAliasDeclaration(
          undefined,
          identifiers.namespace.utils.rootQueryCaller,
          undefined,
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              identifiers.namespace.utils.name,
              identifiers.namespace.utils.rootQueryCaller,
            ),
            [singularModelNode],
          ),
        ),
      ]),
      NodeFlags.Namespace,
    );

    const pluralModelNode = factory.createTypeReferenceNode(
      convertToPascalCase(model.pluralSlug),
    );

    const pluralNamespace = factory.createModuleDeclaration(
      undefined,
      identifiers.namespace.syntax.plural,
      factory.createModuleBlock([
        factory.createTypeAliasDeclaration(
          undefined,
          identifiers.namespace.utils.rootQueryCaller,
          undefined,
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              identifiers.namespace.utils.name,
              identifiers.namespace.utils.rootQueryCaller,
            ),
            [pluralModelNode],
          ),
        ),
      ]),
      NodeFlags.Namespace,
    );

    return factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      factory.createIdentifier(`${convertToPascalCase(model.slug)}Syntax`),
      factory.createModuleBlock([fieldSlugType, singularNamespace, pluralNamespace]),
      NodeFlags.Namespace,
    );
  });
