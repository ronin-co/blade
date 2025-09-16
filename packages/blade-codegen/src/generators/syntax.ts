import { factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { convertToPascalCase } from '@/src/utils/slug';

import type { IntersectionTypeNode, TypeNode } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * @todo(@nurodev): Add documentation
 */
export const generateUsingSyntax = (
  model: Model,
  modelNode: TypeNode,
  promise: boolean,
  plural: boolean,
): IntersectionTypeNode => {
  const hasLinkFields = Object.values(model.fields).some(
    (field) => field.type === 'link',
  );
  if (!hasLinkFields)
    return factory.createIntersectionTypeNode([
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
              factory.createLiteralTypeNode(factory.createStringLiteral('using')),
            ),
          ),
        ],
        promise
          ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ])
          : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
      ),
    ]);

  /**
   * @todo(@nurodev): Add documentation
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
   * @todo(@nurodev): Add documentation
   */
  const baseModelWithFields = factory.createTypeReferenceNode(
    factory.createIdentifier(convertToPascalCase(model.slug)),
    [factory.createTypeReferenceNode(typeArgumentIdentifiers.using)],
  );
  const modelNodeWithFields = promise
    ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
        baseModelWithFields,
      ])
    : baseModelWithFields;

  /**
   * @todo(@nurodev): Add documentation
   */
  const inferredCallSignature = factory.createCallSignature(
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
    plural
      ? modelNodeWithFields
      : factory.createUnionTypeNode([
          modelNodeWithFields,
          factory.createLiteralTypeNode(factory.createNull()),
        ]),
  );

  /**
   * @todo(@nurodev): Add documentation
   */
  const overrideCallSignaure = factory.createCallSignature(
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
    promise
      ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
        ])
      : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
  );

  return factory.createIntersectionTypeNode([
    factory.createExpressionWithTypeArguments(
      identifiers.blade.reducedFunction,
      undefined,
    ),
    factory.createTypeLiteralNode([inferredCallSignature, overrideCallSignaure]),
  ]);
};
