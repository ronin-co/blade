import { NodeFlags, SyntaxKind, factory } from 'typescript';

import { identifiers, typeArgumentIdentifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { convertToPascalCase } from '@/src/utils/slug';

import type { TypeAliasDeclaration } from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * @todo Add documentation
 */
export const generateNamespaces = (models: Array<Model>) =>
  models.map((model) => {
    const syntaxNamespaceIdentifier = factory.createIdentifier(
      `${convertToPascalCase(model.slug)}${identifiers.namespace.syntax.suffix.text}`,
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
      rootCallerQuery: factory.createTypeAliasDeclaration(
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
      // TODO(@nurodev): Add `to` support
      // TODO(@nurodev): Add `using` support
      with: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.withQuery,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              identifiers.namespace.utils.name,
              identifiers.namespace.utils.withQuery,
            ),
            [singularModelNode],
          ),
          factory.createTypeLiteralNode(
            Object.keys(model.fields).map((slug) =>
              factory.createPropertySignature(
                undefined,
                slug,
                undefined,
                factory.createFunctionTypeNode(
                  [
                    factory.createTypeParameterDeclaration(
                      undefined,
                      typeArgumentIdentifiers.default,
                      undefined,
                      singularModelNode,
                    ),
                  ],
                  [
                    factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      slug,
                      undefined,
                      factory.createIndexedAccessTypeNode(
                        factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
                        factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
                      ),
                    ),
                  ],
                  factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
                ),
              ),
            ),
          ),
        ]),
      ),
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
      rootCallerQuery: factory.createTypeAliasDeclaration(
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
      // TODO(@nurodev): Add `to` support
      // TODO(@nurodev): Add `using` support
      with: factory.createTypeAliasDeclaration(
        undefined,
        identifiers.namespace.utils.withQuery,
        undefined,
        factory.createIntersectionTypeNode([
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              identifiers.namespace.utils.name,
              identifiers.namespace.utils.withQuery,
            ),
            [pluralModelNode],
          ),
          factory.createTypeLiteralNode(
            Object.keys(model.fields).map((slug) =>
              factory.createPropertySignature(
                undefined,
                slug,
                undefined,
                factory.createFunctionTypeNode(
                  [
                    factory.createTypeParameterDeclaration(
                      undefined,
                      typeArgumentIdentifiers.default,
                      undefined,
                      pluralModelNode,
                    ),
                  ],
                  [
                    factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      slug,
                      undefined,
                      factory.createIndexedAccessTypeNode(
                        factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
                        factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
                      ),
                    ),
                  ],
                  factory.createTypeReferenceNode(typeArgumentIdentifiers.default),
                ),
              ),
            ),
          ),
        ]),
      ),
    } satisfies Record<string, TypeAliasDeclaration>;

    return factory.createModuleDeclaration(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      syntaxNamespaceIdentifier,
      factory.createModuleBlock([
        fieldSlugType,
        factory.createModuleDeclaration(
          undefined,
          identifiers.namespace.syntax.singular,
          factory.createModuleBlock([
            singularStatements.after,
            singularStatements.before,
            singularStatements.including,
            singularStatements.limitedTo,
            singularStatements.orderedBy,
            singularStatements.rootCallerQuery,
            singularStatements.selecting,
            singularStatements.with,
          ]),
          NodeFlags.Namespace,
        ),
        factory.createModuleDeclaration(
          undefined,
          identifiers.namespace.syntax.plural,
          factory.createModuleBlock([
            pluralStatements.after,
            pluralStatements.before,
            pluralStatements.including,
            pluralStatements.limitedTo,
            pluralStatements.orderedBy,
            pluralStatements.rootCallerQuery,
            pluralStatements.selecting,
            pluralStatements.with,
          ]),
          NodeFlags.Namespace,
        ),
      ]),
      NodeFlags.Namespace,
    );
  });
