import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';
import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  getSession,
  readConfigFile,
  storeSession,
  storeTokenForBun,
  storeTokenForNPM,
} from '@/src/utils/session';
import { spinner } from '@/src/utils/spinner';
import toml from '@iarna/toml';
import ini from 'ini';

describe('session utils', () => {
  const CACHE_DIR = path.join(os.homedir(), '.ronin');
  const CACHE_DIR_FILE = path.join(CACHE_DIR, 'session.json');

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSession', () => {
    test('should return session when file exists', async () => {
      const readFileSpy = spyOn(fs, 'readFile').mockResolvedValue(
        JSON.stringify({ token: 'test-token' }),
      );

      const result = await getSession();
      expect(result).toEqual({ token: 'test-token' });
      expect(readFileSpy).toHaveBeenCalledWith(CACHE_DIR_FILE, {
        encoding: 'utf-8',
      });

      readFileSpy.mockRestore();
    });

    test('should return null when file does not exist', async () => {
      const readFileSpy = spyOn(fs, 'readFile').mockRejectedValue({ code: 'ENOENT' });

      const result = await getSession();
      expect(result).toBeNull();

      readFileSpy.mockRestore();
    });

    test('should throw error on other file system errors', async () => {
      const readFileSpy = spyOn(fs, 'readFile').mockRejectedValue(
        new Error('File system error'),
      );

      await expect(getSession()).rejects.toThrow('File system error');

      readFileSpy.mockRestore();
    });
  });

  describe('readConfigFile', () => {
    test('should handle non-ENOENT errors and show spinner fail message', async () => {
      const readFileSpy = spyOn(fs, 'readFile').mockRejectedValue(
        new Error('Permission denied'),
      );
      const spinnerFailSpy = spyOn(spinner, 'fail');

      const result = await readConfigFile('/test/path', 'test', (content) => content);

      // @ts-expect-error This is a mock.
      expect(result).toEqual({});
      expect(spinnerFailSpy).toHaveBeenCalledWith(
        'Failed to read test config file at /test/path',
      );

      readFileSpy.mockRestore();
      spinnerFailSpy.mockRestore();
    });
  });

  describe('storeSession', () => {
    test('should create cache directory if it does not exist', async () => {
      const statSpy = spyOn(fs, 'stat').mockRejectedValue({ code: 'ENOENT' });
      const mkdirSpy = spyOn(fs, 'mkdir').mockResolvedValue(undefined);
      const writeFileSpy = spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await storeSession('test-token');

      expect(mkdirSpy).toHaveBeenCalledWith(CACHE_DIR);
      expect(writeFileSpy).toHaveBeenCalledWith(
        CACHE_DIR_FILE,
        JSON.stringify({ token: 'test-token' }, null, 2),
        { encoding: 'utf-8' },
      );

      statSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeFileSpy.mockRestore();
    });

    test('should store session without creating directory if it exists', async () => {
      const statSpy = spyOn(fs, 'stat').mockResolvedValue({} as Stats);
      const mkdirSpy = spyOn(fs, 'mkdir');
      const writeFileSpy = spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await storeSession('test-token');

      expect(mkdirSpy).not.toHaveBeenCalled();
      expect(writeFileSpy).toHaveBeenCalledWith(
        CACHE_DIR_FILE,
        JSON.stringify({ token: 'test-token' }, null, 2),
        { encoding: 'utf-8' },
      );

      statSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeFileSpy.mockRestore();
    });

    test('should throw error on stat failure', async () => {
      const statSpy = spyOn(fs, 'stat').mockRejectedValue(new Error('Stat failed'));

      await expect(storeSession('test-token')).rejects.toThrow('Stat failed');

      statSpy.mockRestore();
    });
  });

  describe('storeTokenForNPM', () => {
    test('should store token in npm config', async () => {
      const readFileSpy = spyOn(fs, 'readFile').mockResolvedValue('');
      const writeFileSpy = spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await storeTokenForNPM('test-token');

      expect(writeFileSpy).toHaveBeenCalledWith(
        path.join(os.homedir(), '.npmrc'),
        ini.stringify({
          '@ronin-types:registry': 'https://ronin.supply',
          '//ronin.supply/:_authToken': 'test-token',
        }),
        { encoding: 'utf-8' },
      );

      readFileSpy.mockRestore();
      writeFileSpy.mockRestore();
    });
  });

  describe('storeTokenForBun', () => {
    test('should store token in bun config', async () => {
      const readFileSpy = spyOn(fs, 'readFile').mockResolvedValue('');
      const writeFileSpy = spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await storeTokenForBun('test-token');

      expect(writeFileSpy).toHaveBeenCalledWith(
        path.join(os.homedir(), '.bunfig.toml'),
        toml.stringify({
          install: {
            scopes: {
              'ronin-types': {
                url: 'https://ronin.supply',
                token: 'test-token',
              },
            },
          },
        }),
        { encoding: 'utf-8' },
      );

      readFileSpy.mockRestore();
      writeFileSpy.mockRestore();
    });
  });
});
