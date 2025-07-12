import { factory } from 'typescript';

import type { Expression, Identifier, ImportDeclaration } from 'typescript';

interface CreateImportDeclarationOptions {
  /**
   * A list of all the identifiers that should be imported.
   */
  identifiers: Array<{
    alias?: Identifier;
    /**
     * The name of the identifier to import.
     */
    name: Identifier;
    /**
     * Whether the identifier should be marked as a type import.
     */
    type?: boolean;
  }>;
  /**
   * The name of the module or package or path to import from.
   */
  module: Expression;
  /**
   * Whether the import should be marked as a type import.
   */
  type?: boolean;
}

/**
 * Generates an `import {} from 'foobar';` declaration using a provided list of
 * identifiers.
 *
 * @param options - The options to use when generating the import declaration.
 *
 * @returns The generated import declaration.
 *
 * @example
 * ```ts
 * import { factory } from 'typescript';
 *
 * const declaration = createImportDeclaration({
 *  identifiers: [{ name: factory.createIdentifier('RONIN') }],
 *  module: factory.createIdentifier('ronin'),
 *  type: true,
 * });
 * // import type { RONIN } from 'ronin';
 * ```
 */
export const createImportDeclaration = (
  options: CreateImportDeclarationOptions,
): ImportDeclaration => {
  const namedBindings = factory.createNamedImports(
    options.identifiers.map((identifier) =>
      factory.createImportSpecifier(
        identifier.type ?? false,
        identifier.alias ? identifier.name : undefined,
        identifier.alias ? identifier.alias : identifier.name,
      ),
    ),
  );

  const importClause = factory.createImportClause(
    options.type ?? false,
    undefined,
    namedBindings,
  );

  return factory.createImportDeclaration(undefined, importClause, options.module);
};
