import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';

import * as typesModule from '@/src/utils/types';

describe('types utils', () => {
  beforeEach(() => {
    // Reset all mocks before each test.
    jest.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original fetch.
    jest.restoreAllMocks();
  });

  describe('injectTSConfigInclude', () => {
    test('should create a config from scratch', async () => {
      spyOn(fs, 'exists').mockReturnValue(Promise.resolve(false));

      const config = await typesModule.injectTSConfigInclude('fake-path');

      expect(config).toMatchObject({
        compilerOptions: {},
        include: ['**/*.ts', '**/*.tsx', '.ronin/*.d.ts'],
      });
    });

    test('should add an `include` array', async () => {
      spyOn(fs, 'exists').mockReturnValue(Promise.resolve(true));
      spyOn(fs, 'readFile').mockReturnValue(
        Promise.resolve(
          JSON.stringify({
            compilerOptions: {},
          }),
        ),
      );

      const config = await typesModule.injectTSConfigInclude('fake-path');

      expect(config).toMatchObject({
        compilerOptions: {},
        include: ['**/*.ts', '**/*.tsx', '.ronin/*.d.ts'],
      });
    });

    test('should extend a populated `include` array', async () => {
      spyOn(fs, 'exists').mockReturnValue(Promise.resolve(true));
      spyOn(fs, 'readFile').mockReturnValue(
        Promise.resolve(
          JSON.stringify({
            compilerOptions: {},
            include: ['src/**/*'],
          }),
        ),
      );

      const config = await typesModule.injectTSConfigInclude('fake-path');

      expect(config).toMatchObject({
        compilerOptions: {},
        include: ['src/**/*', '.ronin/*.d.ts'],
      });
    });

    test('should extend an empty `include` array', async () => {
      spyOn(fs, 'exists').mockReturnValue(Promise.resolve(true));
      spyOn(fs, 'readFile').mockReturnValue(
        Promise.resolve(
          JSON.stringify({
            compilerOptions: {},
            include: [],
          }),
        ),
      );

      const config = await typesModule.injectTSConfigInclude('fake-path');

      expect(config).toMatchObject({
        compilerOptions: {},
        include: ['**/*.ts', '**/*.tsx', '.ronin/*.d.ts'],
      });
    });
  });
});
