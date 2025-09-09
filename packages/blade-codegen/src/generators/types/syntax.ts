import { SyntaxKind, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { convertToPascalCase } from '@/src/utils/slug';

import type { CombinedInstructions } from 'blade-compiler';
import type { TypeElement, TypeNode } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * TODO(@nurodev): Add documentation
 */
export const generateRootQueryCallSignature = (modelNode: TypeNode) =>
  factory.createCallSignature(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.default,
        undefined,
        modelNode,
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'options',
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(identifiers.primitive.partial, [
          factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
        ]),
      ),
    ],
    factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
  );

/**
 * TODO(@nurodev): Add documentation
 */
export const generateDefaultSyntaxProperty = (
  propertyName: keyof CombinedInstructions,
  modelNode: TypeNode,
) =>
  factory.createPropertySignature(
    undefined,
    propertyName,
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
            modelNode,
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
              factory.createLiteralTypeNode(factory.createStringLiteral(propertyName)),
            ),
          ),
        ],
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ),
    ]),
  );

/**
 * TODO(@nurodev): Add documentation
 */
export const generateOrderedBySyntaxProperty = (model: Model, schemaNode: TypeNode) => {
  const typedFields = factory.createTypeReferenceNode(identifiers.primitive.array, [
    factory.createUnionTypeNode([
      factory.createTypeReferenceNode(identifiers.compiler.expression),
      factory.createTypeReferenceNode(
        factory.createIdentifier(`${convertToPascalCase(model.slug)}FieldSlug`),
      ),
    ]),
  ]);

  return factory.createPropertySignature(
    undefined,
    'orderedBy',
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
            schemaNode,
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
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
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
                  schemaNode,
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
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
            ),
          ),
        ),
      ),
    ]),
  );
};

/**
 * TODO(@nurodev): Add documentation
 */
export const generateSelectingSyntaxProperty = (model: Model, modelNode: TypeNode) =>
  factory.createPropertySignature(
    undefined,
    'selecting',
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
            modelNode,
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
                factory.createIdentifier(`${convertToPascalCase(model.slug)}FieldSlug`),
              ),
            ]),
          ),
        ],
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
      ),
    ]),
  );

/**
 * TODO(@nurodev): Add documentation
 */
export const generateUsingSyntaxProperty = (
  model: Model,
  modelNode: TypeNode,
  slug: string,
  isPlural = false,
) => {
  const hasLinkFields = Object.values(model.fields).some(
    (field) => field.type === 'link',
  );
  if (!hasLinkFields) return generateDefaultSyntaxProperty('using', modelNode);

  /**
   * ```ts
   * Array<'...'> | 'all'
   * ```
   */
  const arrayFieldsType = factory.createUnionTypeNode([
    factory.createTypeReferenceNode(identifiers.primitive.array, [
      factory.createUnionTypeNode(
        Object.entries(model.fields)
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
  const modelNodeWithFields = factory.createTypeReferenceNode(
    factory.createIdentifier(slug),
    [factory.createTypeReferenceNode(typeArgumentIdentifiers.using)],
  );

  return factory.createPropertySignature(
    undefined,
    'using',
    undefined,
    factory.createIntersectionTypeNode([
      factory.createExpressionWithTypeArguments(
        identifiers.syntax.reducedFunction,
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
          isPlural
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
              modelNode,
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
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
        ),
      ]),
    ]),
  );
};

/**
 * TODO(@nurodev): Add documentation
 */
export const generateWithSyntaxProperty = (model: Model, modelNode: TypeNode) => {
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
        modelNode,
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'options',
        undefined,
        factory.createIndexedAccessTypeNode(
          factory.createTypeReferenceNode(identifiers.compiler.combinedInstructions),
          factory.createLiteralTypeNode(factory.createStringLiteral('with')),
        ),
      ),
    ],
    factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
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
              modelNode,
            ),
          ],
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              'value',
              undefined,
              factory.createIndexedAccessTypeNode(
                factory.createTypeReferenceNode(identifiers.syntax.resultRecord),
                factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
              ),
            ),
          ],
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
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
            modelNode,
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
                factory.createTypeReferenceNode(identifiers.syntax.resultRecord),
                factory.createLiteralTypeNode(factory.createStringLiteral('ronin')),
              ),
              factory.createLiteralTypeNode(factory.createStringLiteral(normalizedSlug)),
            ),
          ),
        ],
        factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
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
          identifiers.syntax.reducedFunction,
          undefined,
        ),
        factory.createTypeLiteralNode(metaFieldsPropertySignatures),
      ]),
    ),
  );

  // Create property signatures for all model fields.
  for (const slug of Object.keys(model.fields)) {
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
              modelNode,
            ),
          ],
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              slug,
              undefined,
              factory.createIndexedAccessTypeNode(
                factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
                factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
              ),
            ),
          ],
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
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
        identifiers.syntax.reducedFunction,
        undefined,
      ),
      // TODO(@nurodev): Add support for with conditions like `startingWith`, `notStartingWith`, etc.
      factory.createTypeLiteralNode(members),
    ]),
  );
};
