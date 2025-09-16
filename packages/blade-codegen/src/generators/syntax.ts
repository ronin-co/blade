import { factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { sharedQueryOptionsParameter } from '@/src/declarations';
import { convertToPascalCase } from '@/src/utils/slug';

import type {
  Identifier,
  IntersectionTypeNode,
  TypeAliasDeclaration,
  TypeNode,
} from 'typescript';

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

/**
 * @todo(@nurodev): Add documentation
 */
export const generateWithSyntax = (
  name: string | Identifier,
  modelNode: TypeNode,
  model: Model,
  promise: boolean,
): TypeAliasDeclaration => {
  const modelUserFieldEntries = Object.entries(model.fields).filter(
    ([slug]) => !DEFAULT_FIELD_SLUGS.some((field) => field.includes(slug)),
  );

  return factory.createTypeAliasDeclaration(
    undefined,
    name,
    undefined,
    factory.createIntersectionTypeNode([
      factory.createTypeReferenceNode(
        factory.createQualifiedName(identifiers.namespace.utils.name, name),
        [modelNode],
      ),
      factory.createTypeLiteralNode(
        modelUserFieldEntries.map(([slug, field]) => {
          /**
           * @todo(@nurodev): Add documentation
           */
          const baseFieldProperty = factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
            factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
          );

          const parameterNodes = new Array<TypeNode>(baseFieldProperty);
          if (field.type === 'link') {
            /**
             * @todo(@nurodev): Add documentation
             */
            const nestedFieldProperty = factory.createTypeReferenceNode(
              identifiers.primitive.partial,
              [
                factory.createIndexedAccessTypeNode(
                  factory.createTypeReferenceNode(convertToPascalCase(model.slug), [
                    factory.createTupleTypeNode([
                      factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
                    ]),
                  ]),
                  factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
                ),
              ],
            );
            parameterNodes.push(nestedFieldProperty);
          }

          return factory.createPropertySignature(
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
                  factory.createUnionTypeNode(parameterNodes),
                ),
                sharedQueryOptionsParameter,
              ],
              promise
                ? factory.createTypeReferenceNode(identifiers.primitive.promise, [
                    factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
                  ])
                : factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ),
          );
        }),
      ),
    ]),
  );
};
