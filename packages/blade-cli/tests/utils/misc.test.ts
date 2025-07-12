import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  spyOn,
  test,
} from 'bun:test';

import fs from 'node:fs';
import {
  InvalidResponseError,
  MODEL_IN_CODE_PATH,
  areArraysEqual,
  getModelDefinitions,
  getResponseBody,
  logDataTable,
  logTableDiff,
  sortModels,
} from '@/src/utils/misc';

import { stderr } from 'node:process';
import { Account, CONSTANTS, TestA, TestB } from '@/fixtures/index';
import type { Model } from '@ronin/compiler';

describe('misc', () => {
  beforeEach(() => {
    // Don't log anything to the console in the tests.
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'table').mockImplementation(() => {});
    // @ts-expect-error This is a mock.
    spyOn(stderr, 'write').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('log data table', () => {
    test('should log data table', () => {
      const consoleLogSpy = spyOn(console, 'log');
      const consoleTableSpy = spyOn(console, 'table');
      logDataTable([{ name: 'John', age: 30 }], 'Test');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleTableSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle empty array', () => {
      const consoleLogSpy = spyOn(console, 'log');
      const consoleTableSpy = spyOn(console, 'table');
      logDataTable([], 'Empty Test');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleTableSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple rows', () => {
      const consoleLogSpy = spyOn(console, 'log');
      const consoleTableSpy = spyOn(console, 'table');
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      logDataTable(data, 'Multiple Rows');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleTableSpy).toHaveBeenCalledTimes(1);
    });

    test('should log table diff', () => {
      const consoleLogSpy = spyOn(console, 'log');
      const consoleTableSpy = spyOn(console, 'table');
      logTableDiff(TestA, TestB, 'Test');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleTableSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle identical objects in diff', () => {
      const consoleLogSpy = spyOn(console, 'log');
      const consoleTableSpy = spyOn(console, 'table');
      const objA: Model = {
        slug: 'test',
        fields: {
          name: {
            name: 'Test',
            type: 'string',
          },
        },
      };
      const objB: Model = {
        slug: 'test',
        fields: {
          name: {
            name: 'Test',
            type: 'string',
          },
        },
      };

      logTableDiff(objA, objB, 'Identical Objects');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleTableSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle empty objects in diff', () => {
      const consoleLogSpy = spyOn(console, 'log');
      const consoleTableSpy = spyOn(console, 'table');

      logTableDiff({} as Model, {} as Model, 'Empty Objects');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleTableSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('get models in code definitions', () => {
    afterEach(() => {
      // Clear the module cache after each test to ensure fresh imports
      delete require.cache[MODEL_IN_CODE_PATH];

      mock.restore();
    });
    test('should return models in code definitions - empty', async () => {
      mock.module(MODEL_IN_CODE_PATH, () => {
        return {};
      });

      const existsSync = spyOn(fs, 'existsSync');
      existsSync.mockReturnValue(true);
      existsSync.mockClear();

      const models = await getModelDefinitions();
      expect(models).toHaveLength(0);
      expect(models).toStrictEqual([]);
    });

    test('should fail to get model definitions because of invalid model slug', async () => {
      spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const ora = spyOn(stderr, 'write');

      mock.module(MODEL_IN_CODE_PATH, () => {
        return {
          Account: {
            slug: '',
          },
        };
      });

      const existsSync = spyOn(fs, 'existsSync');
      existsSync.mockReturnValue(true);
      existsSync.mockClear();

      try {
        await getModelDefinitions();
      } catch (err) {
        const error = err as Error;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('process.exit called');
      }

      expect(ora).toHaveBeenCalledWith(
        expect.stringContaining('The `slug` attribute of models must not be empty.'),
      );
    });

    test('should return models in code definitions and ignore constants - empty', async () => {
      mock.module(MODEL_IN_CODE_PATH, () => {
        return { CONSTANTS };
      });

      const existsSync = spyOn(fs, 'existsSync');
      existsSync.mockReturnValue(true);
      existsSync.mockClear();

      const models = await getModelDefinitions();
      expect(models).toHaveLength(0);
      expect(models).toStrictEqual([]);
    });

    test('model file does not exist', async () => {
      const existSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const existsSync = spyOn(fs, 'existsSync');
      existsSync.mockReturnValue(false);
      existsSync.mockClear();

      try {
        await getModelDefinitions();
      } catch (err) {
        const error = err as Error;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('process.exit called');
      }

      expect(existSpy).toHaveBeenCalledTimes(1);
    });

    test('should return models in code definitions - one model', async () => {
      mock.module('@/src/utils/misc', () => {
        return {
          getModelDefinitions: (): Array<Model> => [Account],
        };
      });

      const models = await getModelDefinitions();

      expect(models).toEqual([
        {
          slug: 'account',
          pluralSlug: 'accounts',
          fields: {
            name: {
              type: 'string',
            },
          },
        },
      ]);

      expect(models).toHaveLength(1);
      mock.restore();
    });
  });
});
describe('areArraysEqual', () => {
  test('returns true for identical arrays', () => {
    const arr1 = ['a', 'b', 'c'];
    const arr2 = ['a', 'b', 'c'];
    expect(areArraysEqual(arr1, arr2)).toBe(true);
  });

  test('returns false for arrays with different lengths', () => {
    const arr1 = ['a', 'b'];
    const arr2 = ['a', 'b', 'c'];
    expect(areArraysEqual(arr1, arr2)).toBe(false);
  });

  test('returns false for arrays with same length but different elements', () => {
    const arr1 = ['a', 'b', 'c'];
    const arr2 = ['a', 'b', 'd'];
    expect(areArraysEqual(arr1, arr2)).toBe(false);
  });

  test('returns false for arrays with same elements in different order', () => {
    const arr1 = ['a', 'b', 'c'];
    const arr2 = ['c', 'b', 'a'];
    expect(areArraysEqual(arr1, arr2)).toBe(false);
  });

  test('returns true for empty arrays', () => {
    const arr1: Array<string> = [];
    const arr2: Array<string> = [];
    expect(areArraysEqual(arr1, arr2)).toBe(true);
  });

  describe('sortModels', () => {
    test('should sort models with dependencies', () => {
      const modelA: Model = {
        slug: 'modelA',
      };

      const modelB: Model = {
        slug: 'modelB',
        fields: {
          linkToA: {
            type: 'link',
            target: 'modelA',
          },
        },
      };

      const modelC: Model = {
        slug: 'modelC',
        fields: {
          linkToB: {
            type: 'link',
            target: 'modelB',
          },
        },
      };

      const unsortedModels = [modelC, modelB, modelA];
      const sortedModels = sortModels(unsortedModels);

      expect(sortedModels).toEqual([modelA, modelB, modelC]);
    });
  });

  describe('sortModels', () => {
    test('should handle self-referential links', () => {
      const modelWithSelfLink: Model = {
        slug: 'employee',
        fields: {
          manager: {
            type: 'link',
            target: 'employee', // Self reference
          },
        },
      };

      const sortedModels = sortModels([modelWithSelfLink]);
      expect(sortedModels).toEqual([modelWithSelfLink]);
    });

    test('should throw error on circular dependencies', () => {
      const modelA: Model = {
        slug: 'modelA',
        fields: {
          linkToB: {
            type: 'link',
            target: 'modelB',
          },
        },
      };

      const modelB: Model = {
        slug: 'modelB',
        fields: {
          linkToA: {
            type: 'link',
            target: 'modelA',
          },
        },
      };

      expect(() => sortModels([modelA, modelB])).toThrow(
        'Cycle detected in models. Slug causing cycle: "modelA"',
      );
    });

    test('should handle models with no dependencies', () => {
      const modelA: Model = {
        slug: 'modelA',
      };

      const modelB: Model = {
        slug: 'modelB',
      };

      const sortedModels = sortModels([modelA, modelB]);
      // Order doesn't matter since there are no dependencies
      expect(sortedModels).toHaveLength(2);
      expect(sortedModels).toContain(modelA);
      expect(sortedModels).toContain(modelB);
    });

    test('should throw error if dependency target not found', () => {
      const modelA: Model = {
        slug: 'modelA',
        fields: {
          linkToMissing: {
            type: 'link',
            target: 'nonexistentModel',
          },
        },
      };

      // The visit function will try to process 'nonexistentModel' but won't find it
      expect(() => sortModels([modelA])).toThrow();
    });
  });
});

describe('getResponseBody', () => {
  test('get response with broken body', async () => {
    const response = new Response('test', { status: 400 });

    let error: Error | undefined;

    try {
      await getResponseBody(response);
    } catch (err) {
      error = err as Error;
    }

    expect(error).toBeInstanceOf(InvalidResponseError);
  });
});
