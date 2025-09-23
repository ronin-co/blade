import { SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { createImportDeclaration } from '@/src/generators/import';

/**
 * @example
 * ```ts
 * import type { CombinedInstructions, Expression } from "blade-compiler";
 * ```
 */
export const importBladeCompilerQueryTypesType = createImportDeclaration({
  identifiers: [
    { name: identifiers.compiler.combinedInstructions },
    { name: identifiers.compiler.expression },
  ],
  module: identifiers.compiler.module.root,
  type: true,
});

/**
 * @example
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
 * @example
 * ```ts
 * import type { ReducedFunction } from "blade/types";
 * ```
 */
export const importBladeUtilsType = createImportDeclaration({
  identifiers: [{ name: identifiers.blade.reducedFunction }],
  module: identifiers.blade.module.types,
  type: true,
});

/**
 * @example
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
     * @example
     * ```ts
     * S
     * ```
     */
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.schema),

    /**
     * @example
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
     * @example
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
 * @example
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
 * @example
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
 * @example
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
 * @example
 * ```ts
 * options?: Record<string, unknown>;
 * ```
 */
export const sharedQueryOptionsParameter = factory.createParameterDeclaration(
  undefined,
  undefined,
  'options',
  factory.createToken(SyntaxKind.QuestionToken),
  factory.createTypeReferenceNode(identifiers.primitive.record, [
    factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
  ]),
);

/**
 * @example
 * ```ts
 * type AfterQuery<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["after"], options?: Record<string, unknown>) => T);
 * ```
 */
export const afterQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.afterQuery,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
            factory.createLiteralTypeNode(factory.createStringLiteral('after')),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type AfterQueryPromise<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["after"], options?: Record<string, unknown>) => Promise<T>);
 * ```
 */
export const afterQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.afterQueryPromise,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
            factory.createLiteralTypeNode(factory.createStringLiteral('after')),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(identifiers.primitive.promise, [
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ]),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type BeforeQuery<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["before"], options?: Record<string, unknown>) => T);
 * ```
 */
export const beforeQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.beforeQuery,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
            factory.createLiteralTypeNode(factory.createStringLiteral('before')),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type BeforeQueryPromise<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["before"], options?: Record<string, unknown>) => Promise<T>);
 * ```
 */
export const beforeQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.beforeQueryPromise,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
            factory.createLiteralTypeNode(factory.createStringLiteral('before')),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(identifiers.primitive.promise, [
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ]),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type IncludingQuery<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["including"], options?: Record<string, unknown>) => T);
 * ```
 */
export const includingQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.includingQuery,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
            factory.createLiteralTypeNode(factory.createStringLiteral('including')),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type IncludingQueryPromise<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["including"], options?: Record<string, unknown>) => Promise<T>);
 * ```
 */
export const includingQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.includingQueryPromise,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
            factory.createLiteralTypeNode(factory.createStringLiteral('including')),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(identifiers.primitive.promise, [
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ]),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type LimitedToQuery<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["limitedTo"], options?: Record<string, unknown>) => T);
 * ```
 */
export const limitedToQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.limitedToQuery,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
            factory.createLiteralTypeNode(factory.createStringLiteral('limitedTo')),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type LimitedToQueryPromise<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["limitedTo"], options?: Record<string, unknown>) => Promise<T>);
 * ```
 */
export const limitedToQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.limitedToQueryPromise,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'value',
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
            factory.createLiteralTypeNode(factory.createStringLiteral('limitedTo')),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(identifiers.primitive.promise, [
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ]),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type OrderedByQuery<U, F extends string> = ReducedFunction & (<T = U>(instructions: {
 *  ascending?: Array<Expression | F>;
 *  descending?: Array<Expression | F>;
 * }, options?: Record<string, unknown>) => T) & {
 *  ascending: <T = U>(fields: Array<Expression | F>, options?: Record<string, unknown>) => T;
 *  descending: <T = U>(fields: Array<Expression | F>, options?: Record<string, unknown>) => T;
 * };
 * ```
 */
export const orderedByQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.orderedByQuery,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(
      undefined,
      typeArgumentIdentifiers.fields,
      factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    ),
  ],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'instructions',
          undefined,
          factory.createTypeLiteralNode(
            ['ascending', 'descending'].map((name) =>
              factory.createPropertySignature(
                undefined,
                name,
                factory.createToken(SyntaxKind.QuestionToken),
                factory.createTypeReferenceNode(identifiers.primitive.array, [
                  factory.createUnionTypeNode([
                    factory.createTypeReferenceNode(identifiers.compiler.expression),
                    factory.createTypeReferenceNode(typeArgumentIdentifiers.fields),
                  ]),
                ]),
              ),
            ),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ),
    factory.createTypeLiteralNode(
      ['ascending', 'descending'].map((name) =>
        factory.createPropertySignature(
          undefined,
          name,
          undefined,
          factory.createFunctionTypeNode(
            [
              factory.createTypeParameterDeclaration(
                undefined,
                typeArgumentIdentifiers.default,
                undefined,
                factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
              ),
            ],
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                'fields',
                undefined,
                factory.createTypeReferenceNode(identifiers.primitive.array, [
                  factory.createUnionTypeNode([
                    factory.createTypeReferenceNode(identifiers.compiler.expression),
                    factory.createTypeReferenceNode(typeArgumentIdentifiers.fields),
                  ]),
                ]),
              ),
              sharedQueryOptionsParameter,
            ],
            factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
          ),
        ),
      ),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type OrderedByQueryPromise<U, F extends string> = ReducedFunction & (<T = U>(instructions: {
 *  ascending?: Array<Expression | F>;
 *  descending?: Array<Expression | F>;
 * }, options?: Record<string, unknown>) => Promise<T>) & {
 *  ascending: <T = U>(fields: Array<Expression | F>, options?: Record<string, unknown>) => Promise<T>;
 *  descending: <T = U>(fields: Array<Expression | F>, options?: Record<string, unknown>) => Promise<T>;
 * };
 * ```
 */
export const orderedByQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.orderedByQueryPromise,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(
      undefined,
      typeArgumentIdentifiers.fields,
      factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    ),
  ],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'instructions',
          undefined,
          factory.createTypeLiteralNode(
            ['ascending', 'descending'].map((name) =>
              factory.createPropertySignature(
                undefined,
                name,
                factory.createToken(SyntaxKind.QuestionToken),
                factory.createTypeReferenceNode(identifiers.primitive.array, [
                  factory.createUnionTypeNode([
                    factory.createTypeReferenceNode(identifiers.compiler.expression),
                    factory.createTypeReferenceNode(typeArgumentIdentifiers.fields),
                  ]),
                ]),
              ),
            ),
          ),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(identifiers.primitive.promise, [
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ]),
    ),
    factory.createTypeLiteralNode(
      ['ascending', 'descending'].map((name) =>
        factory.createPropertySignature(
          undefined,
          name,
          undefined,
          factory.createFunctionTypeNode(
            [
              factory.createTypeParameterDeclaration(
                undefined,
                typeArgumentIdentifiers.default,
                undefined,
                factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
              ),
            ],
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                'fields',
                undefined,
                factory.createTypeReferenceNode(identifiers.primitive.array, [
                  factory.createUnionTypeNode([
                    factory.createTypeReferenceNode(identifiers.compiler.expression),
                    factory.createTypeReferenceNode(typeArgumentIdentifiers.fields),
                  ]),
                ]),
              ),
              sharedQueryOptionsParameter,
            ],
            factory.createTypeReferenceNode(identifiers.primitive.promise, [
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ]),
          ),
        ),
      ),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type ResultRecord = {
 *  id: string;
 *  ronin: { ... };
 * }
 * ```
 */
export const resultRecordType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.resultRecord,
  undefined,
  factory.createTypeLiteralNode([
    addSyntheticLeadingComment(
      factory.createPropertySignature(
        undefined,
        'id',
        undefined,
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
      ),
      SyntaxKind.MultiLineCommentTrivia,
      ' The unique identifier of the record. ',
      true,
    ),

    factory.createPropertySignature(
      undefined,
      'ronin',
      undefined,
      factory.createTypeLiteralNode([
        addSyntheticLeadingComment(
          factory.createPropertySignature(
            undefined,
            'createdAt',
            undefined,
            factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
          ),
          SyntaxKind.MultiLineCommentTrivia,
          ' The timestamp of when the record was created. ',
          true,
        ),
        addSyntheticLeadingComment(
          factory.createPropertySignature(
            undefined,
            'createdBy',
            undefined,
            factory.createUnionTypeNode([
              factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
              factory.createLiteralTypeNode(factory.createNull()),
            ]),
          ),
          SyntaxKind.MultiLineCommentTrivia,
          ' The ID of the user who created the record. ',
          true,
        ),
        addSyntheticLeadingComment(
          factory.createPropertySignature(
            undefined,
            'updatedAt',
            undefined,
            factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
          ),
          SyntaxKind.MultiLineCommentTrivia,
          ' The timestamp of the last time the record was updated. ',
          true,
        ),
        addSyntheticLeadingComment(
          factory.createPropertySignature(
            undefined,
            'updatedBy',
            undefined,
            factory.createUnionTypeNode([
              factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
              factory.createLiteralTypeNode(factory.createNull()),
            ]),
          ),
          SyntaxKind.MultiLineCommentTrivia,
          ' The ID of the user who last updated the record. ',
          true,
        ),
      ]),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type RootQueryCaller<U> = <T = U>(instructions?: Partial<CombinedInstructions>, options?: Record<string, unknown>) => T;
 * ```
 */
export const rootCallerQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.rootQueryCaller,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createFunctionTypeNode(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.default,
        undefined,
        factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'instructions',
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(identifiers.primitive.partial, [
          factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
        ]),
      ),
      sharedQueryOptionsParameter,
    ],
    factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
  ),
);

/**
 * @example
 * ```ts
 * type RootQueryCallerPromise<U> = <T = U>(instructions?: Partial<CombinedInstructions>, options?: Record<string, unknown>) => Promise<T>;
 * ```
 */
export const rootCallerQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.rootQueryCallerPromise,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createFunctionTypeNode(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.default,
        undefined,
        factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'instructions',
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(identifiers.primitive.partial, [
          factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
        ]),
      ),
      sharedQueryOptionsParameter,
    ],
    factory.createTypeReferenceNode(identifiers.primitive.promise, [
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ]),
  ),
);

/**
 * @example
 * ```ts
 * type SelectingQuery<U, F> = ReducedFunction & (<T = U>(instructions: Array<F>, options?: Record<string, unknown>) => T);
 * ```
 */
export const selectingQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.selectingQuery,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.fields),
  ],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'instructions',
          undefined,
          factory.createTypeReferenceNode(identifiers.primitive.array, [
            factory.createTypeReferenceNode(typeArgumentIdentifiers.fields),
          ]),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type SelectingQueryPromise<U, F> = ReducedFunction & (<T = U>(instructions: Array<F>, options?: Record<string, unknown>) => Promise<T>);
 * ```
 */
export const selectingQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.selectingQueryPromise,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.fields),
  ],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'instructions',
          undefined,
          factory.createTypeReferenceNode(identifiers.primitive.array, [
            factory.createTypeReferenceNode(typeArgumentIdentifiers.fields),
          ]),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(identifiers.primitive.promise, [
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ]),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type ToQuery<U, S> = ReducedFunction & (<T = U>(instructions: Partial<S>, options?: Record<string, unknown>) => T);
 * ```
 */
export const toQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.toQuery,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.schema),
  ],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'instructions',
          undefined,
          factory.createTypeReferenceNode(identifiers.primitive.partial, [
            factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),
          ]),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ),
  ]),
);

/**
 * @example
 * ```ts
 * type ToQueryPromise<U, S> = ReducedFunction & (<T = U>(instructions: Partial<S>, options?: Record<string, unknown>) => Promise<T>);
 * ```
 */
export const toQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.toQueryPromise,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.schema),
  ],
  factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createFunctionTypeNode(
      [
        factory.createTypeParameterDeclaration(
          undefined,
          typeArgumentIdentifiers.default,
          undefined,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          'instructions',
          undefined,
          factory.createTypeReferenceNode(identifiers.primitive.partial, [
            factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),
          ]),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(identifiers.primitive.promise, [
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ]),
    ),
  ]),
);

/**
 * @todo(@nurodev): Replace `Partial<S> | CombinedInstructions["with"]` with utility to map advanced assertions
 *
 * @example
 * ```ts
 * type WithQuery<U, S> = ReducedFunction & {
 *  <T = U>(instructions: Partial<S> | CombinedInstructions["with"], options?: Record<string, unknown>): T;
 *  id: <T = U>(value: ResultRecord["id"], options?: Record<string, unknown>) => T;
 *  ronin: ReducedFunction & {
 *    createdAt: <T = U>(value: ResultRecord["ronin"]["createdAt"], options?: Record<string, unknown>) => T;
 *    createdBy: <T = U>(value: ResultRecord["ronin"]["createdBy"], options?: Record<string, unknown>) => T;
 *    updatedAt: <T = U>(value: ResultRecord["ronin"]["updatedAt"], options?: Record<string, unknown>) => T;
 *    updatedBy: <T = U>(value: ResultRecord["ronin"]["updatedBy"], options?: Record<string, unknown>) => T;
 *  };
 * };
 * ```
 */
export const withQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.withQuery,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.schema),
  ],
  factory.createIntersectionTypeNode([
    factory.createTypeReferenceNode(identifiers.blade.reducedFunction),
    factory.createTypeLiteralNode([
      /**
       * ```ts
       * <T = U>(instructions: Partial<S> | CombinedInstructions["with"], options?: Record<string, unknown>): T
       * ```
       */
      factory.createCallSignature(
        [
          factory.createTypeParameterDeclaration(
            undefined,
            typeArgumentIdentifiers.default,
            undefined,
            factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
          ),
        ],
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            'instructions',
            undefined,
            factory.createUnionTypeNode([
              factory.createTypeReferenceNode(identifiers.primitive.partial, [
                factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),
              ]),
              factory.createIndexedAccessTypeNode(
                factory.createTypeReferenceNode(
                  identifiers.compiler.combinedInstructions,
                ),
                factory.createLiteralTypeNode(factory.createStringLiteral('with')),
              ),
            ]),
          ),
          sharedQueryOptionsParameter,
        ],
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ),

      ...DEFAULT_FIELD_SLUGS.filter((slug) => !slug.startsWith('ronin.')).map((slug) =>
        factory.createPropertySignature(
          undefined,
          slug,
          undefined,
          factory.createFunctionTypeNode(
            [
              factory.createTypeParameterDeclaration(
                undefined,
                typeArgumentIdentifiers.default,
                undefined,
                factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
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
                    identifiers.namespace.utils.resultRecord,
                  ),
                  factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
                ),
              ),
              sharedQueryOptionsParameter,
            ],
            factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
          ),
        ),
      ),

      factory.createPropertySignature(
        undefined,
        'ronin',
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeLiteralNode(
            DEFAULT_FIELD_SLUGS.filter((slug) => slug.startsWith('ronin.')).map(
              (slug) => {
                const normalizedSlug = slug.replaceAll('ronin.', '');

                return factory.createPropertySignature(
                  undefined,
                  normalizedSlug,
                  undefined,
                  factory.createFunctionTypeNode(
                    [
                      factory.createTypeParameterDeclaration(
                        undefined,
                        typeArgumentIdentifiers.default,
                        undefined,
                        factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
                      ),
                    ],
                    [
                      factory.createParameterDeclaration(
                        undefined,
                        undefined,
                        'value',
                        undefined,
                        factory.createIndexedAccessTypeNode(
                          factory.createIndexedAccessTypeNode(
                            factory.createTypeReferenceNode(
                              identifiers.namespace.utils.resultRecord,
                            ),
                            factory.createLiteralTypeNode(
                              factory.createStringLiteral('ronin'),
                            ),
                          ),
                          factory.createLiteralTypeNode(
                            factory.createStringLiteral(normalizedSlug),
                          ),
                        ),
                      ),
                      sharedQueryOptionsParameter,
                    ],
                    factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
                  ),
                );
              },
            ),
          ),
        ]),
      ),
    ]),
  ]),
);

/**
 * @todo(@nurodev): Replace `Partial<S> | CombinedInstructions["with"]` with utility to map advanced assertions
 *
 * @example
 * ```ts
 * type WithQueryPromise<U, S> = ReducedFunction & {
 *  <T = U>(instructions: Partial<S> | CombinedInstructions["with"], options?: Record<string, unknown>): Promise<T>;
 *  id: <T = U>(value: ResultRecord["id"], options?: Record<string, unknown>) => Promise<T>;
 *  ronin: ReducedFunction & {
 *    createdAt: <T = U>(value: ResultRecord["ronin"]["createdAt"], options?: Record<string, unknown>) => Promise<T>;
 *    createdBy: <T = U>(value: ResultRecord["ronin"]["createdBy"], options?: Record<string, unknown>) => Promise<T>;
 *    updatedAt: <T = U>(value: ResultRecord["ronin"]["updatedAt"], options?: Record<string, unknown>) => Promise<T>;
 *    updatedBy: <T = U>(value: ResultRecord["ronin"]["updatedBy"], options?: Record<string, unknown>) => Promise<T>;
 *  };
 * };
 * ```
 */
export const withQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.namespace.utils.withQueryPromise,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.schema),
  ],
  factory.createIntersectionTypeNode([
    factory.createTypeReferenceNode(identifiers.blade.reducedFunction),
    factory.createTypeLiteralNode([
      /**
       * ```ts
       * <T = U>(instructions: Partial<S> | CombinedInstructions["with"], options?: Record<string, unknown>): Promise<T>
       * ```
       */
      factory.createCallSignature(
        [
          factory.createTypeParameterDeclaration(
            undefined,
            typeArgumentIdentifiers.default,
            undefined,
            factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
          ),
        ],
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            'instructions',
            undefined,
            factory.createUnionTypeNode([
              factory.createTypeReferenceNode(identifiers.primitive.partial, [
                factory.createTypeReferenceNode(typeArgumentIdentifiers.schema),
              ]),
              factory.createIndexedAccessTypeNode(
                factory.createTypeReferenceNode(
                  identifiers.compiler.combinedInstructions,
                ),
                factory.createLiteralTypeNode(factory.createStringLiteral('with')),
              ),
            ]),
          ),
          sharedQueryOptionsParameter,
        ],
        factory.createTypeReferenceNode(identifiers.primitive.promise, [
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
        ]),
      ),

      ...DEFAULT_FIELD_SLUGS.filter((slug) => !slug.startsWith('ronin.')).map((slug) =>
        factory.createPropertySignature(
          undefined,
          slug,
          undefined,
          factory.createFunctionTypeNode(
            [
              factory.createTypeParameterDeclaration(
                undefined,
                typeArgumentIdentifiers.default,
                undefined,
                factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
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
                    identifiers.namespace.utils.resultRecord,
                  ),
                  factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
                ),
              ),
              sharedQueryOptionsParameter,
            ],
            factory.createTypeReferenceNode(identifiers.primitive.promise, [
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ]),
          ),
        ),
      ),

      factory.createPropertySignature(
        undefined,
        'ronin',
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeLiteralNode(
            DEFAULT_FIELD_SLUGS.filter((slug) => slug.startsWith('ronin.')).map(
              (slug) => {
                const normalizedSlug = slug.replaceAll('ronin.', '');

                return factory.createPropertySignature(
                  undefined,
                  normalizedSlug,
                  undefined,
                  factory.createFunctionTypeNode(
                    [
                      factory.createTypeParameterDeclaration(
                        undefined,
                        typeArgumentIdentifiers.default,
                        undefined,
                        factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
                      ),
                    ],
                    [
                      factory.createParameterDeclaration(
                        undefined,
                        undefined,
                        'value',
                        undefined,
                        factory.createIndexedAccessTypeNode(
                          factory.createIndexedAccessTypeNode(
                            factory.createTypeReferenceNode(
                              identifiers.namespace.utils.resultRecord,
                            ),
                            factory.createLiteralTypeNode(
                              factory.createStringLiteral('ronin'),
                            ),
                          ),
                          factory.createLiteralTypeNode(
                            factory.createStringLiteral(normalizedSlug),
                          ),
                        ),
                      ),
                      sharedQueryOptionsParameter,
                    ],
                    factory.createTypeReferenceNode(identifiers.primitive.promise, [
                      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
                    ]),
                  ),
                );
              },
            ),
          ),
        ]),
      ),
    ]),
  ]),
);
