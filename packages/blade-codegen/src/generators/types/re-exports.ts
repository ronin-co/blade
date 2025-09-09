import { SyntaxKind, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { convertToPascalCase } from '@/src/utils/slug';

import type { TypeAliasDeclaration, TypeParameterDeclaration } from 'typescript';

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
 * @example
 * ```ts
 * export type Post<U extends Array<"..."> | "all" = []> = import('blade/types').Post<U>;
 * export type Posts<U extends Array<"..."> | "all" = []> = import('blade/types').Posts<U>;
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

  const typeParameters = new Array<TypeParameterDeclaration>();

  const hasLinkFields = Object.values(model.fields).some(
    (model) => model.type === 'link',
  );
  if (hasLinkFields) {
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
          factory.createUnionTypeNode(
            Object.entries(model.fields)
              .filter(([, field]) => field.type === 'link')
              .map(([slug]) =>
                factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
              ),
          ),
        ]),
        factory.createLiteralTypeNode(factory.createStringLiteral('all')),
      ]),
      factory.createTupleTypeNode([]),
    );

    typeParameters.push(usingGenericDec);
  }

  return [
    factory.createTypeAliasDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      slug,
      typeParameters,
      factory.createImportTypeNode(
        factory.createTypeReferenceNode(identifiers.blade.module.types),
        undefined,
        factory.createIdentifier(slug),
        hasLinkFields
          ? [factory.createTypeReferenceNode(typeArgumentIdentifiers.using)]
          : [],
        false,
      ),
    ),
    factory.createTypeAliasDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      pluralSlug,
      typeParameters,
      factory.createImportTypeNode(
        factory.createTypeReferenceNode(identifiers.blade.module.types),
        undefined,
        factory.createIdentifier(pluralSlug),
        hasLinkFields
          ? [factory.createTypeReferenceNode(typeArgumentIdentifiers.using)]
          : [],
        false,
      ),
    ),
  ];
};
