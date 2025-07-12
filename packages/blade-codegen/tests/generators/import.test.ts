import { describe, expect, test } from 'bun:test';
import { factory } from 'typescript';

import { createImportDeclaration } from '@/src/generators/import';
import { printNodes } from '@/src/utils/print';

// Note: We need to `JSON.stringify` the module name to ensure that the
// module name is wrapped in quotes for the import statement.
const roninModuleIdentifier = factory.createIdentifier(JSON.stringify('ronin'));
const roninNamespaceIdentifier = factory.createIdentifier('RONIN');

describe('import', () => {
  test('a simple import statement', () => {
    const declaration = createImportDeclaration({
      identifiers: [{ name: roninNamespaceIdentifier }],
      module: roninModuleIdentifier,
    });

    const output = printNodes([declaration]);

    expect(output).toMatchSnapshot();
  });

  test('a type import statement', () => {
    const declaration = createImportDeclaration({
      identifiers: [{ name: roninNamespaceIdentifier }],
      module: roninModuleIdentifier,
      type: true,
    });

    const output = printNodes([declaration]);

    expect(output).toMatchSnapshot();
  });

  test('an import statement with individual type imports', () => {
    const declaration = createImportDeclaration({
      identifiers: [{ name: roninNamespaceIdentifier, type: true }],
      module: roninModuleIdentifier,
    });

    const output = printNodes([declaration]);

    expect(output).toMatchSnapshot();
  });

  test('an import with multiple identifiers', () => {
    const declaration = createImportDeclaration({
      identifiers: [
        { name: factory.createIdentifier('Foo') },
        { name: factory.createIdentifier('Bar') },
      ],
      module: roninModuleIdentifier,
    });

    const output = printNodes([declaration]);

    expect(output).toMatchSnapshot();
  });

  test('an import with mixed typed identifiers', () => {
    const declaration = createImportDeclaration({
      identifiers: [
        { name: factory.createIdentifier('Foo') },
        { name: factory.createIdentifier('Bar'), type: true },
      ],
      module: roninModuleIdentifier,
    });

    const output = printNodes([declaration]);

    expect(output).toMatchSnapshot();
  });
});
