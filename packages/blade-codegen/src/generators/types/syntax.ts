import { SyntaxKind, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { INFERRED_COMBINED_INSTRUCTION_PROPERTIES } from '@/src/constants/syntax';
import { convertToPascalCase } from '@/src/utils/slug';

import type { TypeAliasDeclaration, TypeElement, TypeNode } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * Generates TypeScript type aliases for model syntax.
 *
 * @example
 * ```ts
 * type UserSyntax<S, Q> = ReducedFunction & {
 *  // ...
 * };
 * ```
 *
 * @param model - The model to generate syntax types for.
 *
 * @returns An array of type alias declarations for model syntax.
 */
export const generateModelSyntaxTypes = (model: Model): TypeAliasDeclaration => {
  const schemaTypeArgumentNode = factory.createTypeReferenceNode(
    typeArgumentIdentifiers.schema,
  );

  const modelIdentifier = factory.createIdentifier(
    `${convertToPascalCase(model.slug)}Syntax`,
  );

  /**
   * ```ts
   * <T = S>(options?: Partial<Q>): T;
   * ```
   */
  const rootInstructionCallSignature = factory.createCallSignature(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.default,
        undefined,
        schemaTypeArgumentNode,
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'options',
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(identifiers.primitive.partial, [
          factory.createTypeReferenceNode(typeArgumentIdentifiers.queries),
        ]),
        undefined,
      ),
    ],
    factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
  );

  const members = new Array<TypeElement>(rootInstructionCallSignature);
  for (const propertyName of INFERRED_COMBINED_INSTRUCTION_PROPERTIES) {
    switch (propertyName) {
      case 'orderedBy': {
        const typedFields = factory.createTypeReferenceNode(identifiers.primitive.array, [
          factory.createUnionTypeNode([
            factory.createTypeReferenceNode(identifiers.compiler.expression),
            factory.createTypeReferenceNode(
              factory.createIdentifier(`${convertToPascalCase(model.slug)}FieldSlug`),
            ),
          ]),
        ]);

        /**
         * orderedBy: ReducedFunction & (<T = S>(options: {
         *  ascending?: Array<Expression | '...' | '...'>;
         *  descending?: Array<Expression | '...' | '...'>;
         * }) => T) & {
         *  ascending: (<T = S>(fields: Array<Expression | '...' | '...'>) => T);
         *  descending: (<T = S>(fields: Array<Expression | '...' | '...'>) => T);
         * };
         */
        const orderedBySignature = factory.createPropertySignature(
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
                  schemaTypeArgumentNode,
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
                        schemaTypeArgumentNode,
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
                    factory.createTypeReferenceNode(
                      typeArgumentIdentifiers.default,
                      undefined,
                    ),
                  ),
                ),
              ),
            ),
          ]),
        );
        members.push(orderedBySignature);
        continue;
      }
      case 'selecting': {
        /**
         * selecting: ReducedFunction & (<T = S>(options: Array<UserFieldSlug>) => T);
         */
        const selectingSignature = factory.createPropertySignature(
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
                  schemaTypeArgumentNode,
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
                        `${convertToPascalCase(model.slug)}FieldSlug`,
                      ),
                    ),
                  ]),
                ),
              ],
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
            ),
          ]),
        );
        members.push(selectingSignature);
        continue;
      }
      case 'to': {
        // TODO(@nurodev): Add write query support
        continue;
      }
      case 'with': {
        /**
         * ```ts
         * with: ReducedFunction & {
         *  <T = S>(options: CombinedInstructions["with"]): T;
         *  id: <T = S>(value: ResultRecord["id"]) => T;
         *  ronin: ReducedFunction & {
         *    createdAt: <T = S>(value: ResultRecord["ronin"]["createdAt"]) => T;
         *    createdBy: <T = S>(value: ResultRecord["ronin"]["createdBy"]) => T;
         *    updatedAt: <T = S>(value: ResultRecord["ronin"]["updatedAt"]) => T;
         *    updatedBy: <T = S>(value: ResultRecord["ronin"]["updatedBy"]) => T;
         *  };
         *  name: <T = S>(value: User["name"]) => T;
         *  email: <T = S>(value: User["email"]) => T;
         *  // [...]
         * };
         * ```
         */
        const withPropertySignature = factory.createPropertySignature(
          undefined,
          'with',
          undefined,
          factory.createIntersectionTypeNode([
            factory.createExpressionWithTypeArguments(
              identifiers.syntax.reducedFunction,
              undefined,
            ),
            // TODO(@nurodev): Add support for with conditions like `startingWith`, `notStartingWith`, etc.
            factory.createTypeLiteralNode([
              factory.createCallSignature(
                [
                  factory.createTypeParameterDeclaration(
                    undefined,
                    typeArgumentIdentifiers.default,
                    undefined,
                    schemaTypeArgumentNode,
                  ),
                ],
                [
                  factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    'options',
                    undefined,
                    factory.createIndexedAccessTypeNode(
                      factory.createTypeReferenceNode(
                        identifiers.compiler.combinedInstructions,
                      ),
                      factory.createLiteralTypeNode(factory.createStringLiteral('with')),
                    ),
                  ),
                ],
                factory.createTypeReferenceNode(
                  typeArgumentIdentifiers.default,
                  undefined,
                ),
              ),
              ...getWithPropertySignatureMembers(model, schemaTypeArgumentNode),
            ]),
          ]),
        );
        members.push(withPropertySignature);
        continue;
      }
      default: {
        /**
         * after: ReducedFunction & (<T = S>(value: CombinedInstructions["after"]) => T);
         * before: ReducedFunction & (<T = S>(value: CombinedInstructions["before"]) => T);
         * including: ReducedFunction & (<T = S>(value: CombinedInstructions["including"]) => T);
         * limitedTo: ReducedFunction & (<T = S>(value: CombinedInstructions["limitedTo"]) => T);
         * selecting: ReducedFunction & (<T = S>(value: CombinedInstructions["selecting"]) => T);
         * using: ReducedFunction & (<T = S>(value: CombinedInstructions["using"]) => T);
         */
        const memberSignature = factory.createPropertySignature(
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
                  schemaTypeArgumentNode,
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
                    ),
                    factory.createLiteralTypeNode(
                      factory.createStringLiteral(propertyName),
                    ),
                  ),
                ),
              ],
              factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
            ),
          ]),
        );
        members.push(memberSignature);
      }
    }
  }

  return factory.createTypeAliasDeclaration(
    undefined,
    modelIdentifier,
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.schema,
        undefined,
        undefined,
      ),
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.queries,
        undefined,
        undefined,
      ),
    ],
    factory.createIntersectionTypeNode([
      factory.createExpressionWithTypeArguments(
        identifiers.syntax.reducedFunction,
        undefined,
      ),
      factory.createTypeLiteralNode(members),
    ]),
  );
};

/**
 * Generates the members for the `with` property signature.
 *
 * @example
 * ```ts
 *  id: <T = S>(value: ResultRecord["id"]) => T;
 *  ronin: ReducedFunction & {
 *    createdAt: <T = S>(value: ResultRecord["ronin"]["createdAt"]) => T;
 *    createdBy: <T = S>(value: ResultRecord["ronin"]["createdBy"]) => T;
 *    updatedAt: <T = S>(value: ResultRecord["ronin"]["updatedAt"]) => T;
 *    updatedBy: <T = S>(value: ResultRecord["ronin"]["updatedBy"]) => T;
 *  };
 *  name: <T = S>(value: User["name"]) => T;
 *  email: <T = S>(value: User["email"]) => T;
 * ```
 *
 * @param model - The model to generate the `with` property signature members for.
 * @param schemaTypeArgumentNode - The schema type argument node to use for the `with` property signature members.

 * @returns An array of type elements representing the `with` property signature members.
 */
const getWithPropertySignatureMembers = (
  model: Model,
  schemaTypeArgumentNode: TypeNode,
): Array<TypeElement> => {
  const members = new Array<TypeElement>();

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
              schemaTypeArgumentNode,
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
            schemaTypeArgumentNode,
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
              schemaTypeArgumentNode,
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

  return members;
};
