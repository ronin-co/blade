import { SyntaxKind, factory } from 'typescript';

import { identifiers } from '@/src/constants/identifiers';
import { convertToPascalCase } from '@/src/utils/slug';

import type { TypeAliasDeclaration } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * Generate type re-exports for all provided models.
 *
 * @example
 * ```ts
 * type User = ResultRecord & {
 *   email: string;
 *   name: string;
 * };
 *
 * type Users = Array<User> & {
 *   moreBefore?: string;
 *   moreAfter?: string;
 * };
 * ```
 *
 * @param models - All RONIN models to generate type re-exports for.
 *
 * @returns An array of type alias declarations for each model.
 */
export const generateTypeReExports = (
  models: Array<Model>,
): Array<TypeAliasDeclaration> =>
  models.flatMap((model) => {
    const slug = convertToPascalCase(model.slug);
    const pluralSlug = convertToPascalCase(model.pluralSlug);

    return [
      factory.createTypeAliasDeclaration(
        [factory.createModifier(SyntaxKind.ExportKeyword)],
        slug,
        undefined,
        factory.createImportTypeNode(
          factory.createTypeReferenceNode(identifiers.blade.module.types),
          undefined,
          factory.createIdentifier(slug),
          undefined,
          false,
        ),
      ),
      factory.createTypeAliasDeclaration(
        [factory.createModifier(SyntaxKind.ExportKeyword)],
        pluralSlug,
        undefined,
        factory.createImportTypeNode(
          factory.createTypeReferenceNode(identifiers.blade.module.types),
          undefined,
          factory.createIdentifier(pluralSlug),
          undefined,
          false,
        ),
      ),
    ];
  });
