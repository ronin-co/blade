import { SyntaxKind, factory } from 'typescript';

import { genericIdentifiers, identifiers } from '@/src/constants/identifiers';
import { MODEL_TYPE_TO_SYNTAX_KIND_KEYWORD } from '@/src/constants/schema';
import { convertToPascalCase } from '@/src/utils/slug';

import type { ModelField } from '@ronin/compiler';
import type { TypeNode } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * Map a RONIN model field to a TypeScript type node.
 *
 * @param field - The RONIN model field to map.
 * @param models - The list of all RONIN models. Used to resolve link fields.
 *
 * @returns An array of TypeScript type nodes representing the field type.
 */
export const mapRoninFieldToTypeNode = (
  field: ModelField,
  models: Array<Model>,
): Array<TypeNode> => {
  const propertyUnionTypes = new Array<TypeNode>();

  switch (field.type) {
    case 'link': {
      // Check to make sure the target model exists. If it doesn't we
      // fall back to using `unknown` as the type.
      const targetModel = models.find((model) => model.slug === field.target);
      if (!targetModel) {
        propertyUnionTypes.push(factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword));
        break;
      }

      // If the field is marked as `many` then we need to wrap the
      // type in an array.
      const schemaTypeRef = factory.createTypeReferenceNode(
        convertToPascalCase(targetModel.slug),
      );
      const resolvedLinkFieldNode = factory.createTypeReferenceNode(
        identifiers.utils.resolveSchema,
        [
          field.kind === 'many'
            ? factory.createTypeReferenceNode(identifiers.primitive.array, [
                schemaTypeRef,
              ])
            : schemaTypeRef,

          factory.createTypeReferenceNode(genericIdentifiers.using),

          factory.createLiteralTypeNode(factory.createStringLiteral(field.slug)),
        ],
      );

      propertyUnionTypes.push(resolvedLinkFieldNode);
      break;
    }
    case 'blob':
    case 'boolean':
    case 'date':
    case 'json':
    case 'number':
    case 'string': {
      const primitive = MODEL_TYPE_TO_SYNTAX_KIND_KEYWORD[field.type];
      propertyUnionTypes.push(primitive);
      break;
    }
    default: {
      propertyUnionTypes.push(factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword));
      break;
    }
  }

  // We need to mark fields as nullable if they are:
  // - Not required
  // - Not a link field
  // - Not a many-to-many link field
  if (field.required === false && field.type === 'link' && field.kind !== 'many')
    propertyUnionTypes.push(factory.createLiteralTypeNode(factory.createNull()));

  return propertyUnionTypes;
};

/**
 * Remap nested fields to a more usable format.
 *
 * Currently, nested fields for a RONIN model are stored using a dot-notation
 * slug, such as `foo.bar`. However, these are resolved as a nested object.
 * As such, we need to remap the fields to a more usable format.
 *
 * @param fields - The list of fields to remap.
 *
 * @returns An array of entries where the key is the field slug and the value is
 * either the field itself or an array of (nested) fields.
 */
export const remapNestedFields = (
  fields: Array<ModelField>,
): Array<[string, ModelField | Array<ModelField>]> => {
  const remappedFields = new Map<string, ModelField | Array<ModelField>>();

  for (const field of fields) {
    if (!field.slug.includes('.')) {
      remappedFields.set(field.slug, field);
      continue;
    }

    const [parentSlug, childSlug] = field.slug.split('.');
    const nestedField = Object.assign({}, field, {
      slug: childSlug,
    });

    const parentField = remappedFields.get(parentSlug);
    if (!parentField) {
      remappedFields.set(parentSlug, [nestedField]);
      continue;
    }

    if (!Array.isArray(parentField)) continue;

    parentField.push(nestedField);
  }

  return Array.from(remappedFields.entries());
};
