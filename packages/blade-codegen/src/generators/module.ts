import { NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { INFERRED_COMBINED_INSTRUCTION_PROPERTIES } from '@/src/constants/syntax';
import { generateQueryTypeComment } from '@/src/generators/comment';
import { convertToPascalCase } from '@/src/utils/slug';
import { mapRoninFieldToTypeNode } from '@/src/utils/types';

import type { Model, ModelField } from '@/src/types/model';
import type { DML_QUERY_TYPES } from 'blade-compiler';
import type {
  PropertySignature,
  TypeElement,
  TypeNode,
  VariableStatement,
} from 'typescript';

/**
 * Generate a `declare const` statement for a provided query type using a list
 * of provided models.
 *
 * @example
 * ```ts
 * declare const use: {
 *    user: ReducedFunction & {
 *      <T = User | null>(options?: Partial<CombinedInstructions>): T;
 *      after: <T = User | null>(value: CombinedInstructions["after"]) => T;
 *      before: <T = User | null>(value: CombinedInstructions["before"]) => T;
 *      including: <T = User | null>(value: CombinedInstructions["including"]) => T;
 *      limitedTo: <T = User | null>(value: CombinedInstructions["limitedTo"]) => T;
 *      orderedBy: <T = User | null>(value: CombinedInstructions["orderedBy"]) => T;
 *      selecting: <T = User | null>(value: CombinedInstructions["selecting"]) => T;
 *      using: <T = User | null>(value: CombinedInstructions["using"]) => T;
 *      with: ReducedFunction & {
 *         <T = User | null>(options: CombinedInstructions["with"]): T;
 *         id: <T = User | null>(value: ResultRecord["id"]) => T;
 *         ronin: {
 *          createdAt: <T = User | null>(value: ResultRecord["ronin.createdAt"]) => T;
 *          createdBy: <T = User | null>(value: ResultRecord["ronin.createdBy"]) => T;
 *          updatedAt: <T = User | null>(value: ResultRecord["ronin.updatedAt"]) => T;
 *          updatedBy: <T = User | null>(value: ResultRecord["ronin.updatedBy"]) => T;
 *         };
 *         name: <T = User | null>(value: string) => T;
 *         email: <T = User | null>(value: string) => T;
 *         // [...]
 *      };
 *    };
 *    users: ReducedFunction & {
 *      <T = Users>(options?: Partial<CombinedInstructions>): T;
 *      after: <T = Users>(value: CombinedInstructions["after"]) => T;
 *      before: <T = Users>(value: CombinedInstructions["before"]) => T;
 *      including: <T = Users>(value: CombinedInstructions["including"]) => T;
 *      limitedTo: <T = Users>(value: CombinedInstructions["limitedTo"]) => T;
 *      orderedBy: <T = Users>(value: CombinedInstructions["orderedBy"]) => T;
 *      selecting: <T = Users>(value: CombinedInstructions["selecting"]) => T;
 *      using: <T = Users>(value: CombinedInstructions["using"]) => T;
 *      with: ReducedFunction & {
 *         <T = Users>(options: CombinedInstructions["with"]): T;
 *         id: <T = Users>(value: ResultRecord["id"]) => T;
 *         ronin: {
 *           createdAt: <T = Users>(value: ResultRecord["ronin.createdAt"]) => T;
 *           createdBy: <T = Users>(value: ResultRecord["ronin.createdBy"]) => T;
 *           updatedAt: <T = Users>(value: ResultRecord["ronin.updatedAt"]) => T;
 *           updatedBy: <T = Users>(value: ResultRecord["ronin.updatedBy"]) => T;
 *         };
 *         name: <T = Users>(value: string) => T;
 *         email: <T = Users>(value: string) => T;
 *         // [...]
 *      };
 *    };
 * };
 * ```
 *
 * @param models - An array of RONIN models to generate query declarations for.
 * @param queryType - The type of query to generate (e.g. 'use').
 *
 * @returns A variable statement for the generated query declarations.
 */
export const generateQueryDeclarationStatements = (
  models: Array<Model>,
  queryType: (typeof DML_QUERY_TYPES)[number] | 'use',
): VariableStatement =>
  factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          queryType,
          undefined,
          factory.createTypeLiteralNode(
            models.flatMap((model) => {
              const comment = generateQueryTypeComment(model, queryType);

              const singularModelProperty = generateSchemaProperty(
                model.slug,
                model.fields,
                models,
                true,
              );
              const pluralModelProperty = generateSchemaProperty(
                model.pluralSlug,
                model.fields,
                models,
                false,
              );

              return [
                addSyntheticLeadingComment(
                  singularModelProperty,
                  SyntaxKind.MultiLineCommentTrivia,
                  comment.singular,
                  true,
                ),
                addSyntheticLeadingComment(
                  pluralModelProperty,
                  SyntaxKind.MultiLineCommentTrivia,
                  comment.plural,
                  true,
                ),
              ];
            }),
          ),
        ),
      ],
      NodeFlags.Const,
    ),
  );

/**
 * @todo(@nurodev): Add documentation
 */
const generateSchemaProperty = (
  modelSlug: string,
  modelFields: Model['fields'],
  models: Array<Model>,
  isNullable: boolean,
) => {
  const modelIdentifierTypes = new Array<TypeNode>(
    factory.createTypeReferenceNode(convertToPascalCase(modelSlug)),
  );
  if (isNullable)
    modelIdentifierTypes.push(factory.createLiteralTypeNode(factory.createNull()));
  const modelIdentifier = factory.createUnionTypeNode(modelIdentifierTypes);

  /**
   * ```ts
   * <T = Account | null>(options?: Partial<CombinedInstructions>): T;
   * ```
   */
  const rootInstructionHandler = generateRootInstructionHandler(
    modelIdentifier,
    factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
  );

  /**
   * ```ts
   * after: <T = User | null>(value: CombinedInstructions['after']) => T ;
   * before: <T = User | null>(value: CombinedInstructions['before'],) => T ;
   * including: <T = User | null>(value: CombinedInstructions['including']) => T ;
   * limitedTo: <T = User | null>(value: CombinedInstructions['limitedTo']) => T ;
   * orderedBy: <T = User | null>(value: CombinedInstructions['orderedBy']) => T ;
   * selecting: <T = User | null>(value: CombinedInstructions['selecting']) => T ;
   * using: <T = User | null>(value: CombinedInstructions['using']) => T ;
   * ```
   */
  const mappedCombinedInstructionProperties =
    INFERRED_COMBINED_INSTRUCTION_PROPERTIES.map((propertyName) =>
      factory.createPropertySignature(
        undefined,
        propertyName,
        undefined,
        factory.createFunctionTypeNode(
          [
            factory.createTypeParameterDeclaration(
              undefined,
              typeArgumentIdentifiers.default,
              undefined,
              modelIdentifier,
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
      ),
    );

  return factory.createPropertySignature(
    undefined,
    modelSlug,
    undefined,
    factory.createIntersectionTypeNode([
      factory.createExpressionWithTypeArguments(
        identifiers.utils.reducedFunction,
        undefined,
      ),
      factory.createTypeLiteralNode([
        rootInstructionHandler,
        ...mappedCombinedInstructionProperties,
        generateWithPropertySignature(
          modelIdentifier,
          modelFields,
          models,
          factory.createTypeReferenceNode(typeArgumentIdentifiers.default, undefined),
        ),
      ]),
    ]),
  );
};

/**
 * @todo(@nurodev): Add documentation
 */
const generateRootInstructionHandler = (
  modelIdentifier: TypeNode,
  returnTypeNode: TypeNode,
) =>
  factory.createCallSignature(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.default,
        undefined,
        modelIdentifier,
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
    returnTypeNode,
  );

/**
 * @todo(@nurodev): Add documentation
 */
const generateWithPropertySignature = (
  modelIdentifier: TypeNode,
  modelFields: Model['fields'],
  models: Array<Model>,
  returnTypeNode: TypeNode,
): PropertySignature => {
  /**
   * ```ts
   * <T = User | null>(options: CombinedInstructions["with"]): T;
   * ```
   */
  const rootInstructionHandler = factory.createCallSignature(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        typeArgumentIdentifiers.default,
        undefined,
        modelIdentifier,
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
            undefined,
          ),
          factory.createLiteralTypeNode(factory.createStringLiteral('with')),
        ),
        undefined,
      ),
    ],
    returnTypeNode,
  );

  const members = new Array<TypeElement>(
    rootInstructionHandler,
    ...generateDefaultFieldWithQueries(modelIdentifier, returnTypeNode),
  );

  for (const [slug, field] of Object.entries(modelFields)) {
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
              modelIdentifier,
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
          returnTypeNode,
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
        identifiers.utils.reducedFunction,
        undefined,
      ),
      factory.createTypeLiteralNode(members),
    ]),
  );
};

/**
 * @todo(@nurodev): Add documentation
 */
const generateDefaultFieldWithQueries = (
  modelIdentifier: TypeNode,
  returnTypeNode: TypeNode,
): Array<TypeElement> => {
  const members = new Array<TypeElement>();

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
              modelIdentifier,
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
              undefined,
            ),
          ],
          returnTypeNode,
        ),
      ),
    );
  }

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
            modelIdentifier,
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
            undefined,
          ),
        ],
        returnTypeNode,
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

  return members;
};
