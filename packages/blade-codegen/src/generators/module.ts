import { DDL_QUERY_TYPES, DML_QUERY_TYPES } from 'blade-compiler';
import { NodeFlags, SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { genericIdentifiers, identifiers } from '@/src/constants/identifiers';
import { DEFAULT_FIELD_SLUGS } from '@/src/constants/schema';
import { generateQueryTypeComment } from '@/src/generators/comment';
import { convertToPascalCase } from '@/src/utils/slug';

import type {
  ExportDeclaration,
  InterfaceDeclaration,
  ModuleDeclaration,
  ParameterDeclaration,
  PropertySignature,
  Statement,
  TypeAliasDeclaration,
  TypeElement,
  TypeNode,
  TypeReferenceNode,
  VariableStatement,
} from 'typescript';

import type { Model, ModelField } from '@/src/types/model';
import { mapRoninFieldToTypeNode } from '@/src/utils/types';

const INFERRED_COMBINED_INSTRUCTION_PROPERTIES = [
  'after',
  'before',
  'including',
  'limitedTo',
  'orderedBy',
  'selecting',

  // TODO(@nurodev): Move out & only include `using` if the model includes any link fields.
  'using',
] satisfies Array<string>;

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

/**
 * Generate an export declaration to export all model type definitions. This is primarily
 * used to re-export types under the `blade/types` export.
 *
 * @example
 * ```ts
 * export type { User, Users };
 * ```
 *
 * @param models - An array of RONIN models to generate type definitions for.
 *
 * @returns An export declaration for the generated type definitions.
 */
export const generateExportTypeModuleStatements = (
  models: Array<Model>,
): ExportDeclaration =>
  factory.createExportDeclaration(
    undefined,
    true,
    factory.createNamedExports(
      models.flatMap((model) => {
        const singularSlug = convertToPascalCase(model.slug);
        const pluralSlug = convertToPascalCase(model.pluralSlug);

        return [
          factory.createExportSpecifier(false, undefined, singularSlug),
          factory.createExportSpecifier(false, undefined, pluralSlug),
        ];
      }),
    ),
  );

/**
 * Generate a `declare const` statement for a provided query type using a list
 * of provided models.
 *
 * @example
 * ```ts
 * declare const use: {
 *    user: ReducedFunction & {
 *      <T = User>(options?: Partial<CombinedInstructions>): T | null;
 *      after: <T = User>(value: CombinedInstructions["after"]) => T | null;
 *      before: <T = User>(value: CombinedInstructions["before"]) => T | null;
 *      including: <T = User>(value: CombinedInstructions["including"]) => T | null;
 *      limitedTo: <T = User>(value: CombinedInstructions["limitedTo"]) => T | null;
 *      orderedBy: <T = User>(value: CombinedInstructions["orderedBy"]) => T | null;
 *      selecting: <T = User>(value: CombinedInstructions["selecting"]) => T | null;
 *      using: <T = User>(value: CombinedInstructions["using"]) => T | null;
 *      with: {
 *         <T = User>(options: CombinedInstructions["with"]): T | null;
 *         id: <T = User>(value: ResultRecord["id"]) => T | null;
 *         "ronin.createdAt": <T = User>(value: ResultRecord["ronin.createdAt"]) => T | null;
 *         "ronin.createdBy": <T = User>(value: ResultRecord["ronin.createdBy"]) => T | null;
 *         "ronin.locked": <T = User>(value: ResultRecord["ronin.locked"]) => T | null;
 *         "ronin.updatedAt": <T = User>(value: ResultRecord["ronin.updatedAt"]) => T | null;
 *         "ronin.updatedBy": <T = User>(value: ResultRecord["ronin.updatedBy"]) => T | null;
 *         name: <T = User>(value: string) => T | null;
 *         email: <T = User>(value: string) => T | null;
 *      };
 *    };
 *    users: ReducedFunction & {
 *      <T = Users>(options?: Partial<CombinedInstructions>): T;
 *      after: <T = Users>(value: CombinedInstructions["after"]) => T;
 *      before: <T = Users>(value: CombinedInstructions["before"]) => T;
 *      including: <T = Users>(value: CombinedInstructions["including"]) => T;
 *      limitedTo: <T = Users>(value: CombinedInstructions["limitedTo"]) => T;
 *      orderedBy: <T = Users>(value: CombinedInstructions["orderedBy"]) => T;
 *      selecting: <T = Users>(value: CombinedInstructions["selecting"]) => T;
 *      using: <T = Users>(value: CombinedInstructions["using"]) => T;
 *      with: {
 *         <T = Users>(options: CombinedInstructions["with"]): T;
 *         id: <T = Users>(value: ResultRecord["id"]) => T;
 *         "ronin.createdAt": <T = Users>(value: ResultRecord["ronin.createdAt"]) => T;
 *         "ronin.createdBy": <T = Users>(value: ResultRecord["ronin.createdBy"]) => T;
 *         "ronin.locked": <T = Users>(value: ResultRecord["ronin.locked"]) => T;
 *         "ronin.updatedAt": <T = Users>(value: ResultRecord["ronin.updatedAt"]) => T;
 *         "ronin.updatedBy": <T = Users>(value: ResultRecord["ronin.updatedBy"]) => T;
 *         name: <T = Users>(value: string) => T;
 *         email: <T = Users>(value: string) => T;
 *      };
 *    };
 * };
 * ```
 *
 * @param models - An array of RONIN models to generate query declarations for.
 * @param queryType - The type of query to generate (e.g. 'use').
 *
 * @returns A variable statement for the generated query declarations.
 */
export const generateQueryDeclarationStatement = (
  models: Array<Model>,
  queryType: (typeof DML_QUERY_TYPES)[number] | 'use',
): VariableStatement =>
  factory.createVariableStatement(
    [factory.createModifier(SyntaxKind.DeclareKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          queryType,
          undefined,
          factory.createTypeLiteralNode(
            models.flatMap((model) => {
              const comment = generateQueryTypeComment(model, queryType);

              return [
                addSyntheticLeadingComment(
                  generateSchemaProperty(model.slug, model.fields, models),
                  SyntaxKind.MultiLineCommentTrivia,
                  comment.singular,
                  true,
                ),
                addSyntheticLeadingComment(
                  generateSchemaProperty(model.pluralSlug, model.fields, models),
                  SyntaxKind.MultiLineCommentTrivia,
                  comment.plural,
                  true,
                ),
              ];
            }),
          ),
        ),
      ],
      NodeFlags.Const,
    ),
  );

/**
 * @todo(@nurodev): Add documentation
 */
const generateSchemaProperty = (
  modelSlug: string,
  modelFields: Model['fields'],
  models: Array<Model>,
) => {
  const modelIdentifier = factory.createTypeReferenceNode(convertToPascalCase(modelSlug));

  /**
   * ```ts
   * <T = Account>(options?: Partial<CombinedInstructions>): T | null;
   * ```
   */
  const rootInstructionHandler = generateRootInstructionHandler(
    modelIdentifier,
    factory.createUnionTypeNode([
      factory.createTypeReferenceNode(genericIdentifiers.default, undefined),
      factory.createLiteralTypeNode(factory.createNull()),
    ]),
  );

  /**
   * ```ts
   * after: <T = User>(value: CombinedInstructions['after']) => T | null;
   * before: <T = User>(value: CombinedInstructions['before'],) => T | null;
   * including: <T = User>(value: CombinedInstructions['including']) => T | null;
   * limitedTo: <T = User>(value: CombinedInstructions['limitedTo']) => T | null;
   * orderedBy: <T = User>(value: CombinedInstructions['orderedBy']) => T | null;
   * selecting: <T = User>(value: CombinedInstructions['selecting']) => T | null;
   * using: <T = User>(value: CombinedInstructions['using']) => T | null;
   * ```
   */
  const mappedCombinedInstructionProperties =
    INFERRED_COMBINED_INSTRUCTION_PROPERTIES.map((propertyName) =>
      factory.createPropertySignature(
        undefined,
        propertyName,
        undefined,
        factory.createFunctionTypeNode(
          [
            factory.createTypeParameterDeclaration(
              undefined,
              genericIdentifiers.default,
              undefined,
              modelIdentifier,
            ),
          ],
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              'value',
              undefined,
              factory.createIndexedAccessTypeNode(
                // TODO(@nurodev): Add `CombinedInstructions` to identifiers
                factory.createTypeReferenceNode('CombinedInstructions', undefined),
                factory.createLiteralTypeNode(factory.createStringLiteral(propertyName)),
              ),
              undefined,
            ),
          ],
          factory.createUnionTypeNode([
            factory.createTypeReferenceNode(genericIdentifiers.default, undefined),
            factory.createLiteralTypeNode(factory.createNull()),
          ]),
        ),
      ),
    );

  return factory.createPropertySignature(
    undefined,
    modelSlug,
    undefined,
    factory.createIntersectionTypeNode([
      factory.createExpressionWithTypeArguments(
        identifiers.utils.reducedFunction,
        undefined,
      ),
      factory.createTypeLiteralNode([
        rootInstructionHandler,
        ...mappedCombinedInstructionProperties,
        generateWithPropertySignature(
          modelIdentifier,
          modelFields,
          models,
          factory.createUnionTypeNode([
            factory.createTypeReferenceNode(genericIdentifiers.default, undefined),
            factory.createLiteralTypeNode(factory.createNull()),
          ]),
        ),
      ]),
    ]),
  );
};

/**
 * @todo(@nurodev): Add documentation
 */
const generateRootInstructionHandler = (
  modelIdentifier: TypeReferenceNode,
  returnTypeNode: TypeNode,
) =>
  factory.createCallSignature(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        genericIdentifiers.default,
        undefined,
        modelIdentifier,
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'options',
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(identifiers.primitive.partial, [
          factory.createTypeReferenceNode('CombinedInstructions', undefined),
        ]),
        undefined,
      ),
    ],
    returnTypeNode,
  );

/**
 * @todo(@nurodev): Add documentation
 */
const generateWithPropertySignature = (
  modelIdentifier: TypeReferenceNode,
  modelFields: Model['fields'],
  models: Array<Model>,
  returnTypeNode: TypeNode,
): PropertySignature => {
  /**
   * ```ts
   * <T = User>(options: CombinedInstructions["with"]): T | null;
   * ```
   */
  const rootInstructionHandler = factory.createCallSignature(
    [
      factory.createTypeParameterDeclaration(
        undefined,
        genericIdentifiers.default,
        undefined,
        modelIdentifier,
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        'options',
        undefined,
        factory.createIndexedAccessTypeNode(
          factory.createTypeReferenceNode('CombinedInstructions', undefined),
          factory.createLiteralTypeNode(factory.createStringLiteral('with')),
        ),
        undefined,
      ),
    ],
    returnTypeNode,
  );

  const members = new Array<TypeElement>(rootInstructionHandler);

  for (const slug of DEFAULT_FIELD_SLUGS) {
    const normalizedSlug = slug.includes('.') ? JSON.stringify(slug) : slug;

    members.push(
      factory.createPropertySignature(
        undefined,
        normalizedSlug,
        undefined,
        factory.createFunctionTypeNode(
          [
            factory.createTypeParameterDeclaration(
              undefined,
              genericIdentifiers.default,
              undefined,
              modelIdentifier,
            ),
          ],
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              'value',
              undefined,

              factory.createIndexedAccessTypeNode(
                factory.createTypeReferenceNode(
                  identifiers.syntax.resultRecord,
                  undefined,
                ),
                factory.createLiteralTypeNode(factory.createStringLiteral(slug)),
              ),
              undefined,
            ),
          ],
          returnTypeNode,
        ),
      ),
    );
  }

  for (const [slug, field] of Object.entries(modelFields)) {
    if (DEFAULT_FIELD_SLUGS.includes(slug)) continue;

    members.push(
      factory.createPropertySignature(
        undefined,
        slug,
        undefined,
        factory.createFunctionTypeNode(
          [
            factory.createTypeParameterDeclaration(
              undefined,
              genericIdentifiers.default,
              undefined,
              modelIdentifier,
            ),
          ],
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              'value',
              undefined,
              factory.createUnionTypeNode(
                mapRoninFieldToTypeNode(field as ModelField, models),
              ),
              undefined,
            ),
          ],
          returnTypeNode,
        ),
      ),
    );
  }

  return factory.createPropertySignature(
    undefined,
    'with',
    undefined,
    factory.createTypeLiteralNode(members),
  );
};
