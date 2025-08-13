import type { DeepCallable, ResultRecord } from '@/src/queries/types';
import { isPlainObject, mutateStructure, setProperty } from '@/src/utils';
import { QUERY_SYMBOLS, type Query } from 'blade-compiler';

/**
 * Utility type to convert a tuple of promises into a tuple of their resolved types.
 */
export type PromiseTuple<
  T extends [Promise<any>, ...Array<Promise<any>>] | Array<Promise<any>>,
> = {
  [P in keyof T]: Awaited<T[P]>;
};

/**
 * Utility type that represents a particular query and any options that should
 * be used when executing it.
 */
export interface SyntaxItem<Structure = unknown> {
  structure: Structure;
  options?: Record<string, unknown>;
}

/**
 * A utility function that creates a proxy object to handle dynamic property access and
 * function calls, which is used to compose the query and schema syntax.
 *
 * @param config - An object containing configuration for the composed structure.
 *
 * @returns A proxy object that intercepts property access and function calls.
 *
 * ### Usage
 * ```typescript
 * const getProxy = getSyntaxProxy<GetQuery>({
 *   root: `${QUERY_SYMBOLS.QUERY}.get`,
 *   // Execute the query and return the result
 *   callback: async (query) => {}
 * });
 *
 * const result = await get.account();
 *
 * const result = await get.account.with.email('mike@gmail.com');
 * ```
 */
export const getSyntaxProxy = <Structure, ReturnValue = ResultRecord>(config?: {
  root?: string;
  callback?: (query: Query, options?: Record<string, unknown>) => Promise<any> | any;
  replacer?: (value: unknown) => unknown | undefined;
  propertyValue?: unknown;
  modelType?: boolean;
  chaining?: boolean;
}): DeepCallable<Structure, ReturnValue> => {
  // The default value of a property within the composed structure.
  const propertyValue =
    typeof config?.propertyValue === 'undefined' ? {} : config.propertyValue;

  const shouldAllowChaining = config?.chaining ?? true;

  const createProxy = (
    path: Array<string> = [],
    targetProps?: object,
    assign?: boolean,
  ): DeepCallable<Structure, ReturnValue> => {
    let target: object | (() => void);

    if (assign) {
      target = { ...targetProps };
    } else {
      target = () => undefined;

      // This is workaround to avoid "uncalled functions" in the test coverage report.
      // Test coverage tools fail to recognize that the function is called when it's
      // called via a `Proxy`.
      (target as () => void)();

      // @ts-expect-error Deleting this property is required for fields called `name`.
      delete target.name;
    }

    return new Proxy(target, {
      apply(_: unknown, __: unknown, args: Array<any>) {
        let value = args[0];
        const options = args[1];

        if (typeof value === 'undefined') {
          value = propertyValue;
        } else {
          const shouldUseParentSymbols = Boolean(globalThis.IN_RONIN_QUERY);
          value = mutateStructure(value, (inner) => {
            const serialized = serializeValue(inner, config?.replacer);
            if (shouldUseParentSymbols && typeof serialized === 'string') {
              return serialized.replaceAll(
                QUERY_SYMBOLS.FIELD,
                QUERY_SYMBOLS.FIELD_PARENT,
              );
            }
            return serialized;
          });
        }

        // If the function call is happening after an existing function call in the
        // same query, the existing query will be available as `target.structure`, and
        // we should extend it. If none is available, we should create a new query.
        const structure = { ...targetProps };

        const pathParts = config?.root ? [config.root, ...path] : path;
        const pathJoined = pathParts.length > 0 ? pathParts.join('.') : '.';

        setProperty(structure, pathJoined, value);

        // If the function call is happening inside a batch, return a new proxy, to
        // allow for continuing to chain `get` accessors and function calls after
        // existing function calls in the same query.
        if (globalThis.IN_RONIN_BATCH || !config?.callback) {
          // To ensure that `get` accessor calls are mounted to the same level as
          // the function after which they are called, we need to remove the last
          // path segment.
          const newPath = path.slice(0, -1);
          const details: { options?: unknown } = { ...structure };

          // Only add options if any are available, to avoid adding a property that
          // holds an `undefined` value.
          if (options) details.options = options;

          return shouldAllowChaining ? createProxy(newPath, details, true) : details;
        }

        return config.callback(structure, options);
      },

      get(target: any, nextProp: string, receiver: any): any {
        // If the target object of the proxy has a static property that matches the
        // provided property name, return its value.
        if (Object.hasOwn(target, nextProp)) {
          return Reflect.get(target, nextProp, receiver);
        }

        // Allow for serializing the current target structure.
        if (nextProp === 'toJSON') return targetProps;

        // If the target object does not have a matching static property, return a
        // new proxy, to allow for chaining `get` accessors.
        return createProxy(path.concat([nextProp]), targetProps);
      },
    });
  };

  return createProxy();
};

/**
 * Obtains a list of queries from a function by wrapping the queries into a context.
 *
 * @param operations - A function that contains multiple query functions.
 *
 * @returns A list of queries and their respective options.
 *
 * ### Usage
 * ```typescript
 * const queries = getBatchProxy(() => [
 *   get.accounts(),
 *   get.account.with.email('mike@gmail.com')
 * ]);
 * ```
 */
export const getBatchProxy = (
  operations: () => Array<SyntaxItem<Query> | Promise<any>>,
): Array<SyntaxItem<Query>> => {
  let queries: Array<SyntaxItem<Query> | Promise<any>> = [];

  globalThis.IN_RONIN_BATCH = true;

  try {
    queries = operations();
  } finally {
    // Always restore the original value of `IN_RONIN_BATCH`, even if `operations()`
    // throws. This is essential, otherwise `IN_RONIN_BATCH` might stay outdated.
    globalThis.IN_RONIN_BATCH = false;
  }

  // Within a batch, every query item is a JavaScript `Proxy`, in order to allow for
  // function chaining within every query. Returning the query items directly would
  // therefore return the respective `Proxy` instances, which wouldn't be logged as plain
  // objects, thereby making development more difficult. To avoid this, we are creating a
  // plain object containing the same properties as the `Proxy` instances.
  return queries.map((details) => {
    // If a placeholder value such as `null` is located inside the batch, we need to
    // return it as-is instead of processing it as a query.
    if (!isPlainObject(details)) return { structure: details };

    const item: SyntaxItem = {
      structure: (details as unknown as Record<typeof QUERY_SYMBOLS.QUERY, Query>)[
        QUERY_SYMBOLS.QUERY
      ],
    };
    if ('options' in details) item.options = details.options;
    return item;
  }) as Array<SyntaxItem<Query>>;
};

/**
 * Serializes a provided value to ensure that the final structure can be sent over the
 * network and/or passed to the query compiler.
 *
 * For example, `Date` objects will be converted into ISO strings.
 *
 * @param defaultValue - The value to serialize.
 * @param replacer - A function that should be used to serialize nested values.
 *
 * @returns The serialized value.
 */
const serializeValue = (
  defaultValue: unknown,
  replacer?: NonNullable<Parameters<typeof getSyntaxProxy>[0]>['replacer'],
) => {
  let value = defaultValue;

  // Never serialize `undefined` values, as they are not valid JSON.
  if (typeof value === 'undefined') return value;

  // If a function is provided as the argument for the query, call it and make
  // all queries within it think they are running inside a batch transaction,
  // in order to retrieve their serialized values.
  if (typeof value === 'function') {
    // Temporarily store the original value of `IN_RONIN_BATCH`, so that we can resume it
    // after the nested function has been called.
    const ORIGINAL_IN_RONIN_BATCH = globalThis.IN_RONIN_BATCH;

    // Since `value()` is synchronous, `IN_RONIN_BATCH` should not affect any other
    // queries somewhere else in the app, even if those are run inside an
    // asynchronous function.
    globalThis.IN_RONIN_BATCH = true;

    // A proxy object providing a property for every field of the model. It allows
    // for referencing fields inside of an expression.
    const fieldProxy = new Proxy(
      {},
      {
        get(_target, property) {
          const name = property.toString();

          return {
            [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD}${name}`,
          };
        },
      },
    );

    try {
      const ORIGINAL_IN_RONIN_QUERY = globalThis.IN_RONIN_QUERY;
      globalThis.IN_RONIN_QUERY = true;
      value = value(fieldProxy);
      globalThis.IN_RONIN_QUERY = ORIGINAL_IN_RONIN_QUERY;
    } finally {
      // Always restore the original value of `IN_RONIN_BATCH`, even if `value()` throws.
      // This is essential, otherwise `IN_RONIN_BATCH` might stay outdated.
      globalThis.IN_RONIN_BATCH = ORIGINAL_IN_RONIN_BATCH;
    }
  }

  // If a custom replacer function was provided, serialize the value with it.
  if (replacer) {
    const replacedValue = replacer(value);

    // If the replacer function returns a value, use it.
    if (typeof replacedValue !== 'undefined') return replacedValue;
  }

  // Otherwise, default to serializing the value as JSON.
  return JSON.parse(JSON.stringify(value));
};

export { getProperty, setProperty } from '@/src/utils';
export type { ResultRecord, DeepCallable } from '@/src/queries/types';
export { getSyntaxProxySQL, getBatchProxySQL } from '@/src/queries/statements';
