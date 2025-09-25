import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';

import { BLADE_CONFIG_DIR } from '@/src/utils/misc';
import * as typesModule from '@/src/utils/types';

import type { Stats } from 'node:fs';

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
        include: ['**/*.ts', '**/*.tsx', `${BLADE_CONFIG_DIR}/*.d.ts`],
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
        include: ['**/*.ts', '**/*.tsx', `${BLADE_CONFIG_DIR}/*.d.ts`],
      });
    });

    test('should extend a populated `include` array', async () => {
      spyOn(fs, 'stat').mockReturnValue(Promise.resolve({} as Stats));
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
        include: ['src/**/*', `${BLADE_CONFIG_DIR}/*.d.ts`],
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
        include: ['**/*.ts', '**/*.tsx', `${BLADE_CONFIG_DIR}/*.d.ts`],
      });
    });
  });
});
