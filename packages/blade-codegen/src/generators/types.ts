import { SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { genericIdentifiers, identifiers } from '@/src/constants/identifiers';
import { convertToPascalCase } from '@/src/utils/slug';
import { mapRoninFieldToTypeNode, remapNestedFields } from '@/src/utils/types';

import type {
  InterfaceDeclaration,
  TypeAliasDeclaration,
  TypeParameterDeclaration,
} from 'typescript';

import type { Model, ModelField } from '@/src/types/model';

const DEFAULT_FIELD_SLUGS = [
  'id',
  'ronin.createdAt',
  'ronin.createdBy',
  'ronin.locked',
  'ronin.updatedAt',
  'ronin.updatedBy',
] satisfies Array<string>;

/**
 * Generate all required type definitions for a provided RONIN model.
 *
 * This will generate a shared schema interface that is then used to create type
 * aliases for both the singular and plural model types.
 *
 * The plural model type will be mapped to an array of the singular model type
 * and extend it with the plural model properties.
 *
 * @param models - All RONIN models of the addressed space.
 *
 * @returns - An array of type nodes to be added to the `index.d.ts` file.
 */
export const generateTypes = (
  models: Array<Model>,
): Array<InterfaceDeclaration | TypeAliasDeclaration> => {
  const nodes = new Array<InterfaceDeclaration | TypeAliasDeclaration>();

  for (const model of models) {
    const fields: Array<ModelField> = Object.entries(model.fields)
      .map(([slug, field]) => ({ ...field, slug }) as ModelField)
      .filter((field) => !DEFAULT_FIELD_SLUGS.includes(field.slug));

    const singularModelIdentifier = factory.createIdentifier(
      convertToPascalCase(model.slug),
    );
    const pluralSchemaIdentifier = factory.createIdentifier(
      convertToPascalCase(model.pluralSlug),
    );

    const hasLinkFields = fields.some(
      (field) =>
        field.type === 'link' && models.some((model) => model.slug === field.target),
    );

    const modelInterfaceTypeParameters = new Array<TypeParameterDeclaration>();
    const linkFieldKeys = fields
      .filter((field) => field.type === 'link')
      .map((field) => {
        const literal = factory.createStringLiteral(field.slug);
        return factory.createLiteralTypeNode(literal);
      });

    /**
     * ```ts
     * <TUsing extends Array<...> | 'all' = []>
     * ```
     */
    const usingGenericDec = factory.createTypeParameterDeclaration(
      undefined,
      genericIdentifiers.using,
      factory.createUnionTypeNode([
        factory.createTypeReferenceNode(identifiers.primitive.array, [
          factory.createUnionTypeNode(linkFieldKeys),
        ]),
        factory.createLiteralTypeNode(factory.createStringLiteral('all')),
      ]),
      factory.createTupleTypeNode([]),
    );

    if (hasLinkFields) modelInterfaceTypeParameters.push(usingGenericDec);

    /**
     * ```ts
     * SchemaSlugSchema<TUsing>
     * ```
     */
    const modelSchemaName = factory.createTypeReferenceNode(
      singularModelIdentifier,
      hasLinkFields ? [factory.createTypeReferenceNode(genericIdentifiers.using)] : [],
    );

    /**
     * ```ts
     * export type SchemaSlug<TUsing extends Array<...> | 'all' = []> = ResultRecord & {
     *  // ...
     * };
     * ```
     */
    const singularModelTypeDec = factory.createTypeAliasDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      singularModelIdentifier,
      modelInterfaceTypeParameters,
      factory.createIntersectionTypeNode([
        factory.createExpressionWithTypeArguments(
          identifiers.syntax.resultRecord,
          undefined,
        ),
        factory.createTypeLiteralNode(
          remapNestedFields(fields)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([fieldSlug, field]) => {
              if (Array.isArray(field)) {
                const sortedFields = field.sort((a, b) => a.slug.localeCompare(b.slug));
                return factory.createPropertySignature(
                  undefined,
                  fieldSlug,
                  undefined,
                  factory.createTypeLiteralNode(
                    sortedFields.map((nestedField) =>
                      factory.createPropertySignature(
                        undefined,
                        nestedField.slug,
                        undefined,
                        factory.createUnionTypeNode(
                          mapRoninFieldToTypeNode(nestedField, models),
                        ),
                      ),
                    ),
                  ),
                );
              }

              return factory.createPropertySignature(
                undefined,
                fieldSlug,
                undefined,
                factory.createUnionTypeNode(mapRoninFieldToTypeNode(field, models)),
              );
            }),
        ),
      ]),
    );

    /**
     * ```ts
     * Array<SchemaSlug>;
     * ```
     */
    const pluralModelArrayTypeDec = factory.createTypeReferenceNode(
      identifiers.primitive.array,
      [modelSchemaName],
    );

    /**
     * ```ts
     * {
     *  moreBefore?: string;
     *  moreAfter?: string;
     * };
     * ```
     */
    const pluralModelPaginationPropsTypeDec = factory.createTypeLiteralNode([
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier('moreBefore'),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
      ),
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier('moreAfter'),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
      ),
    ]);

    /**
     * ```ts
     * export type SchemaPluralSlug<TUsing extends Array<...> | 'all' = []> = Array<SchemaSlug> & {
     *  moreBefore?: string;
     *  moreAfter?: string;
     * };
     * ```
     */
    const pluralModelTypeDec = factory.createTypeAliasDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      pluralSchemaIdentifier,
      modelInterfaceTypeParameters,
      factory.createIntersectionTypeNode([
        pluralModelArrayTypeDec,
        pluralModelPaginationPropsTypeDec,
      ]),
    );

    // If the model does not have a summary / description
    // then we can continue to the next iteration & not add any comments.
    if (!model.summary) {
      nodes.push(singularModelTypeDec, pluralModelTypeDec);
      continue;
    }

    nodes.push(
      addSyntheticLeadingComment(
        singularModelTypeDec,
        SyntaxKind.MultiLineCommentTrivia,
        `*\n * ${model.summary}\n `,
        true,
      ),
      addSyntheticLeadingComment(
        pluralModelTypeDec,
        SyntaxKind.MultiLineCommentTrivia,
        `*\n * ${model.summary}\n `,
        true,
      ),
    );
  }

  return nodes;
};
