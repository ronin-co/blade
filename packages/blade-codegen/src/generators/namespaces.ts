import { NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { identifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { generateQueryTypeComment } from '@/src/generators/comment';
import { generateUsingSyntax, generateWithSyntax } from '@/src/generators/syntax';
import { convertToPascalCase } from '@/src/utils/slug';

import type { Statement, TypeAliasDeclaration } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * Generate syntax namespaces for each model.
 *
 * @example
 * ```ts
 * declare namespace Syntax {
 *  type AddQuery = { ... };
 *  type GetQuery = { ... };
 *  type RemoveQuery = { ... };
 *  type SetQuery = { ... };
 *
 *  namespace User {
 *    type FieldSlug = 'id' | '...';
 *
 *    namespace Singular { ... }
 *    namespace Plural { ... }
 *  }
 * }
 * ```
 *
 * @param models - Array of models to generate namespaces for.
 *
 * @returns Array of module declarations representing the namespaces.
 */
export const generateNamespaces = (models: Array<Model>): Array<Statement> => {
  const moduleDeclarations = new Array<Statement>();

  /**
   * @example
   * ```ts
   * type AddQuery = { ... };
   * ```
   */
  const addQueryTypeDeclaration = factory.createTypeLiteralNode(
    models.flatMap((model) => {
      const comment = generateQueryTypeComment(model, 'add');

      const modelSyntaxIdentifier = factory.createIdentifier(
        convertToPascalCase(model.slug),
      );

      /**
       * @example
       * ```ts
       * user: ReducedFunction & Syntax.User.Singular.RootQueryCallerPromise & { ... };
       * ```
       */
      const singularProperty = factory.createPropertySignature(
        undefined,
        model.slug,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createQualifiedName(
                  identifiers.namespace.syntax.name,
                  modelSyntaxIdentifier,
                ),
                identifiers.namespace.syntax.singular,
              ),
              identifiers.namespace.utils.rootQueryCallerPromise,
            ),
          ),
          factory.createTypeLiteralNode(
            Object.entries({
              after: identifiers.namespace.utils.afterQueryPromise,
              before: identifiers.namespace.utils.beforeQueryPromise,
              including: identifiers.namespace.utils.includingQueryPromise,
              limitedTo: identifiers.namespace.utils.limitedToQueryPromise,
              orderedBy: identifiers.namespace.utils.orderedByQueryPromise,
              selecting: identifiers.namespace.utils.selectingQueryPromise,
              to: identifiers.namespace.utils.toQueryPromise,
              using: identifiers.namespace.utils.usingQueryPromise,
              with: identifiers.namespace.utils.withQueryPromise,
            }).map(([instruction, utilIdentifier]) =>
              factory.createPropertySignature(
                undefined,
                instruction,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createQualifiedName(
                      factory.createQualifiedName(
                        identifiers.namespace.syntax.name,
                        modelSyntaxIdentifier,
                      ),
                      identifiers.namespace.syntax.singular,
                    ),
                    utilIdentifier,
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

      /**
       * @example
       * ```ts
       * users: ReducedFunction & Syntax.User.Plural.RootQueryCallerPromise & { ... };
       * ```
       */
      const pluralProperty = factory.createPropertySignature(
        undefined,
        model.pluralSlug,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createQualifiedName(
                  identifiers.namespace.syntax.name,
                  modelSyntaxIdentifier,
                ),
                identifiers.namespace.syntax.plural,
              ),
              identifiers.namespace.utils.rootQueryCallerPromise,
            ),
          ),
          factory.createTypeLiteralNode(
            Object.entries({
              after: identifiers.namespace.utils.afterQueryPromise,
              before: identifiers.namespace.utils.beforeQueryPromise,
              including: identifiers.namespace.utils.includingQueryPromise,
              limitedTo: identifiers.namespace.utils.limitedToQueryPromise,
              orderedBy: identifiers.namespace.utils.orderedByQueryPromise,
              selecting: identifiers.namespace.utils.selectingQueryPromise,
              to: identifiers.namespace.utils.toQueryPromise,
              using: identifiers.namespace.utils.usingQueryPromise,
              with: identifiers.namespace.utils.withQueryPromise,
            }).map(([instruction, utilIdentifier]) =>
              factory.createPropertySignature(
                undefined,
                instruction,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createQualifiedName(
                      factory.createQualifiedName(
                        identifiers.namespace.syntax.name,
                        modelSyntaxIdentifier,
                      ),
                      identifiers.namespace.syntax.plural,
                    ),
                    utilIdentifier,
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

      return [
        addSyntheticLeadingComment(
          singularProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.singular,
          true,
        ),
        addSyntheticLeadingComment(
          pluralProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.plural,
          true,
        ),
      ];
    }),
  );
  moduleDeclarations.push(
    factory.createTypeAliasDeclaration(
      undefined,
      identifiers.namespace.syntax.addQuery,
      undefined,
      addQueryTypeDeclaration,
    ),
  );

  /**
   * @example
   * ```ts
   * type GetQuery = { ... };
   * ```
   */
  const getQueryTypeDeclaration = factory.createTypeLiteralNode(
    models.flatMap((model) => {
      const comment = generateQueryTypeComment(model, 'get');

      const modelSyntaxIdentifier = factory.createIdentifier(
        convertToPascalCase(model.slug),
      );

      /**
       * @example
       * ```ts
       * user: ReducedFunction & Syntax.User.Singular.RootQueryCallerPromise & { ... };
       * ```
       */
      const singularProperty = factory.createPropertySignature(
        undefined,
        model.slug,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createQualifiedName(
                  identifiers.namespace.syntax.name,
                  modelSyntaxIdentifier,
                ),
                identifiers.namespace.syntax.singular,
              ),
              identifiers.namespace.utils.rootQueryCallerPromise,
            ),
          ),
          factory.createTypeLiteralNode(
            Object.entries({
              after: identifiers.namespace.utils.afterQueryPromise,
              before: identifiers.namespace.utils.beforeQueryPromise,
              including: identifiers.namespace.utils.includingQueryPromise,
              limitedTo: identifiers.namespace.utils.limitedToQueryPromise,
              orderedBy: identifiers.namespace.utils.orderedByQueryPromise,
              selecting: identifiers.namespace.utils.selectingQueryPromise,
              to: identifiers.namespace.utils.toQueryPromise,
              using: identifiers.namespace.utils.usingQueryPromise,
              with: identifiers.namespace.utils.withQueryPromise,
            }).map(([instruction, utilIdentifier]) =>
              factory.createPropertySignature(
                undefined,
                instruction,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createQualifiedName(
                      factory.createQualifiedName(
                        identifiers.namespace.syntax.name,
                        modelSyntaxIdentifier,
                      ),
                      identifiers.namespace.syntax.singular,
                    ),
                    utilIdentifier,
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

      /**
       * @example
       * ```ts
       * users: ReducedFunction & Syntax.User.Plural.RootQueryCallerPromise & { ... };
       * ```
       */
      const pluralProperty = factory.createPropertySignature(
        undefined,
        model.pluralSlug,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createQualifiedName(
                  identifiers.namespace.syntax.name,
                  modelSyntaxIdentifier,
                ),
                identifiers.namespace.syntax.plural,
              ),
              identifiers.namespace.utils.rootQueryCallerPromise,
            ),
          ),
          factory.createTypeLiteralNode(
            Object.entries({
              after: identifiers.namespace.utils.afterQueryPromise,
              before: identifiers.namespace.utils.beforeQueryPromise,
              including: identifiers.namespace.utils.includingQueryPromise,
              limitedTo: identifiers.namespace.utils.limitedToQueryPromise,
              orderedBy: identifiers.namespace.utils.orderedByQueryPromise,
              selecting: identifiers.namespace.utils.selectingQueryPromise,
              to: identifiers.namespace.utils.toQueryPromise,
              using: identifiers.namespace.utils.usingQueryPromise,
              with: identifiers.namespace.utils.withQueryPromise,
            }).map(([instruction, utilIdentifier]) =>
              factory.createPropertySignature(
                undefined,
                instruction,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createQualifiedName(
                      factory.createQualifiedName(
                        identifiers.namespace.syntax.name,
                        modelSyntaxIdentifier,
                      ),
                      identifiers.namespace.syntax.plural,
                    ),
                    utilIdentifier,
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

      return [
        addSyntheticLeadingComment(
          singularProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.singular,
          true,
        ),
        addSyntheticLeadingComment(
          pluralProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.plural,
          true,
        ),
      ];
    }),
  );
  moduleDeclarations.push(
    factory.createTypeAliasDeclaration(
      undefined,
      identifiers.namespace.syntax.getQuery,
      undefined,
      getQueryTypeDeclaration,
    ),
  );

  /**
   * @example
   * ```ts
   * type RemoveQuery = { ... };
   * ```
   */
  const removeQueryTypeDeclaration = factory.createTypeLiteralNode(
    models.flatMap((model) => {
      const comment = generateQueryTypeComment(model, 'remove');

      const modelSyntaxIdentifier = factory.createIdentifier(
        convertToPascalCase(model.slug),
      );

      /**
       * @example
       * ```ts
       * user: ReducedFunction & Syntax.User.Singular.RootQueryCallerPromise & { ... };
       * ```
       */
      const singularProperty = factory.createPropertySignature(
        undefined,
        model.slug,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createQualifiedName(
                  identifiers.namespace.syntax.name,
                  modelSyntaxIdentifier,
                ),
                identifiers.namespace.syntax.singular,
              ),
              identifiers.namespace.utils.rootQueryCallerPromise,
            ),
          ),
          factory.createTypeLiteralNode(
            Object.entries({
              after: identifiers.namespace.utils.afterQueryPromise,
              before: identifiers.namespace.utils.beforeQueryPromise,
              including: identifiers.namespace.utils.includingQueryPromise,
              limitedTo: identifiers.namespace.utils.limitedToQueryPromise,
              orderedBy: identifiers.namespace.utils.orderedByQueryPromise,
              selecting: identifiers.namespace.utils.selectingQueryPromise,
              to: identifiers.namespace.utils.toQueryPromise,
              using: identifiers.namespace.utils.usingQueryPromise,
              with: identifiers.namespace.utils.withQueryPromise,
            }).map(([instruction, utilIdentifier]) =>
              factory.createPropertySignature(
                undefined,
                instruction,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createQualifiedName(
                      factory.createQualifiedName(
                        identifiers.namespace.syntax.name,
                        modelSyntaxIdentifier,
                      ),
                      identifiers.namespace.syntax.singular,
                    ),
                    utilIdentifier,
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

      /**
       * @example
       * ```ts
       * users: ReducedFunction & Syntax.User.Plural.RootQueryCallerPromise & { ... };
       * ```
       */
      const pluralProperty = factory.createPropertySignature(
        undefined,
        model.pluralSlug,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createQualifiedName(
                  identifiers.namespace.syntax.name,
                  modelSyntaxIdentifier,
                ),
                identifiers.namespace.syntax.plural,
              ),
              identifiers.namespace.utils.rootQueryCallerPromise,
            ),
          ),
          factory.createTypeLiteralNode(
            Object.entries({
              after: identifiers.namespace.utils.afterQueryPromise,
              before: identifiers.namespace.utils.beforeQueryPromise,
              including: identifiers.namespace.utils.includingQueryPromise,
              limitedTo: identifiers.namespace.utils.limitedToQueryPromise,
              orderedBy: identifiers.namespace.utils.orderedByQueryPromise,
              selecting: identifiers.namespace.utils.selectingQueryPromise,
              to: identifiers.namespace.utils.toQueryPromise,
              using: identifiers.namespace.utils.usingQueryPromise,
              with: identifiers.namespace.utils.withQueryPromise,
            }).map(([instruction, utilIdentifier]) =>
              factory.createPropertySignature(
                undefined,
                instruction,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createQualifiedName(
                      factory.createQualifiedName(
                        identifiers.namespace.syntax.name,
                        modelSyntaxIdentifier,
                      ),
                      identifiers.namespace.syntax.plural,
                    ),
                    utilIdentifier,
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

      return [
        addSyntheticLeadingComment(
          singularProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.singular,
          true,
        ),
        addSyntheticLeadingComment(
          pluralProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.plural,
          true,
        ),
      ];
    }),
  );
  moduleDeclarations.push(
    factory.createTypeAliasDeclaration(
      undefined,
      identifiers.namespace.syntax.removeQuery,
      undefined,
      removeQueryTypeDeclaration,
    ),
  );

  /**
   * @example
   * ```ts
   * type SetQuery = { ... };
   * ```
   */
  const setQueryTypeDeclaration = factory.createTypeLiteralNode(
    models.flatMap((model) => {
      const comment = generateQueryTypeComment(model, 'set');

      const modelSyntaxIdentifier = factory.createIdentifier(
        convertToPascalCase(model.slug),
      );

      /**
       * @example
       * ```ts
       * user: ReducedFunction & Syntax.User.Singular.RootQueryCallerPromise & { ... };
       * ```
       */
      const singularProperty = factory.createPropertySignature(
        undefined,
        model.slug,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createQualifiedName(
                  identifiers.namespace.syntax.name,
                  modelSyntaxIdentifier,
                ),
                identifiers.namespace.syntax.singular,
              ),
              identifiers.namespace.utils.rootQueryCallerPromise,
            ),
          ),
          factory.createTypeLiteralNode(
            Object.entries({
              after: identifiers.namespace.utils.afterQueryPromise,
              before: identifiers.namespace.utils.beforeQueryPromise,
              including: identifiers.namespace.utils.includingQueryPromise,
              limitedTo: identifiers.namespace.utils.limitedToQueryPromise,
              orderedBy: identifiers.namespace.utils.orderedByQueryPromise,
              selecting: identifiers.namespace.utils.selectingQueryPromise,
              to: identifiers.namespace.utils.toQueryPromise,
              using: identifiers.namespace.utils.usingQueryPromise,
              with: identifiers.namespace.utils.withQueryPromise,
            }).map(([instruction, utilIdentifier]) =>
              factory.createPropertySignature(
                undefined,
                instruction,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createQualifiedName(
                      factory.createQualifiedName(
                        identifiers.namespace.syntax.name,
                        modelSyntaxIdentifier,
                      ),
                      identifiers.namespace.syntax.singular,
                    ),
                    utilIdentifier,
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

      /**
       * @example
       * ```ts
       * users: ReducedFunction & Syntax.User.Plural.RootQueryCallerPromise & { ... };
       * ```
       */
      const pluralProperty = factory.createPropertySignature(
        undefined,
        model.pluralSlug,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createExpressionWithTypeArguments(
            identifiers.blade.reducedFunction,
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createQualifiedName(
                  identifiers.namespace.syntax.name,
                  modelSyntaxIdentifier,
                ),
                identifiers.namespace.syntax.plural,
              ),
              identifiers.namespace.utils.rootQueryCallerPromise,
            ),
          ),
          factory.createTypeLiteralNode(
            Object.entries({
              after: identifiers.namespace.utils.afterQueryPromise,
              before: identifiers.namespace.utils.beforeQueryPromise,
              including: identifiers.namespace.utils.includingQueryPromise,
              limitedTo: identifiers.namespace.utils.limitedToQueryPromise,
              orderedBy: identifiers.namespace.utils.orderedByQueryPromise,
              selecting: identifiers.namespace.utils.selectingQueryPromise,
              to: identifiers.namespace.utils.toQueryPromise,
              using: identifiers.namespace.utils.usingQueryPromise,
              with: identifiers.namespace.utils.withQueryPromise,
            }).map(([instruction, utilIdentifier]) =>
              factory.createPropertySignature(
                undefined,
                instruction,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createQualifiedName(
                      factory.createQualifiedName(
                        identifiers.namespace.syntax.name,
                        modelSyntaxIdentifier,
                      ),
                      identifiers.namespace.syntax.plural,
                    ),
                    utilIdentifier,
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

      return [
        addSyntheticLeadingComment(
          singularProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.singular,
          true,
        ),
        addSyntheticLeadingComment(
          pluralProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.plural,
          true,
        ),
      ];
    }),
  );
  moduleDeclarations.push(
    factory.createTypeAliasDeclaration(
      undefined,
      identifiers.namespace.syntax.setQuery,
      undefined,
      setQueryTypeDeclaration,
    ),
  );

  for (const model of models) {
    const syntaxNamespaceIdentifier = factory.createIdentifier(
      convertToPascalCase(model.slug),
    );

    /**
     * @example
     * ```ts
     * type FieldSlug =
     *  | "id"
     *  | "ronin.createdAt"
     *  | "ronin.createdBy"
     *  | "ronin.updatedAt"
     *  | "ronin.updatedBy"
     *  | "name"
     *  | "email";
     * ```
     */
    const fieldSlugType = factory.createTypeAliasDeclaration(
      undefined,
      identifiers.namespace.syntax.fieldSlug,
      undefined,
      factory.createUnionTypeNode(
        [...DEFAULT_FIELD_SLUGS, ...Object.keys(model.fields)].map((slug) =>
          factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
        ),
      ),
    );

    const singularModelNode = factory.createUnionTypeNode([
      factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
      factory.createLiteralTypeNode(factory.createNull()),
    ]);
    const singularStatements = {
      after: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.afterQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.afterQuery,
          ),
          [singularModelNode],
        ),
      ),
      afterPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.afterQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.afterQueryPromise,
          ),
          [singularModelNode],
        ),
      ),
      before: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.beforeQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.beforeQuery,
          ),
          [singularModelNode],
        ),
      ),
      beforePromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.beforeQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.beforeQueryPromise,
          ),
          [singularModelNode],
        ),
      ),
      including: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.includingQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.includingQuery,
          ),
          [singularModelNode],
        ),
      ),
      includingPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.includingQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.includingQueryPromise,
          ),
          [singularModelNode],
        ),
      ),
      limitedTo: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.limitedToQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.limitedToQuery,
          ),
          [singularModelNode],
        ),
      ),
      limitedToPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.limitedToQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.limitedToQueryPromise,
          ),
          [singularModelNode],
        ),
      ),
      orderedBy: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.orderedByQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.orderedByQuery,
          ),
          [
            singularModelNode,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                syntaxNamespaceIdentifier,
                identifiers.namespace.syntax.fieldSlug,
              ),
            ),
          ],
        ),
      ),
      orderedByPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.orderedByQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.orderedByQueryPromise,
          ),
          [
            singularModelNode,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                syntaxNamespaceIdentifier,
                identifiers.namespace.syntax.fieldSlug,
              ),
            ),
          ],
        ),
      ),
      rootQueryCaller: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.rootQueryCaller,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.rootQueryCaller,
          ),
          [singularModelNode],
        ),
      ),
      rootQueryCallerPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.rootQueryCallerPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.rootQueryCallerPromise,
          ),
          [singularModelNode],
        ),
      ),
      selecting: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.selectingQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.selectingQuery,
          ),
          [
            singularModelNode,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                syntaxNamespaceIdentifier,
                identifiers.namespace.syntax.fieldSlug,
              ),
            ),
          ],
        ),
      ),
      selectingPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.selectingQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.selectingQueryPromise,
          ),
          [
            singularModelNode,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                syntaxNamespaceIdentifier,
                identifiers.namespace.syntax.fieldSlug,
              ),
            ),
          ],
        ),
      ),
      to: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.toQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.toQuery,
          ),
          [singularModelNode, factory.createTypeReferenceNode(syntaxNamespaceIdentifier)],
        ),
      ),
      toPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.toQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.toQueryPromise,
          ),
          [singularModelNode, factory.createTypeReferenceNode(syntaxNamespaceIdentifier)],
        ),
      ),
      using: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.usingQuery,
        undefined,
        generateUsingSyntax(model, singularModelNode, false, false),
      ),
      usingPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.usingQueryPromise,
        undefined,
        generateUsingSyntax(model, singularModelNode, true, false),
      ),
      with: generateWithSyntax(model, singularModelNode, false),
      withPromise: generateWithSyntax(model, singularModelNode, true),
    } satisfies Record<string, TypeAliasDeclaration>;

    const pluralModelNode = factory.createTypeReferenceNode(
      convertToPascalCase(model.pluralSlug),
    );
    const pluralStatements = {
      after: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.afterQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.afterQuery,
          ),
          [pluralModelNode],
        ),
      ),
      afterPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.afterQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.afterQueryPromise,
          ),
          [pluralModelNode],
        ),
      ),
      before: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.beforeQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.beforeQuery,
          ),
          [pluralModelNode],
        ),
      ),
      beforePromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.beforeQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.beforeQueryPromise,
          ),
          [pluralModelNode],
        ),
      ),
      including: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.includingQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.includingQuery,
          ),
          [pluralModelNode],
        ),
      ),
      includingPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.includingQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.includingQueryPromise,
          ),
          [pluralModelNode],
        ),
      ),
      limitedTo: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.limitedToQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.limitedToQuery,
          ),
          [pluralModelNode],
        ),
      ),
      limitedToPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.limitedToQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.limitedToQueryPromise,
          ),
          [pluralModelNode],
        ),
      ),
      orderedBy: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.orderedByQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.orderedByQuery,
          ),
          [
            pluralModelNode,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                syntaxNamespaceIdentifier,
                identifiers.namespace.syntax.fieldSlug,
              ),
            ),
          ],
        ),
      ),
      orderedByPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.orderedByQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.orderedByQueryPromise,
          ),
          [
            pluralModelNode,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                syntaxNamespaceIdentifier,
                identifiers.namespace.syntax.fieldSlug,
              ),
            ),
          ],
        ),
      ),
      rootQueryCaller: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.rootQueryCaller,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.rootQueryCaller,
          ),
          [pluralModelNode],
        ),
      ),
      rootQueryCallerPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.rootQueryCallerPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.rootQueryCallerPromise,
          ),
          [pluralModelNode],
        ),
      ),
      selecting: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.selectingQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.selectingQuery,
          ),
          [
            pluralModelNode,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                syntaxNamespaceIdentifier,
                identifiers.namespace.syntax.fieldSlug,
              ),
            ),
          ],
        ),
      ),
      selectingPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.selectingQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.selectingQueryPromise,
          ),
          [
            pluralModelNode,
            factory.createTypeReferenceNode(
              factory.createQualifiedName(
                syntaxNamespaceIdentifier,
                identifiers.namespace.syntax.fieldSlug,
              ),
            ),
          ],
        ),
      ),
      to: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.toQuery,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.toQuery,
          ),
          [pluralModelNode, factory.createTypeReferenceNode(syntaxNamespaceIdentifier)],
        ),
      ),
      toPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.toQueryPromise,
        undefined,
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            identifiers.namespace.utils.name,
            identifiers.namespace.utils.toQueryPromise,
          ),
          [pluralModelNode, factory.createTypeReferenceNode(syntaxNamespaceIdentifier)],
        ),
      ),
      using: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.usingQuery,
        undefined,
        generateUsingSyntax(model, pluralModelNode, false, true),
      ),
      usingPromise: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.usingQueryPromise,
        undefined,
        generateUsingSyntax(model, pluralModelNode, true, true),
      ),
      with: generateWithSyntax(model, pluralModelNode, false),
      withPromise: generateWithSyntax(model, pluralModelNode, true),
    } satisfies Record<string, TypeAliasDeclaration>;

    const moduleDeclaration = factory.createModuleDeclaration(
      undefined,
      syntaxNamespaceIdentifier,
      factory.createModuleBlock([
        fieldSlugType,
        factory.createModuleDeclaration(
          undefined,
          identifiers.namespace.syntax.singular,
          factory.createModuleBlock([
            singularStatements.after,
            singularStatements.afterPromise,
            singularStatements.before,
            singularStatements.beforePromise,
            singularStatements.including,
            singularStatements.includingPromise,
            singularStatements.limitedTo,
            singularStatements.limitedToPromise,
            singularStatements.orderedBy,
            singularStatements.orderedByPromise,
            singularStatements.rootQueryCaller,
            singularStatements.rootQueryCallerPromise,
            singularStatements.selecting,
            singularStatements.selectingPromise,
            singularStatements.to,
            singularStatements.toPromise,
            singularStatements.using,
            singularStatements.usingPromise,
            singularStatements.with,
            singularStatements.withPromise,
          ]),
          NodeFlags.Namespace,
        ),
        factory.createModuleDeclaration(
          undefined,
          identifiers.namespace.syntax.plural,
          factory.createModuleBlock([
            pluralStatements.after,
            pluralStatements.afterPromise,
            pluralStatements.before,
            pluralStatements.beforePromise,
            pluralStatements.including,
            pluralStatements.includingPromise,
            pluralStatements.limitedTo,
            pluralStatements.limitedToPromise,
            pluralStatements.orderedBy,
            pluralStatements.orderedByPromise,
            pluralStatements.rootQueryCaller,
            pluralStatements.rootQueryCallerPromise,
            pluralStatements.selecting,
            pluralStatements.selectingPromise,
            pluralStatements.to,
            pluralStatements.toPromise,
            pluralStatements.using,
            pluralStatements.usingPromise,
            pluralStatements.with,
            pluralStatements.withPromise,
          ]),
          NodeFlags.Namespace,
        ),
      ]),
      NodeFlags.Namespace,
    );

    moduleDeclarations.push(moduleDeclaration);
  }

  return moduleDeclarations;
};
