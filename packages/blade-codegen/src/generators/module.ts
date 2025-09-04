import { NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { generateQueryTypeComment } from '@/src/generators/comment';
import { convertToPascalCase } from '@/src/utils/slug';

import { identifiers } from '@/src/constants/identifiers';
import type { Model } from '@/src/types/model';
import type { DML_QUERY_TYPES } from 'blade-compiler';
import type { VariableStatement } from 'typescript';

/**
 * Generate a `declare const` statement for a provided query type using a list
 * of provided models.
 *
 * @example
 * ```ts
 * declare const use: {
 *    // Get a single user record
 *    user: UserSyntax<User | null>;
 *    // Get multiple user records
 *    users: UserSyntax<Users>;
 * };
 * ```
 *
 * @param models - An array of RONIN models to generate query declarations for.
 * @param queryType - The type of query to generate (e.g. 'use').
 *
 * @returns A variable statement for the generated query declarations.
 */
export const generateQueryDeclarationStatements = (
  models: Array<Model>,
  queryType: (typeof DML_QUERY_TYPES)[number] | 'use',
): VariableStatement => {
  const members = models.flatMap((model) => {
    const comment = generateQueryTypeComment(model, queryType);

    const syntaxTypeIdentifier = factory.createIdentifier(
      `${convertToPascalCase(model.slug)}Syntax`,
    );

    /**
     * ```ts
     * GetQuery[keyof GetQuery]
     * ```
     */
    const combinedInstructionsTypes = factory.createIndexedAccessTypeNode(
      factory.createTypeReferenceNode(
        identifiers.compiler.dmlQueryType[queryType],
        undefined,
      ),
      factory.createTypeOperatorNode(
        SyntaxKind.KeyOfKeyword,
        factory.createTypeReferenceNode(identifiers.compiler.dmlQueryType[queryType]),
      ),
    );

    const singularModelProperty = factory.createPropertySignature(
      undefined,
      model.slug,
      undefined,
      factory.createTypeReferenceNode(syntaxTypeIdentifier, [
        factory.createUnionTypeNode([
          factory.createTypeReferenceNode(convertToPascalCase(model.slug)),
          factory.createLiteralTypeNode(factory.createNull()),
        ]),
        combinedInstructionsTypes,
      ]),
    );

    const pluralModelProperty = factory.createPropertySignature(
      undefined,
      model.pluralSlug,
      undefined,
      factory.createTypeReferenceNode(syntaxTypeIdentifier, [
        factory.createTypeReferenceNode(convertToPascalCase(model.pluralSlug)),
        combinedInstructionsTypes,
      ]),
    );

    return [
      addSyntheticLeadingComment(
        singularModelProperty,
        SyntaxKind.MultiLineCommentTrivia,
        comment.singular,
        true,
      ),
      addSyntheticLeadingComment(
        pluralModelProperty,
        SyntaxKind.MultiLineCommentTrivia,
        comment.plural,
        true,
      ),
    ];
  });

  return factory.createVariableStatement(
    [factory.createModifier(SyntaxKind.DeclareKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          queryType,
          undefined,
          factory.createTypeLiteralNode(members),
        ),
      ],
      NodeFlags.Const,
    ),
  );
};
