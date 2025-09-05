import { SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { identifiers } from '@/src/constants/identifiers';
import { generateQueryTypeComment } from '@/src/generators/comment';
import { convertToPascalCase } from '@/src/utils/slug';

import type { PropertySignature } from 'typescript';

import type { Model } from '@/src/types/model';
import type { QueryType } from '@/src/types/query';

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
export const generateTypedQueryMembers = (
  models: Array<Model>,
  queryType: QueryType,
): Array<PropertySignature> =>
  models.flatMap((model) => {
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
