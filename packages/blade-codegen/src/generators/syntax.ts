import { factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { sharedQueryOptionsParameter } from '@/src/declarations';
import { convertToPascalCase } from '@/src/utils/slug';

import type { IntersectionTypeNode, TypeAliasDeclaration, TypeNode } from 'typescript';

import type { PopulatedModel } from 'blade-compiler';

/**
 * Generate the syntax for a `using` query.
 *
 * @param model - The model to generate the syntax for.
 * @param modelNode - The TypeNode representing the model.
 * @param promise - Whether the return type should be a Promise.
 * @param plural - Whether the return type should be plural (array) or singular.
 *
 * @returns An IntersectionTypeNode representing the `using` syntax.
 */
export const generateUsingSyntax = (
  model: PopulatedModel,
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
   * @example
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
   * @example
   * ```ts
   * User<U>
   * ```
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
   * @example
   * ```ts
   * <U extends Array<"..."> | "all">(fields: U): Post<U> | null;
   * ```
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
   * @example
   * ```ts
   * <T = Post | null>(fields: Array<"..."> | "all"): T;
   * ```
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
 * Generate the syntax for a `with` query.
 *
 * @param model - The model to generate the syntax for.
 * @param modelNode - The TypeNode representing the model.
 * @param promise - Whether the return type should be a Promise.
 *
 * @returns A TypeAliasDeclaration representing the `with` syntax.
 */
export const generateWithSyntax = (
  model: PopulatedModel,
  modelNode: TypeNode,
  promise: boolean,
): TypeAliasDeclaration => {
  const modelUserFieldEntries = Object.entries(model.fields).filter(
    ([slug]) => !DEFAULT_FIELD_SLUGS.some((field) => field.includes(slug)),
  );

  const name = promise
    ? identifiers.namespace.utils.withQueryPromise
    : identifiers.namespace.utils.withQuery;

  return factory.createTypeAliasDeclaration(
    undefined,
    name,
    undefined,
    factory.createIntersectionTypeNode([
      factory.createTypeReferenceNode(
        factory.createQualifiedName(identifiers.namespace.utils.name, name),
        [
          modelNode,
          factory.createTypeReferenceNode(
            factory.createIdentifier(convertToPascalCase(model.slug)),
          ),
        ],
      ),
      factory.createTypeLiteralNode(
        modelUserFieldEntries.map(([slug, field]) => {
          /**
           * @example
           * ```ts
           * Post["author"]
           * ```
           */
          const baseFieldProperty = factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
            factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
          );

          const parameterNodes = new Array<TypeNode>(baseFieldProperty);
          if (field.type === 'link') {
            /**
             * @example
             * ```ts
             * Partial<Post<["author"]>["author"]>
             * ```
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
