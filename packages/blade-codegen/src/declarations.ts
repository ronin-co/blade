import { SyntaxKind, factory } from 'typescript';

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
 * import type { ReducedFunction, ResultRecord } from "blade-syntax/queries";
 * ```
 */
export const importSyntaxUtilTypesType = createImportDeclaration({
  identifiers: [
    { name: identifiers.syntax.reducedFunction },
    { name: identifiers.syntax.resultRecord },
  ],
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
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
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
 * after: ReducedFunction & (<T = S>(value: CombinedInstructions['after']) => T);
 * ```
 */
export const afterSyntaxQueryType = factory.createPropertySignature(
  undefined,
  'after',
  undefined,
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.syntax.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(
              identifiers.compiler.combinedInstructions,
              undefined,
            ),
            factory.createLiteralTypeNode(factory.createStringLiteral('after')),
          ),
          undefined,
        ),
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
    ),
  ]),
);

/**
 * ```ts
 * before: ReducedFunction & (<T = S>(value: CombinedInstructions['before']) => T);
 * ```
 */
export const beforeSyntaxQueryType = factory.createPropertySignature(
  undefined,
  'before',
  undefined,
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.syntax.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(
              identifiers.compiler.combinedInstructions,
              undefined,
            ),
            factory.createLiteralTypeNode(factory.createStringLiteral('before')),
          ),
          undefined,
        ),
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
    ),
  ]),
);

/**
 * ```ts
 * including: ReducedFunction & (<T = S>(value: CombinedInstructions['including']) => T);
 * ```
 */
export const includingSyntaxQueryType = factory.createPropertySignature(
  undefined,
  'including',
  undefined,
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.syntax.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(
              identifiers.compiler.combinedInstructions,
              undefined,
            ),
            factory.createLiteralTypeNode(factory.createStringLiteral('including')),
          ),
          undefined,
        ),
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
    ),
  ]),
);
