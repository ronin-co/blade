import { SyntaxKind, factory } from 'typescript';

import { genericIdentifiers, identifiers } from '@/src/constants/identifiers';
import { createImportDeclaration } from '@/src/generators/import';

/**
 * ```ts
 * import type { AddQuery, CountQuery, GetQuery, ListQuery, Model, RemoveQuery, SetQuery } from "@ronin/compiler";
 * ```
 */
export const importRoninQueryTypesType = createImportDeclaration({
  identifiers: [
    { name: identifiers.compiler.dmlQueryType.add },
    { name: identifiers.compiler.dmlQueryType.count },
    { name: identifiers.compiler.dmlQueryType.get },
    { name: identifiers.compiler.ddlQueryType.list },
    { name: identifiers.compiler.model },
    { name: identifiers.compiler.dmlQueryType.remove },
    { name: identifiers.compiler.dmlQueryType.set },
  ],
  module: identifiers.compiler.module.root,
  type: true,
});

/**
 * ```ts
 * import type { StoredObject } from "@ronin/compiler";
 * ```
 */
export const importRoninStoredObjectType = createImportDeclaration({
  identifiers: [{ name: identifiers.compiler.storedObject }],
  module: identifiers.compiler.module.root,
  type: true,
});

/**
 * ```ts
 * import type { DeepCallable, ResultRecord } from "@ronin/syntax/queries";
 * ```
 */
export const importSyntaxUtiltypesType = createImportDeclaration({
  identifiers: [
    { name: identifiers.syntax.deepCallable },
    { name: identifiers.syntax.resultRecord },
  ],
  module: identifiers.syntax.module.queries,
  type: true,
});

/**
 * ```ts
 * import type { PromiseTuple, QueryHandlerOptions } from "ronin/types";
 * ```
 */
export const importQueryHandlerOptionsType = createImportDeclaration({
  identifiers: [
    { name: identifiers.ronin.promiseTuple },
    { name: identifiers.ronin.queryHandlerOptions },
  ],
  module: identifiers.ronin.module.types,
  type: true,
});

/**
 * ```ts
 * type ResolveSchema<
 *  TSchema,
 *  TUsing extends Array<string> | 'all',
 *  TKey extends string
 * > = TUsing extends 'all'
 *  ? TSchema
 *  : TKey extends TUsing[number]
 *    ? TSchema
 *    : TSchema extends Array<any>
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
     * TSchema
     * ```
     */
    factory.createTypeParameterDeclaration(undefined, genericIdentifiers.schema),

    /**
     * ```ts
     * TUsing extends Array<string> | 'all'
     * ```
     */
    factory.createTypeParameterDeclaration(
      undefined,
      genericIdentifiers.using,
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
     * TKey extends string
     * ```
     */
    factory.createTypeParameterDeclaration(
      undefined,
      genericIdentifiers.key,
      factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    ),
  ],
  factory.createConditionalTypeNode(
    factory.createTypeReferenceNode(genericIdentifiers.using),
    factory.createLiteralTypeNode(
      factory.createStringLiteral(identifiers.utils.all.text),
    ),
    factory.createTypeReferenceNode(genericIdentifiers.schema),

    factory.createConditionalTypeNode(
      factory.createTypeReferenceNode(genericIdentifiers.key),
      factory.createIndexedAccessTypeNode(
        factory.createTypeReferenceNode(genericIdentifiers.using),
        factory.createKeywordTypeNode(SyntaxKind.NumberKeyword),
      ),
      factory.createTypeReferenceNode(genericIdentifiers.schema),

      factory.createConditionalTypeNode(
        factory.createTypeReferenceNode(genericIdentifiers.schema),
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
