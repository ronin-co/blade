import { describe, expect, test } from 'bun:test';

import {
  importBladeCompilerQueryTypesType,
  importBladeCompilerStoredObjectType,
  importSyntaxUtilTypesType,
  jsonArrayType,
  jsonObjectType,
  jsonPrimitiveType,
  resolveSchemaType,
} from '@/src/declarations';
import { printNodes } from '@/src/utils/print';

describe('declarations', () => {
  test('import the query types from `blade-compiler`', () => {
    const output = printNodes([importBladeCompilerQueryTypesType]);
    expect(output).toStrictEqual(
      `import type { AddQuery, CombinedInstructions, Expression, GetQuery, RemoveQuery, SetQuery } from \"blade-compiler\";\n`,
    );
  });

  test('import the stored object from `blade-compiler`', () => {
    const output = printNodes([importBladeCompilerStoredObjectType]);
    expect(output).toStrictEqual(
      `import type { StoredObject } from \"blade-compiler\";\n`,
    );
  });

  test('import the utility query types from `blade-syntax/queries`', () => {
    const output = printNodes([importSyntaxUtilTypesType]);
    expect(output).toStrictEqual(
      `import type { ReducedFunction, ResultRecord } from \"blade-syntax/queries\";\n`,
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
});
