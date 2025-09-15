import { SyntaxKind, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { createImportDeclaration } from '@/src/generators/import';

/**
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
 * import type { ReducedFunction, ResultRecord } from "blade/types";
 * ```
 */
export const importBladeUtilsType = createImportDeclaration({
  identifiers: [
    { name: identifiers.blade.reducedFunction },
    { name: identifiers.blade.resultRecord },
  ],
  module: identifiers.blade.module.types,
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
 * @todo(@nurodev): Add documentation
 */
export const afterQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.afterQuery,
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
 * @todo(@nurodev): Add documentation
 */
export const afterQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.afterQueryPromise,
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
 * @todo(@nurodev): Add documentation
 */
export const beforeQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.beforeQuery,
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
 * @todo(@nurodev): Add documentation
 */
export const beforeQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.beforeQueryPromise,
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
 * @todo(@nurodev): Add documentation
 */
export const includingQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.includingQuery,
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
 * @todo(@nurodev): Add documentation
 */
export const includingQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.includingQueryPromise,
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
 * @todo(@nurodev): Add documentation
 */
export const limitedToQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.limitedToQuery,
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
 * @todo(@nurodev): Add documentation
 */
export const limitedToQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.limitedToQueryPromise,
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
 * @todo(@nurodev): Add documentation
 */
export const selectingQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.selectingQuery,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.options),
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
            factory.createTypeReferenceNode(typeArgumentIdentifiers.options),
          ]),
        ),
        sharedQueryOptionsParameter,
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
    ),
  ]),
);

/**
 * @todo(@nurodev): Add documentation
 */
export const selectingQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.selectingQueryPromise,
  [
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using),
    factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.options),
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
            factory.createTypeReferenceNode(typeArgumentIdentifiers.options),
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
 * @todo(@nurodev): Add documentation
 */
export const orderedByQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.orderedByQuery,
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
 * @todo(@nurodev): Add documentation
 */
export const orderedByQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.orderedByQueryPromise,
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
 * @todo(@nurodev): Add documentation
 */
export const rootCallerQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.rootCaller,
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
 * @todo(@nurodev): Add documentation
 */
export const rootCallerQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.rootCallerPromise,
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
 * @todo(@nurodev): Add documentation
 */
export const withQueryType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.withQuery,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createTypeReferenceNode(identifiers.blade.reducedFunction),
    factory.createTypeLiteralNode([
      /**
       * ```ts
       * <T = User | null>(options: CombinedInstructions["with"]): T
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
            factory.createIndexedAccessTypeNode(
              factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
              factory.createLiteralTypeNode(factory.createStringLiteral('with')),
            ),
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
                  factory.createTypeReferenceNode(identifiers.blade.resultRecord),
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
                              identifiers.blade.resultRecord,
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
 * @todo(@nurodev): Add documentation
 */
export const withQueryPromiseType = factory.createTypeAliasDeclaration(
  undefined,
  identifiers.syntax.withQueryPromise,
  [factory.createTypeParameterDeclaration(undefined, typeArgumentIdentifiers.using)],
  factory.createIntersectionTypeNode([
    factory.createTypeReferenceNode(identifiers.blade.reducedFunction),
    factory.createTypeLiteralNode([
      /**
       * ```ts
       * <T = User | null>(options: CombinedInstructions["with"]): T
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
            factory.createIndexedAccessTypeNode(
              factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
              factory.createLiteralTypeNode(factory.createStringLiteral('with')),
            ),
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
                  factory.createTypeReferenceNode(identifiers.blade.resultRecord),
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
                              identifiers.blade.resultRecord,
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
