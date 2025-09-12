import { SyntaxKind, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { convertToPascalCase } from '@/src/utils/slug';

import type { CombinedInstructions } from 'blade-compiler';
import type { TypeElement, TypeNode } from 'typescript';

import type { Model } from '@/src/types/model';

interface BaseGeneratorOptions {
  modelNode: TypeNode;
  promise?: boolean;
}

/**
 * Generates the call signature for the root query.
 *
 * @example
 * ```ts
 * <T = User | null>(options?: Partial<CombinedInstructions>): T;
 * ```
 *
 * @param options - The options for generating the call signature.
 *
 * @returns A call signature node.
 */
export const generateRootQueryCallSignature = (options: BaseGeneratorOptions) =>
  factory.createCallSignature(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.default,
        undefined,
        options.modelNode,
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
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'options',
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(identifiers.primitive.record, [
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
          factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
        ]),
      ),
    ],
    options?.promise
      ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
        ])
      : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
  );

/**
 * Generate a base or default syntax property that falls back to `CombinedInstructions`
 *
 * @example
 * ```ts
 * after: ReducedFunction & (<T = User | null>(value: CombinedInstructions["after"]) => T);
 * ```
 *
 * @param options - The options for generating the syntax property.
 *
 * @returns A property signature node.
 */
export const generateDefaultSyntaxProperty = (
  options: BaseGeneratorOptions & {
    name: keyof CombinedInstructions;
  },
) =>
  factory.createPropertySignature(
    undefined,
    options.name,
    undefined,
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
            options.modelNode,
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
              factory.createLiteralTypeNode(factory.createStringLiteral(options.name)),
            ),
          ),
        ],
        options?.promise
          ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ])
          : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ),
    ]),
  );

/**
 * Generate a strictly typed `orderedBy` syntax property.
 *
 * @example
 * ```ts
 * orderedBy: ReducedFunction & (<T = User | null>(options: {
 *  ascending?: Array<Expression | UserFieldSlug>;
 *  descending?: Array<Expression | UserFieldSlug>;
 * }) => T) & {
 *  ascending: <T = User | null>(fields: Array<Expression | UserFieldSlug>) => T;
 *  descending: <T = User | null>(fields: Array<Expression | UserFieldSlug>) => T;
 * };
 * ```
 *
 * @param options - The options for generating the syntax property.
 *
 * @returns A property signature node.
 */
export const generateOrderedBySyntaxProperty = (
  options: BaseGeneratorOptions & {
    model: Model;
  },
) => {
  const typedFields = factory.createTypeReferenceNode(identifiers.primitive.array, [
    factory.createUnionTypeNode([
      factory.createTypeReferenceNode(identifiers.compiler.expression),
      factory.createTypeReferenceNode(
        factory.createIdentifier(`${convertToPascalCase(options.model.slug)}FieldSlug`),
      ),
    ]),
  ]);

  return factory.createPropertySignature(
    undefined,
    'orderedBy',
    undefined,
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
            options.modelNode,
          ),
        ],
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            'options',
            undefined,
            factory.createTypeLiteralNode(
              ['ascending', 'descending'].map((name) =>
                factory.createPropertySignature(
                  undefined,
                  name,
                  factory.createToken(SyntaxKind.QuestionToken),
                  typedFields,
                ),
              ),
            ),
          ),
        ],
        options?.promise
          ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ])
          : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
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
                  options.modelNode,
                ),
              ],
              [
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  'fields',
                  undefined,
                  typedFields,
                ),
              ],
              options?.promise
                ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
                    factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
                  ])
                : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ),
          ),
        ),
      ),
    ]),
  );
};

/**
 * Generates the syntax property for `selecting` fields.
 *
 * @example
 * ```ts
 * selecting: ReducedFunction & (<T = User | null>(options: Array<UserFieldSlug>) => T);
 * ```
 *
 * @param options - The options for generating the syntax property.
 *
 * @returns A property signature node.
 */
export const generateSelectingSyntaxProperty = (
  options: BaseGeneratorOptions & {
    model: Model;
  },
) =>
  factory.createPropertySignature(
    undefined,
    'selecting',
    undefined,
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
            options.modelNode,
          ),
        ],
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            'options',
            undefined,
            factory.createTypeReferenceNode(identifiers.primitive.array, [
              factory.createTypeReferenceNode(
                factory.createIdentifier(
                  `${convertToPascalCase(options.model.slug)}FieldSlug`,
                ),
              ),
            ]),
          ),
        ],
        options?.promise
          ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ])
          : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ),
    ]),
  );

/**
 * Generates the syntax property for `using` fields.
 *
 * @example
 * ```ts
 * using: ReducedFunction & {
 *  <U extends Array<"author"> | "all">(fields: U): Post<U> | null;
 *  <T = Post | null>(fields: Array<"author"> | "all"): T;
 * };
 * ```
 *
 * @param options - The options for generating the syntax property.
 * @returns A property signature node.
 */
export const generateUsingSyntaxProperty = (
  options: BaseGeneratorOptions & {
    model: Model;
    slug: string;
    isPlural?: boolean;
  },
) => {
  const hasLinkFields = Object.values(options.model.fields).some(
    (field) => field.type === 'link',
  );
  if (!hasLinkFields)
    return generateDefaultSyntaxProperty({
      name: 'using',
      modelNode: options.modelNode,
    });

  /**
   * ```ts
   * Array<'...'> | 'all'
   * ```
   */
  const arrayFieldsType = factory.createUnionTypeNode([
    factory.createTypeReferenceNode(identifiers.primitive.array, [
      factory.createUnionTypeNode(
        Object.entries(options.model.fields)
          .filter(([, field]) => field.type === 'link')
          .map(([name]) =>
            factory.createLiteralTypeNode(factory.createStringLiteral(name)),
          ),
      ),
    ]),
    factory.createLiteralTypeNode(factory.createStringLiteral('all')),
  ]);

  /**
   * ```ts
   * User<U>
   * ```
   */
  const baseModelWithFields = factory.createTypeReferenceNode(
    factory.createIdentifier(options.slug),
    [factory.createTypeReferenceNode(typeArgumentIdentifiers.using)],
  );
  const modelNodeWithFields = options?.promise
    ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
        baseModelWithFields,
      ])
    : baseModelWithFields;

  return factory.createPropertySignature(
    undefined,
    'using',
    undefined,
    factory.createIntersectionTypeNode([
      factory.createExpressionWithTypeArguments(
        identifiers.blade.reducedFunction,
        undefined,
      ),
      factory.createTypeLiteralNode([
        factory.createCallSignature(
          [
            factory.createTypeParameterDeclaration(
              undefined,
              typeArgumentIdentifiers.using,
              arrayFieldsType,
            ),
          ],
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              'fields',
              undefined,
              factory.createTypeReferenceNode(typeArgumentIdentifiers.using),
            ),
          ],
          options.isPlural
            ? modelNodeWithFields
            : factory.createUnionTypeNode([
                modelNodeWithFields,
                factory.createLiteralTypeNode(factory.createNull()),
              ]),
        ),

        factory.createCallSignature(
          [
            factory.createTypeParameterDeclaration(
              undefined,
              typeArgumentIdentifiers.default,
              undefined,
              options.modelNode,
            ),
          ],
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              'fields',
              undefined,
              arrayFieldsType,
            ),
          ],
          options?.promise
            ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
                factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
              ])
            : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
        ),
      ]),
    ]),
  );
};

/**
 * Generates the syntax property for `with` fields.
 *
 * @example
 * ```ts
 * with: ReducedFunction & {
 *  <T = User | null>(options: CombinedInstructions["with"]): T;
 *  id: <T = User | null>(value: ResultRecord["id"]) => T;
 *  ronin: ReducedFunction & {
 *    createdAt: <T = User | null>(value: ResultRecord["ronin"]["createdAt"]) => T;
 *    createdBy: <T = User | null>(value: ResultRecord["ronin"]["createdBy"]) => T;
 *    updatedAt: <T = User | null>(value: ResultRecord["ronin"]["updatedAt"]) => T;
 *    updatedBy: <T = User | null>(value: ResultRecord["ronin"]["updatedBy"]) => T;
 *  };
 *  name: <T = User | null>(name: Post["name"]) => T;
 *  // [...]
 * };
 * ```
 *
 * @param options - The options for generating the syntax property.
 *
 * @returns A property signature node.
 */
export const generateWithSyntaxProperty = (
  options: BaseGeneratorOptions & {
    model: Model;
  },
) => {
  /**
   * ```ts
   * <T = User | null>(options: CombinedInstructions["with"]): T
   * ```
   */
  const rootCallSignature = factory.createCallSignature(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.default,
        undefined,
        options.modelNode,
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
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'options',
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(identifiers.primitive.record, [
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
          factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
        ]),
      ),
    ],
    options?.promise
      ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
        ])
      : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
  );

  const members = new Array<TypeElement>(rootCallSignature);

  // Add all top-level RONIN fields, such as `id`.
  const topLevelFields = DEFAULT_FIELD_SLUGS.filter((slug) => !slug.startsWith('ronin.'));
  for (const slug of topLevelFields) {
    members.push(
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
              options.modelNode,
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
          ],
          options?.promise
            ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
                factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
              ])
            : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
        ),
      ),
    );
  }

  // Add all nested RONIN meta fields, such as `ronin.createdAt`, `ronin.createdBy`, etc.
  const metaFields = DEFAULT_FIELD_SLUGS.filter((slug) => slug.startsWith('ronin.'));
  const metaFieldsPropertySignatures = metaFields.map((slug) => {
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
            options.modelNode,
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
                factory.createTypeReferenceNode(identifiers.blade.resultRecord),
                factory.createLiteralTypeNode(factory.createStringLiteral('ronin')),
              ),
              factory.createLiteralTypeNode(factory.createStringLiteral(normalizedSlug)),
            ),
          ),
        ],
        options?.promise
          ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ])
          : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ),
    );
  });
  members.push(
    factory.createPropertySignature(
      undefined,
      'ronin',
      undefined,
      factory.createIntersectionTypeNode([
        factory.createExpressionWithTypeArguments(
          identifiers.blade.reducedFunction,
          undefined,
        ),
        factory.createTypeLiteralNode(metaFieldsPropertySignatures),
      ]),
    ),
  );

  // Create property signatures for all model fields.
  for (const slug of Object.keys(options.model.fields)) {
    if (DEFAULT_FIELD_SLUGS.some((field) => field.includes(slug))) continue;

    members.push(
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
              options.modelNode,
            ),
          ],
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              slug,
              undefined,
              factory.createIndexedAccessTypeNode(
                factory.createTypeReferenceNode(convertToPascalCase(options.model.slug)),
                factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
              ),
            ),
          ],
          options?.promise
            ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
                factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
              ])
            : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
        ),
      ),
    );
  }

  return factory.createPropertySignature(
    undefined,
    'with',
    undefined,
    factory.createIntersectionTypeNode([
      factory.createExpressionWithTypeArguments(
        identifiers.blade.reducedFunction,
        undefined,
      ),
      // TODO(@nurodev): Add support for with conditions like `startingWith`, `notStartingWith`, etc.
      factory.createTypeLiteralNode(members),
    ]),
  );
};
