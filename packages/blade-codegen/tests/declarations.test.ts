import { describe, expect, test } from 'bun:test';

import {
  importBladeCompilerQueryTypesType,
  importBladeCompilerStoredObjectType,
  importResultRecordType,
  jsonArrayType,
  jsonObjectType,
  jsonPrimitiveType,
  reducedFunctionType,
  resolveSchemaType,
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

  test('import the `ResultRecord` from `blade/types`', () => {
    const output = printNodes([importResultRecordType]);
    expect(output).toStrictEqual(`import type { ResultRecord } from \"blade/types\";\n`);
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

  test('create `ReducedFunction` utility type', () => {
    const output = printNodes([reducedFunctionType]);
    expect(output).toStrictEqual(`interface ReducedFunction {
    /** @deprecated */
    apply: never;
    /** @deprecated */
    arguments: never;
    /** @deprecated */
    bind: never;
    /** @deprecated */
    call: never;
    /** @deprecated */
    caller: never;
    /** @deprecated */
    length: never;
    /** @deprecated */
    name: any;
    /** @deprecated */
    prototype: never;
    /** @deprecated */
    toString: never;
    /** @deprecated */
    unify: never;
}\n`);
  });
});
