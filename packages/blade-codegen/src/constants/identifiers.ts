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
      root: factory.createIdentifier(JSON.stringify('blade')),
      server: {
        hooks: factory.createIdentifier(JSON.stringify('blade/server/hooks')),
      },
      types: factory.createIdentifier(JSON.stringify('blade/types')),
    },
  },
  compiler: {
    combinedInstructions: factory.createIdentifier('CombinedInstructions'),
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
  },
  syntax: {
    module: {
      queries: factory.createIdentifier(JSON.stringify('blade-syntax/queries')),
    },
    reducedFunction: factory.createIdentifier('ReducedFunction'),
    resultRecord: factory.createIdentifier('ResultRecord'),
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
  key: factory.createIdentifier('K'),
  queries: factory.createIdentifier('Q'),
  schema: factory.createIdentifier('S'),
  using: factory.createIdentifier('U'),
} satisfies Record<string, Identifier>;
