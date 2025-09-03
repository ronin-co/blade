import { SyntaxKind, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { INFERRED_COMBINED_INSTRUCTION_PROPERTIES } from '@/src/constants/syntax';
import { convertToPascalCase } from '@/src/utils/slug';
import { mapRoninFieldToTypeNode } from '@/src/utils/types';

import type { TypeAliasDeclaration, TypeElement, TypeNode } from 'typescript';

import type { Model, ModelField } from '@/src/types/model';

import type {} from 'typescript';

/**
 * TODO(@nurodev): Add documentation
 *
 * @example
 * ```ts
 * type UserSyntax<S> = ReducedFunction & {
 *  // ...
 * };
 * ```
 *
 * @param models - All models of the addressed space.
 */
export const generateModelSyntaxTypes = (
  models: Array<Model>,
): Array<TypeAliasDeclaration> => {
  const nodes = new Array<TypeAliasDeclaration>();

  const schemaTypeArgumentNode = factory.createTypeReferenceNode(
    typeArgumentIdentifiers.schema,
  );

  for (const model of models) {
    const modelIdentifier = factory.createIdentifier(
      `${convertToPascalCase(model.slug)}Syntax`,
    );

    /**
     * ```ts
     * <T = S>(options?: Partial<CombinedInstructions>): T;
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
            factory.createTypeReferenceNode(
              identifiers.compiler.combinedInstructions,
              undefined,
            ),
          ]),
          undefined,
        ),
      ],
      factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
    );

    const literalMembers = new Array<TypeElement>(rootInstructionCallSignature);

    for (const propertyName of INFERRED_COMBINED_INSTRUCTION_PROPERTIES) {
      /**
       * after: <T = S>(value: CombinedInstructions["after"]) => T;
       * before: <T = S>(value: CombinedInstructions["before"]) => T;
       * including: <T = S>(value: CombinedInstructions["including"]) => T;
       * limitedTo: <T = S>(value: CombinedInstructions["limitedTo"]) => T;
       * orderedBy: <T = S>(value: CombinedInstructions["orderedBy"]) => T;
       * selecting: <T = S>(value: CombinedInstructions["selecting"]) => T;
       * using: <T = S>(value: CombinedInstructions["using"]) => T;
       */
      const memberSignature = factory.createPropertySignature(
        undefined,
        propertyName,
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
                factory.createTypeReferenceNode(
                  identifiers.compiler.combinedInstructions,
                  undefined,
                ),
                factory.createLiteralTypeNode(factory.createStringLiteral(propertyName)),
              ),
              undefined,
            ),
          ],
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
        ),
      );

      literalMembers.push(memberSignature);
    }

    /**
     * ```ts
     * with: ReducedFunction & {
     *  <T = S>(options?: Partial<CombinedInstructions>): T;
     *  id: <T = S>(value: ResultRecord["id"]) => T;
     *  ronin: ReducedFunction & {
     *    createdAt: <T = S>(value: ResultRecord["ronin"]["createdAt"]) => T;
     *    createdBy: <T = S>(value: ResultRecord["ronin"]["createdBy"]) => T;
     *    updatedAt: <T = S>(value: ResultRecord["ronin"]["updatedAt"]) => T;
     *    updatedBy: <T = S>(value: ResultRecord["ronin"]["updatedBy"]) => T;
     *  };
     * };
     * ```
     */
    const withPropertySignature = factory.createPropertySignature(
      undefined,
      'with',
      undefined,
      factory.createIntersectionTypeNode([
        factory.createExpressionWithTypeArguments(
          identifiers.utils.reducedFunction,
          undefined,
        ),
        factory.createTypeLiteralNode([
          rootInstructionCallSignature,
          ...getWithPropertySignatureMembers(
            models,
            model.fields,
            schemaTypeArgumentNode,
          ),
        ]),
      ]),
    );
    literalMembers.push(withPropertySignature);

    nodes.push(
      factory.createTypeAliasDeclaration(
        undefined,
        modelIdentifier,
        [
          factory.createTypeParameterDeclaration(
            undefined,
            typeArgumentIdentifiers.schema,
            undefined,
            undefined,
          ),
        ],
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.utils.reducedFunction,
            undefined,
          ),
          factory.createTypeLiteralNode(literalMembers),
        ]),
      ),
    );
  }

  return nodes;
};

/**
 * @todo(@nurodev): Add documentation
 */
const getWithPropertySignatureMembers = (
  models: Array<Model>,
  fields: Model['fields'],
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
                factory.createTypeReferenceNode(
                  identifiers.syntax.resultRecord,
                  undefined,
                ),
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
          identifiers.utils.reducedFunction,
          undefined,
        ),
        factory.createTypeLiteralNode(metaFieldsPropertySignatures),
      ]),
    ),
  );

  // Create property signatures for all model fields.
  for (const [slug, field] of Object.entries(fields)) {
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
              'value',
              undefined,
              factory.createUnionTypeNode(
                mapRoninFieldToTypeNode(field as ModelField, models),
              ),
              undefined,
            ),
          ],
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
        ),
      ),
    );
  }

  return members;
};
