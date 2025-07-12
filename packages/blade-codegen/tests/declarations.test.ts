import { describe, expect, test } from 'bun:test';

import {
  importRoninQueryTypesType,
  importRoninStoredObjectType,
  importSyntaxUtiltypesType,
} from '@/src/declarations';
import { printNodes } from '@/src/utils/print';

describe('declarations', () => {
  test('import the RONIN namespace type from `ronin`', () => {
    const output = printNodes([importRoninQueryTypesType]);
    expect(output).toStrictEqual(
      `import type { AddQuery, CountQuery, GetQuery, ListQuery, Model, RemoveQuery, SetQuery } from \"@ronin/compiler\";\n`,
    );
  });

  test('import the RONIN namespace type from `ronin`', () => {
    const output = printNodes([importRoninStoredObjectType]);
    expect(output).toStrictEqual(
      `import type { StoredObject } from \"@ronin/compiler\";\n`,
    );
  });

  test('import the RONIN namespace type from `ronin`', () => {
    const output = printNodes([importSyntaxUtiltypesType]);
    expect(output).toStrictEqual(
      `import type { DeepCallable, ResultRecord } from \"@ronin/syntax/queries\";\n`,
    );
  });
});
