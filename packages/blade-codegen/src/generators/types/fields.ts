import { factory } from 'typescript';

import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { convertToPascalCase } from '@/src/utils/slug';

import type { TypeAliasDeclaration } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * Generates TypeScript type aliases for model field slugs.
 *
 * @example
 * ```ts
 * type UserFieldSlug = 'id' | 'ronin.createdAt' | [...] | 'name' | 'email';
 * ```
 *
 * @param models - The models for which to generate field slug types.
 *
 * @returns An array of TypeScript type alias declarations for each model's field slugs.
 */
export const generateModelFieldsTypes = (
  models: Array<Model>,
): Array<TypeAliasDeclaration> =>
  models.map((model) =>
    factory.createTypeAliasDeclaration(
      undefined,
      factory.createIdentifier(`${convertToPascalCase(model.slug)}FieldSlug`),
      undefined,
      factory.createUnionTypeNode(
        [...DEFAULT_FIELD_SLUGS, ...Object.keys(model.fields)].map((slug) =>
          factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
        ),
      ),
    ),
  );
