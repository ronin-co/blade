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
 * export type User = import('blade/types').User;
 * export type Users = import('blade/types').Users;
 * ```
 *
 * @param model - The model to generate type re-exports for.
 *
 * @returns An array of type alias declarations for each model.
 */
export const generateTypeReExports = (
  model: Model,
): [TypeAliasDeclaration, TypeAliasDeclaration] => {
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
};
