import { factory } from 'typescript';

import type { Identifier } from 'typescript';

/**
 * An identifier is the name of any type, interface, namespace, function, variable, etc.
 *
 * This can include any native utility types offered by TypeScript like `Partial`, `Record`, etc.
 *
 * Here we simply store a list of all identifiers used in the code generation package.
 */
export const identifiers = {
  blade: {
    module: {
      client: {
        hooks: factory.createIdentifier(JSON.stringify('blade/client/hooks')),
      },
      root: factory.createIdentifier(JSON.stringify('blade')),
      server: {
        hooks: factory.createIdentifier(JSON.stringify('blade/server/hooks')),
      },
      types: factory.createIdentifier(JSON.stringify('blade/types')),
    },
    reducedFunction: factory.createIdentifier('ReducedFunction'),
    resultRecord: factory.createIdentifier('ResultRecord'),
  },
  compiler: {
    combinedInstructions: factory.createIdentifier('CombinedInstructions'),
    dmlQueryType: {
      add: factory.createIdentifier('AddQuery'),
      count: factory.createIdentifier('CountQuery'),
      get: factory.createIdentifier('GetQuery'),
      remove: factory.createIdentifier('RemoveQuery'),
      set: factory.createIdentifier('SetQuery'),
      use: factory.createIdentifier('GetQuery'),
    },
    expression: factory.createIdentifier('Expression'),
    model: factory.createIdentifier('Model'),
    module: {
      root: factory.createIdentifier(JSON.stringify('blade-compiler')),
    },
    storedObject: factory.createIdentifier('StoredObject'),
  },
  primitive: {
    array: factory.createIdentifier('Array'),
    date: factory.createIdentifier('Date'),
    partial: factory.createIdentifier('Partial'),
    promise: factory.createIdentifier('Promise'),
    record: factory.createIdentifier('Record'),
  },
  syntax: {
    fieldSlug: factory.createIdentifier('FieldSlug'),
    orderedByQuery: factory.createIdentifier('OrderedByQuery'),
    orderedByQueryPromise: factory.createIdentifier('OrderedByQueryPromise'),
    plural: factory.createIdentifier('Plural'),
    rootCaller: factory.createIdentifier('RootCaller'),
    rootCallerPromise: factory.createIdentifier('RootCallerPromise'),
    singular: factory.createIdentifier('Singular'),
    withQuery: factory.createIdentifier('WithQuery'),
    withQueryPromise: factory.createIdentifier('WithQueryPromise'),
  },
  utils: {
    all: factory.createIdentifier('all'),
    jsonArray: factory.createIdentifier('JsonArray'),
    jsonObject: factory.createIdentifier('JsonObject'),
    jsonPrimitive: factory.createIdentifier('JsonPrimitive'),
    resolveSchema: factory.createIdentifier('ResolveSchema'),
  },
} satisfies Record<
  string,
  Record<string, Identifier | Record<string, Identifier | Record<string, Identifier>>>
>;

/**
 * A list of all generic names used in the `blade-codegen` package.
 *
 * Similar to `identifiers` but designed specifically for use as generic names.
 */
export const typeArgumentIdentifiers = {
  default: factory.createIdentifier('T'),
  fields: factory.createIdentifier('F'),
  key: factory.createIdentifier('K'),
  queries: factory.createIdentifier('Q'),
  schema: factory.createIdentifier('S'),
  using: factory.createIdentifier('U'),
} satisfies Record<string, Identifier>;
