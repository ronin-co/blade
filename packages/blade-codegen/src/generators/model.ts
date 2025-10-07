import { SyntaxKind, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { triggerOptionsInterface } from '@/src/declarations';
import { convertToPascalCase } from '@/src/utils/slug';
import { mapRoninFieldToTypeNode, remapNestedFields } from '@/src/utils/types';

import type { TypeAliasDeclaration, TypeParameterDeclaration } from 'typescript';

import type { ModelField } from '@/src/types/model';
import type { PopulatedModel } from 'blade-compiler';

/**
 * Generate all required type definitions for a provided schema model.
 *
 * The plural model type will be mapped to an array of the singular model type and
 * extended with the plural model properties.
 *
 * @param models - All models of the addressed space.
 *
 * @returns An array of type nodes to be added to the `index.d.ts` file.
 */
export const generateModelTypes = (
  models: Array<PopulatedModel>,
): Array<TypeAliasDeclaration> => {
  const nodes = new Array<TypeAliasDeclaration>(triggerOptionsInterface);

  for (const model of models) {
    const fields: Array<ModelField> = Object.entries(model.fields)
      .map(([slug, field]) => ({ ...field, slug }) as ModelField)
      .filter((field) => !DEFAULT_FIELD_SLUGS.includes(field.slug));

    const modelIdentifier = {
      singular: factory.createIdentifier(convertToPascalCase(model.slug)),
      plural: factory.createIdentifier(convertToPascalCase(model.pluralSlug)),
    };

    const hasLinkFields = fields.some(
      (field) =>
        field.type === 'link' && models.some((model) => model.slug === field.target),
    );

    const modelInterfaceTypeParameters = new Array<TypeParameterDeclaration>();
    const linkFieldKeys = fields
      .filter((field) => field.type === 'link')
      .map((field) =>
        factory.createLiteralTypeNode(factory.createStringLiteral(field.slug)),
      );

    /**
     * ```ts
     * <U extends Array<...> | 'all' = []>
     * ```
     */
    const usingGenericDec = factory.createTypeParameterDeclaration(
      undefined,
      typeArgumentIdentifiers.using,
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
     * SchemaSlugSchema<U>
     * ```
     */
    const modelSchemaName = factory.createTypeReferenceNode(
      modelIdentifier.singular,
      hasLinkFields
        ? [factory.createTypeReferenceNode(typeArgumentIdentifiers.using)]
        : [],
    );

    /**
     * ```ts
     * export type SchemaSlug<U extends Array<...> | 'all' = []> = ResultRecord & {
     *  // ...
     * };
     * ```
     */
    const singularModelTypeDec = factory.createTypeAliasDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      modelIdentifier.singular,
      modelInterfaceTypeParameters,
      factory.createIntersectionTypeNode([
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.resultRecord,
          ),
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
     * export type SchemaPluralSlug<U extends Array<...> | 'all' = []> = Array<SchemaSlug> & {
     *  moreBefore?: string;
     *  moreAfter?: string;
     * };
     * ```
     */
    const pluralModelTypeDec = factory.createTypeAliasDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      modelIdentifier.plural,
      modelInterfaceTypeParameters,
      factory.createIntersectionTypeNode([
        pluralModelArrayTypeDec,
        pluralModelPaginationPropsTypeDec,
      ]),
    );

    nodes.push(singularModelTypeDec, pluralModelTypeDec);
  }

  return nodes;
};
