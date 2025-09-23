import { describe, expect, test } from 'bun:test';

import {
  afterQueryPromiseType,
  afterQueryType,
  beforeQueryPromiseType,
  beforeQueryType,
  importBladeCompilerQueryTypesType,
  importBladeCompilerStoredObjectType,
  importBladeUtilsType,
  includingQueryPromiseType,
  includingQueryType,
  jsonArrayType,
  jsonObjectType,
  jsonPrimitiveType,
  limitedToQueryPromiseType,
  limitedToQueryType,
  orderedByQueryPromiseType,
  orderedByQueryType,
  resolveSchemaType,
  resultRecordType,
  rootCallerQueryPromiseType,
  rootCallerQueryType,
  selectingQueryPromiseType,
  selectingQueryType,
  sharedQueryOptionsParameter,
  toQueryPromiseType,
  toQueryType,
  withQueryPromiseType,
  withQueryType,
} from '@/src/declarations';
import { printNodes } from '@/src/utils/print';

describe('declarations', () => {
  test('import the query types from `blade-compiler`', () => {
    const output = printNodes([importBladeCompilerQueryTypesType]);
    expect(output).toStrictEqual(
      `import type { CombinedInstructions, Expression } from \"blade-compiler\";\n`,
    );
  });

  test('import the stored object from `blade-compiler`', () => {
    const output = printNodes([importBladeCompilerStoredObjectType]);
    expect(output).toStrictEqual(
      `import type { StoredObject } from \"blade-compiler\";\n`,
    );
  });

  test('import the utility types from `blade/types`', () => {
    const output = printNodes([importBladeUtilsType]);
    expect(output).toStrictEqual(
      `import type { ReducedFunction } from \"blade/types\";\n`,
    );
  });

  test('create `ResolveSchema` utility type`', () => {
    const output = printNodes([resolveSchemaType]);
    expect(output).toStrictEqual(
      `type ResolveSchema<S, U extends Array<string> | "all", K extends string> = U extends "all" ? S : K extends U[number] ? S : S extends Array<unknown> ? Array<string> : string;\n`,
    );
  });

  test('create `JsonPrimitive` utility type', () => {
    const output = printNodes([jsonPrimitiveType]);
    expect(output).toStrictEqual(
      'type JsonPrimitive = string | number | boolean | null;\n',
    );
  });

  test('create `JsonObject` utility type', () => {
    const output = printNodes([jsonObjectType]);
    expect(output).toStrictEqual(
      `type JsonObject = {
    [key: string]: JsonPrimitive | JsonObject | JsonArray;
};\n`,
    );
  });

  test('create `JsonArray` utility type', () => {
    const output = printNodes([jsonArrayType]);
    expect(output).toStrictEqual(
      'type JsonArray = Array<JsonPrimitive | JsonObject | JsonArray>;\n',
    );
  });
  test('create `afterQueryType` utility type', () => {
    const output = printNodes([afterQueryType]);
    expect(output).toStrictEqual(
      'type AfterQuery<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["after"], options?: Record<string, unknown>) => T);\n',
    );
  });
  test('create `afterQueryPromiseType` utility type', () => {
    const output = printNodes([afterQueryPromiseType]);
    expect(output).toStrictEqual(
      'type AfterQueryPromise<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["after"], options?: Record<string, unknown>) => Promise<T>);\n',
    );
  });
  test('create `beforeQueryType` utility type', () => {
    const output = printNodes([beforeQueryType]);
    expect(output).toStrictEqual(
      'type BeforeQuery<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["before"], options?: Record<string, unknown>) => T);\n',
    );
  });
  test('create `beforeQueryPromiseType` utility type', () => {
    const output = printNodes([beforeQueryPromiseType]);
    expect(output).toStrictEqual(
      'type BeforeQueryPromise<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["before"], options?: Record<string, unknown>) => Promise<T>);\n',
    );
  });
  test('create `includingQueryType` utility type', () => {
    const output = printNodes([includingQueryType]);
    expect(output).toStrictEqual(
      'type IncludingQuery<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["including"], options?: Record<string, unknown>) => T);\n',
    );
  });
  test('create `includingQueryPromiseType` utility type', () => {
    const output = printNodes([includingQueryPromiseType]);
    expect(output).toStrictEqual(
      'type IncludingQueryPromise<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["including"], options?: Record<string, unknown>) => Promise<T>);\n',
    );
  });
  test('create `limitedToQueryType` utility type', () => {
    const output = printNodes([limitedToQueryType]);
    expect(output).toStrictEqual(
      'type LimitedToQuery<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["limitedTo"], options?: Record<string, unknown>) => T);\n',
    );
  });
  test('create `limitedToQueryPromiseType` utility type', () => {
    const output = printNodes([limitedToQueryPromiseType]);
    expect(output).toStrictEqual(
      'type LimitedToQueryPromise<U> = ReducedFunction & (<T = U>(value: CombinedInstructions["limitedTo"], options?: Record<string, unknown>) => Promise<T>);\n',
    );
  });
  test('create `orderedByQueryType` utility type', () => {
    const output = printNodes([orderedByQueryType]);
    expect(
      output,
    ).toStrictEqual(`type OrderedByQuery<U, F extends string> = ReducedFunction & (<T = U>(instructions: {
    ascending?: Array<Expression | F>;
    descending?: Array<Expression | F>;
}, options?: Record<string, unknown>) => T) & {
    ascending: <T = U>(fields: Array<Expression | F>, options?: Record<string, unknown>) => T;
    descending: <T = U>(fields: Array<Expression | F>, options?: Record<string, unknown>) => T;
};\n`);
  });
  test('create `orderedByQueryPromiseType` utility type', () => {
    const output = printNodes([orderedByQueryPromiseType]);
    expect(
      output,
    ).toStrictEqual(`type OrderedByQueryPromise<U, F extends string> = ReducedFunction & (<T = U>(instructions: {
    ascending?: Array<Expression | F>;
    descending?: Array<Expression | F>;
}, options?: Record<string, unknown>) => Promise<T>) & {
    ascending: <T = U>(fields: Array<Expression | F>, options?: Record<string, unknown>) => Promise<T>;
    descending: <T = U>(fields: Array<Expression | F>, options?: Record<string, unknown>) => Promise<T>;
};\n`);
  });
  test('create `resultRecordType` utility type', () => {
    const output = printNodes([resultRecordType]);
    expect(output).toStrictEqual(`type ResultRecord = {
    /* The unique identifier of the record. */
    id: string;
    ronin: {
        /* The timestamp of when the record was created. */
        createdAt: string;
        /* The ID of the user who created the record. */
        createdBy: string | null;
        /* The timestamp of the last time the record was updated. */
        updatedAt: string;
        /* The ID of the user who last updated the record. */
        updatedBy: string | null;
    };
};\n`);
  });
  test('create `rootCallerQueryType` utility type', () => {
    const output = printNodes([rootCallerQueryType]);
    expect(output).toStrictEqual(
      'type RootQueryCaller<U> = <T = U>(instructions?: Partial<CombinedInstructions>, options?: Record<string, unknown>) => T;\n',
    );
  });
  test('create `rootCallerQueryPromiseType` utility type', () => {
    const output = printNodes([rootCallerQueryPromiseType]);
    expect(output).toStrictEqual(
      'type RootQueryCallerPromise<U> = <T = U>(instructions?: Partial<CombinedInstructions>, options?: Record<string, unknown>) => Promise<T>;\n',
    );
  });
  test('create `selectingQueryType` utility type', () => {
    const output = printNodes([selectingQueryType]);
    expect(output).toStrictEqual(
      'type SelectingQuery<U, F> = ReducedFunction & (<T = U>(instructions: Array<F>, options?: Record<string, unknown>) => T);\n',
    );
  });
  test('create `selectingQueryPromiseType` utility type', () => {
    const output = printNodes([selectingQueryPromiseType]);
    expect(output).toStrictEqual(
      'type SelectingQueryPromise<U, F> = ReducedFunction & (<T = U>(instructions: Array<F>, options?: Record<string, unknown>) => Promise<T>);\n',
    );
  });
  test('create `sharedQueryOptionsParameter` utility type', () => {
    const output = printNodes([sharedQueryOptionsParameter]);
    expect(output).toStrictEqual('options?: Record<string, unknown>\n');
  });
  test('create `toQueryType` utility type', () => {
    const output = printNodes([toQueryType]);
    expect(output).toStrictEqual(
      'type ToQuery<U, S> = ReducedFunction & (<T = U>(instructions: Partial<S>, options?: Record<string, unknown>) => T);\n',
    );
  });
  test('create `toQueryPromiseType` utility type', () => {
    const output = printNodes([toQueryPromiseType]);
    expect(output).toStrictEqual(
      'type ToQueryPromise<U, S> = ReducedFunction & (<T = U>(instructions: Partial<S>, options?: Record<string, unknown>) => Promise<T>);\n',
    );
  });
  test('create `withQueryType` utility type', () => {
    const output = printNodes([withQueryType]);
    expect(output).toStrictEqual(`type WithQuery<U, S> = ReducedFunction & {
    <T = U>(instructions: Partial<S> | CombinedInstructions["with"], options?: Record<string, unknown>): T;
    id: <T = U>(value: ResultRecord["id"], options?: Record<string, unknown>) => T;
    ronin: ReducedFunction & {
        createdAt: <T = U>(value: ResultRecord["ronin"]["createdAt"], options?: Record<string, unknown>) => T;
        createdBy: <T = U>(value: ResultRecord["ronin"]["createdBy"], options?: Record<string, unknown>) => T;
        updatedAt: <T = U>(value: ResultRecord["ronin"]["updatedAt"], options?: Record<string, unknown>) => T;
        updatedBy: <T = U>(value: ResultRecord["ronin"]["updatedBy"], options?: Record<string, unknown>) => T;
    };
};\n`);
  });
  test('create `withQueryPromiseType` utility type', () => {
    const output = printNodes([withQueryPromiseType]);
    expect(output).toStrictEqual(`type WithQueryPromise<U, S> = ReducedFunction & {
    <T = U>(instructions: Partial<S> | CombinedInstructions["with"], options?: Record<string, unknown>): Promise<T>;
    id: <T = U>(value: ResultRecord["id"], options?: Record<string, unknown>) => Promise<T>;
    ronin: ReducedFunction & {
        createdAt: <T = U>(value: ResultRecord["ronin"]["createdAt"], options?: Record<string, unknown>) => Promise<T>;
        createdBy: <T = U>(value: ResultRecord["ronin"]["createdBy"], options?: Record<string, unknown>) => Promise<T>;
        updatedAt: <T = U>(value: ResultRecord["ronin"]["updatedAt"], options?: Record<string, unknown>) => Promise<T>;
        updatedBy: <T = U>(value: ResultRecord["ronin"]["updatedBy"], options?: Record<string, unknown>) => Promise<T>;
    };
};\n`);
  });
});
