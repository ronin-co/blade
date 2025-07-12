import { DDL_QUERY_TYPES, DML_QUERY_TYPES } from '@ronin/compiler';
import { NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { genericIdentifiers, identifiers } from '@/src/constants/identifiers';
import { generateQueryTypeComment } from '@/src/generators/comment';
import { convertToPascalCase } from '@/src/utils/slug';

import type {
  InterfaceDeclaration,
  ModuleDeclaration,
  ParameterDeclaration,
  PropertySignature,
  Statement,
  TypeAliasDeclaration,
  TypeElement,
} from 'typescript';

import type { Model } from '@/src/types/model';

/**
 * Generate a module augmentation for the `ronin` module to override the
 * standard filter interfaces with ones that are correctly typed specific to
 * this space.
 *
 * @param models - An array of RONIN models to generate type definitions for.
 * @param schemas - An array of type declarations for the models.
 *
 * @returns A module augmentation declaration to be added to `index.d.ts`.
 */
export const generateModule = (
  models: Array<Model>,
  schemas: Array<InterfaceDeclaration | TypeAliasDeclaration>,
): ModuleDeclaration => {
  const moduleBodyStatements = new Array<Statement>();

  for (const schemaTypeDec of schemas) {
    moduleBodyStatements.push(schemaTypeDec);
  }

  const mappedQueryTypeVariableDeclarations = DML_QUERY_TYPES.map((queryType) => {
    const declarationProperties = new Array<TypeElement>();

    for (const model of models) {
      const comment = generateQueryTypeComment(model, queryType);
      const singularModelIdentifier = factory.createTypeReferenceNode(
        convertToPascalCase(model.slug),
      );
      const pluralSchemaIdentifier = factory.createTypeReferenceNode(
        convertToPascalCase(model.pluralSlug),
      );

      /**
       * ```ts
       * GetQuery[keyof GetQuery]
       * ```
       */
      const queryTypeValue = factory.createIndexedAccessTypeNode(
        factory.createTypeReferenceNode(
          identifiers.compiler.dmlQueryType[queryType],
          undefined,
        ),
        factory.createTypeOperatorNode(
          SyntaxKind.KeyOfKeyword,
          factory.createTypeReferenceNode(identifiers.compiler.dmlQueryType[queryType]),
        ),
      );

      /**
       * ```ts
       * account: DeepCallable<GetQuery[keyof GetQuery], Account | null>;
       * ```
       */
      const singularProperty = factory.createPropertySignature(
        undefined,
        model.slug,
        undefined,
        factory.createTypeReferenceNode(identifiers.syntax.deepCallable, [
          queryTypeValue,
          factory.createUnionTypeNode(
            queryType === 'count'
              ? [factory.createKeywordTypeNode(SyntaxKind.NumberKeyword)]
              : [
                  singularModelIdentifier,
                  factory.createLiteralTypeNode(factory.createNull()),
                ],
          ),
        ]),
      );

      // There is no value in supporting `count` queries for singular
      // records, so we skip adding the comment for those.
      if (queryType !== 'count')
        declarationProperties.push(
          addSyntheticLeadingComment(
            singularProperty,
            SyntaxKind.MultiLineCommentTrivia,
            comment.singular,
            true,
          ),
        );

      // TODO(@nurodev): Remove once RONIN officially supports
      // creating multiple records at once.
      if (queryType === 'add') continue;

      /**
       * ```ts
       * accounts: DeepCallable<GetQuery[keyof GetQuery], Array<Account>>;
       * ```
       */
      const pluralProperty = factory.createPropertySignature(
        undefined,
        model.pluralSlug,
        undefined,
        factory.createTypeReferenceNode(identifiers.syntax.deepCallable, [
          queryTypeValue,
          queryType === 'count'
            ? factory.createKeywordTypeNode(SyntaxKind.NumberKeyword)
            : pluralSchemaIdentifier,
        ]),
      );
      declarationProperties.push(
        addSyntheticLeadingComment(
          pluralProperty,
          SyntaxKind.MultiLineCommentTrivia,
          comment.plural,
          true,
        ),
      );
    }

    return {
      properties: declarationProperties,
      queryType,
    };
  });

  /**
   * ```ts
   * declare const add: { ... };
   * declare const count: { ... };
   * declare const get: { ... };
   * declare const remove: { ... };
   * declare const set: { ... };
   * ```
   */
  for (const { properties, queryType } of mappedQueryTypeVariableDeclarations) {
    const queryDeclaration = factory.createVariableStatement(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            queryType,
            undefined,
            factory.createTypeLiteralNode(properties),
          ),
        ],
        NodeFlags.Const,
      ),
    );

    moduleBodyStatements.push(queryDeclaration);
  }

  /**
   * ```ts
   * T extends [Promise, ...Array<Promise>] | Array<Promise>
   * ```
   */
  const batchQueryTypeArguments = factory.createTypeParameterDeclaration(
    undefined,
    genericIdentifiers.queries,
    factory.createUnionTypeNode([
      factory.createTupleTypeNode([
        factory.createTypeReferenceNode(identifiers.primitive.promise),
        factory.createRestTypeNode(
          factory.createTypeReferenceNode(identifiers.primitive.array, [
            factory.createTypeReferenceNode(identifiers.primitive.promise),
          ]),
        ),
      ]),

      factory.createTypeReferenceNode(identifiers.primitive.array, [
        factory.createTypeReferenceNode(identifiers.primitive.promise),
      ]),
    ]),
  );

  const batchQueryParametersDeclaration = new Array<ParameterDeclaration>();

  /**
   * ```ts
   * operations: () => T
   * ```
   */
  batchQueryParametersDeclaration.push(
    factory.createParameterDeclaration(
      undefined,
      undefined,
      'operations',
      undefined,
      factory.createFunctionTypeNode(
        undefined,
        [],
        factory.createTypeReferenceNode(genericIdentifiers.queries),
      ),
    ),
  );

  /**
   * ```ts
   * queryOptions?: Record<string, unknown>
   * ```
   */
  batchQueryParametersDeclaration.push(
    factory.createParameterDeclaration(
      undefined,
      undefined,
      'queryOptions',
      factory.createToken(SyntaxKind.QuestionToken),
      factory.createTypeReferenceNode(identifiers.primitive.record, [
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
      ]),
    ),
  );

  /**
   * ```ts
   * declare const batch: <...>(...) => Promise<PromiseTuple<T>>;
   * ```
   */
  const batchQueryDeclaration = factory.createVariableStatement(
    [factory.createModifier(SyntaxKind.DeclareKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          'batch',
          undefined,
          factory.createFunctionTypeNode(
            [batchQueryTypeArguments],
            batchQueryParametersDeclaration,
            factory.createTypeReferenceNode(identifiers.primitive.promise, [
              factory.createTypeReferenceNode(identifiers.ronin.promiseTuple, [
                factory.createTypeReferenceNode(genericIdentifiers.queries),
              ]),
            ]),
          ),
        ),
      ],
      NodeFlags.Const,
    ),
  );
  moduleBodyStatements.push(batchQueryDeclaration);

  /**
   * ```ts
   * models: DeepCallable<ListQuery[keyof ListQuery], Array<Model>>;
   * ```
   */
  const listModelsQueryPropertyDeclaration = addSyntheticLeadingComment(
    factory.createPropertySignature(
      undefined,
      'models',
      undefined,
      factory.createTypeReferenceNode(identifiers.syntax.deepCallable, [
        factory.createIndexedAccessTypeNode(
          factory.createTypeReferenceNode(
            identifiers.compiler.ddlQueryType.list,
            undefined,
          ),
          factory.createTypeOperatorNode(
            SyntaxKind.KeyOfKeyword,
            factory.createTypeReferenceNode(identifiers.compiler.ddlQueryType.list),
          ),
        ),
        factory.createTypeReferenceNode(identifiers.primitive.array, [
          factory.createTypeReferenceNode(identifiers.compiler.model),
        ]),
      ]),
    ),
    SyntaxKind.MultiLineCommentTrivia,
    ' List all model definitions ',
    true,
  );

  /**
   * ```ts
   * declare const list: { ... };
   * ```
   */
  const listModelsQueryDeclaration = factory.createVariableStatement(
    [factory.createModifier(SyntaxKind.DeclareKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          'list',
          undefined,
          factory.createTypeLiteralNode([listModelsQueryPropertyDeclaration]),
        ),
      ],
      NodeFlags.Const,
    ),
  );

  moduleBodyStatements.push(listModelsQueryDeclaration);

  // Note: `csf` prefix stands for `createSyntaxFactory`.

  /**
   * ```ts
   * (options: QueryHandlerOptions | (() => QueryHandlerOptions))
   * ```
   */
  const csfParameterTypeDec = factory.createParameterDeclaration(
    undefined,
    undefined,
    'options',
    undefined,
    factory.createUnionTypeNode([
      factory.createTypeReferenceNode(identifiers.ronin.queryHandlerOptions),
      factory.createFunctionTypeNode(
        undefined,
        [],
        factory.createTypeReferenceNode(identifiers.ronin.queryHandlerOptions),
      ),
    ]),
  );

  const csfReturnTypePropertySignatures = new Array<PropertySignature>();

  /**
   * ```ts
   * (...) => {
   *  add: typeof add,
   *  count: typeof count,
   *  get: typeof get,
   *  remove: typeof remove,
   *  set: typeof set,
   *  list: typeof list,
   * }
   * ```
   */
  for (const queryType of [...DML_QUERY_TYPES, 'list']) {
    csfReturnTypePropertySignatures.push(
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier(queryType),
        undefined,
        factory.createTypeQueryNode(factory.createIdentifier(queryType)),
      ),
    );
  }

  /**
   * ```ts
   * (...) => {
   *  create: typeof import('ronin').create,
   *  alter: typeof import('ronin').alter,
   *  drop: typeof import('ronin').drop,
   *  batch: typeof import('ronin').batch,
   *  sql: typeof import('ronin').sql,
   *  sqlBatch: typeof import('ronin').sqlBatch,
   * }
   * ```
   */
  for (const queryType of [
    ...DDL_QUERY_TYPES.filter((v) => v !== 'list'),
    'batch',
    'sql',
    'sqlBatch',
  ]) {
    csfReturnTypePropertySignatures.push(
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier(queryType),
        undefined,
        factory.createTypeQueryNode(
          factory.createQualifiedName(
            // Currently this is the only viable option I have found to implement a
            // format of `import('ronin').xyz` node in the TSC API.
            // But with this the TSC API marks these properties as not compatible,
            // but pragmatically they work fine.
            // @ts-expect-error
            factory.createImportTypeNode(
              factory.createTypeReferenceNode(identifiers.ronin.module.root),
            ),
            factory.createIdentifier(queryType),
          ),
        ),
      ),
    );
  }

  const csfReturnTypeDec = factory.createTypeLiteralNode(csfReturnTypePropertySignatures);

  moduleBodyStatements.push(
    /**
     * ```ts
     * declare const createSyntaxFactory: (
     *  options: QueryHandlerOptions | (() => QueryHandlerOptions)
     * ) => { ... }
     * ```
     */
    factory.createVariableStatement(
      [factory.createModifier(SyntaxKind.DeclareKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            identifiers.ronin.createSyntaxFactory,
            undefined,
            factory.createFunctionTypeNode(
              undefined,
              [csfParameterTypeDec],
              csfReturnTypeDec,
            ),
          ),
        ],
        NodeFlags.Const,
      ),
    ),

    /**
     * ```ts
     * export default function (
     *  options: QueryHandlerOptions | (() => QueryHandlerOptions)
     * ) => { ... }
     * ```
     */
    factory.createFunctionDeclaration(
      [
        factory.createModifier(SyntaxKind.ExportKeyword),
        factory.createModifier(SyntaxKind.DefaultKeyword),
      ],
      undefined,
      undefined,
      undefined,
      [csfParameterTypeDec],
      csfReturnTypeDec,
      undefined,
    ),
  );

  return factory.createModuleDeclaration(
    [factory.createModifier(SyntaxKind.DeclareKeyword)],
    identifiers.ronin.module.root,
    factory.createModuleBlock(moduleBodyStatements),
  );
};
