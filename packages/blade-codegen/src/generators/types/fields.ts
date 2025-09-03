import { factory } from 'typescript';

import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { convertToPascalCase } from '@/src/utils/slug';

import type { Model } from '@/src/types/model';

/**
 * TODO(@nurodev): Add documentation
 *
 * @param models - All models of the addressed space.
 */
export const generateModelFieldsTypes = (models: Array<Model>) =>
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
