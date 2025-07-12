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
  compiler: {
    ddlQueryType: {
      list: factory.createIdentifier('ListQuery'),
    },
    dmlQueryType: {
      add: factory.createIdentifier('AddQuery'),
      count: factory.createIdentifier('CountQuery'),
      get: factory.createIdentifier('GetQuery'),
      remove: factory.createIdentifier('RemoveQuery'),
      set: factory.createIdentifier('SetQuery'),
    },
    model: factory.createIdentifier('Model'),
    module: {
      root: factory.createIdentifier(JSON.stringify('@ronin/compiler')),
    },
    storedObject: factory.createIdentifier('StoredObject'),
  },
  primitive: {
    array: factory.createIdentifier('Array'),
    date: factory.createIdentifier('Date'),
    promise: factory.createIdentifier('Promise'),
    record: factory.createIdentifier('Record'),
  },
  ronin: {
    createSyntaxFactory: factory.createIdentifier('createSyntaxFactory'),
    promiseTuple: factory.createIdentifier('PromiseTuple'),
    queryHandlerOptions: factory.createIdentifier('QueryHandlerOptions'),
    module: {
      root: factory.createIdentifier(JSON.stringify('ronin')),
      types: factory.createIdentifier(JSON.stringify('ronin/types')),
    },
  },
  syntax: {
    deepCallable: factory.createIdentifier('DeepCallable'),
    module: {
      queries: factory.createIdentifier(JSON.stringify('@ronin/syntax/queries')),
    },
    resultRecord: factory.createIdentifier('ResultRecord'),
  },
  utils: {
    all: factory.createIdentifier('all'),
    jsonArray: factory.createIdentifier('JsonArray'),
    jsonObject: factory.createIdentifier('JsonObject'),
    jsonPrimitive: factory.createIdentifier('JsonPrimitive'),
    resolveSchema: factory.createIdentifier('ResolveSchema'),
  },
} satisfies Record<string, Record<string, Identifier | Record<string, Identifier>>>;

/**
 * A list of all generic names used in the `@ronin/codegen` package.
 *
 * Similar to `identifiers` but designed specifically for use as generic names.
 */
export const genericIdentifiers = {
  key: factory.createIdentifier('TKey'),
  queries: factory.createIdentifier('TQueries'),
  schema: factory.createIdentifier('TSchema'),
  using: factory.createIdentifier('TUsing'),
} satisfies Record<string, Identifier>;
