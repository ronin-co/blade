import { SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { createImportDeclaration } from '@/src/generators/import';

/**
 * ```ts
 * import type { CombinedInstructions } from "blade-compiler";
 * ```
 */
export const importBladeCompilerQueryTypesType = createImportDeclaration({
  identifiers: [{ name: identifiers.compiler.combinedInstructions }],
  module: identifiers.compiler.module.root,
  type: true,
});

/**
 * ```ts
 * import type { StoredObject } from "blade-compiler";
 * ```
 */
export const importBladeCompilerStoredObjectType = createImportDeclaration({
  identifiers: [{ name: identifiers.compiler.storedObject }],
  module: identifiers.compiler.module.root,
  type: true,
});

/**
 * ```ts
 * import type { ResultRecord } from "blade-syntax/queries";
 * ```
 */
export const importSyntaxUtilTypesType = createImportDeclaration({
  identifiers: [{ name: identifiers.syntax.resultRecord }],
  module: identifiers.syntax.module.queries,
  type: true,
});

/**
 * ```ts
 * type ResolveSchema<
 *  S,
 *  U extends Array<string> | 'all',
 *  K extends string
 * > = U extends 'all'
 *  ? S
 *  : K extends U[number]
 *    ? S
 *    : S extends Array<any>
 *      ? Array<string>
 *      : string;
 * ```
 */
export const resolveSchemaType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.utils.resolveSchema,
  [
    /**
     * ```ts
     * S
     * ```
     */
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.schema),

    /**
     * ```ts
     * U extends Array<string> | 'all'
     * ```
     */
    factory.createTypeParameterDeclaration(
      undefined,
      typeArgumentIdentifiers.using,
      factory.createUnionTypeNode([
        factory.createTypeReferenceNode(identifiers.primitive.array, [
          factory.createUnionTypeNode([
            factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
          ]),
        ]),
        factory.createLiteralTypeNode(
          factory.createStringLiteral(identifiers.utils.all.text),
        ),
      ]),
    ),

    /**
     * ```ts
     * K extends string
     * ```
     */
    factory.createTypeParameterDeclaration(
      undefined,
      typeArgumentIdentifiers.key,
      factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    ),
  ],
  factory.createConditionalTypeNode(
    factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
    factory.createLiteralTypeNode(
      factory.createStringLiteral(identifiers.utils.all.text),
    ),
    factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),

    factory.createConditionalTypeNode(
      factory.createTypeReferenceNode(typeArgumentIdentifiers.key),
      factory.createIndexedAccessTypeNode(
        factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        factory.createKeywordTypeNode(SyntaxKind.NumberKeyword),
      ),
      factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),

      factory.createConditionalTypeNode(
        factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),
        factory.createTypeReferenceNode(identifiers.primitive.array, [
          factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
        ]),
        factory.createTypeReferenceNode(identifiers.primitive.array, [
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        ]),
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
      ),
    ),
  ),
);

/**
 * ```ts
 * type JsonPrimitive = string | number | boolean | null;
 * ```
 */
export const jsonPrimitiveType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.utils.jsonPrimitive,
  undefined,
  factory.createUnionTypeNode([
    factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    factory.createKeywordTypeNode(SyntaxKind.NumberKeyword),
    factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
    factory.createLiteralTypeNode(factory.createNull()),
  ]),
);

/**
 * ```ts
 * type JsonObject = { [key: string]: JsonPrimitive | JsonObject | JsonArray };
 * ```
 */
export const jsonObjectType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.utils.jsonObject,
  undefined,
  factory.createTypeLiteralNode([
    factory.createIndexSignature(
      undefined,
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createIdentifier('key'),
          undefined,
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        ),
      ],
      factory.createUnionTypeNode([
        factory.createTypeReferenceNode(identifiers.utils.jsonPrimitive),
        factory.createTypeReferenceNode(identifiers.utils.jsonObject),
        factory.createTypeReferenceNode(identifiers.utils.jsonArray),
      ]),
    ),
  ]),
);

/**
 * ```ts
 * type JsonArray = Array<JsonPrimitive | JsonObject | JsonArray>;
 * ```
 */
export const jsonArrayType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.utils.jsonArray,
  undefined,
  factory.createTypeReferenceNode(identifiers.primitive.array, [
    factory.createUnionTypeNode([
      factory.createTypeReferenceNode(identifiers.utils.jsonPrimitive),
      factory.createTypeReferenceNode(identifiers.utils.jsonObject),
      factory.createTypeReferenceNode(identifiers.utils.jsonArray),
    ]),
  ]),
);

/**
 * ```ts
 * interface ReducedFunction {
 *  // @ deprecated
 *  apply: never;
 *  // @ deprecated
 *  arguments: never;
 *  // @ deprecated
 *  bind: never;
 *  // @ deprecated
 *  call: never;
 *  // @ deprecated
 *  caller: never;
 *  // @ deprecated
 *  length: never;
 *  // @ deprecated
 *  name: any;
 *  // @ deprecated
 *  prototype: never;
 *  // @ deprecated
 *  toString: never;
 *  // @ deprecated
 *  unify: never;
 * }
 * ```
 */
export const reducedFunctionType = factory.createInterfaceDeclaration(
  [],
  identifiers.utils.reducedFunction,
  undefined,
  undefined,
  [
    'apply',
    'arguments',
    'bind',
    'call',
    'caller',
    'length',
    'name',
    'prototype',
    'toString',
    'unify',
  ].map((property) =>
    addSyntheticLeadingComment(
      factory.createPropertySignature(
        undefined,
        property,
        undefined,
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
      ),
      SyntaxKind.MultiLineCommentTrivia,
      ' @deprecated ',
      true,
    ),
  ),
);
