import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';
import { mock } from 'bun-bagel';

import * as logInModule from '@/src/commands/login';
import { getOrSelectSpaceId, getSpaces } from '@/src/utils/space';
import * as selectModule from '@inquirer/prompts';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('space utils', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.restoreAllMocks();

    // Create a temporary directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ronin-test-'));

    // Save original cwd and change to temp directory
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Create .ronin directory in the temp dir
    const roninDir = path.join(tempDir, '.ronin');
    if (!fs.existsSync(roninDir)) {
      fs.mkdirSync(roninDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('getSpaces', () => {
    test('should fetch and return spaces successfully', async () => {
      const mockSpaces = [{ id: '123', handle: 'test-space', name: 'Test Space' }];

      // Mock fetch response
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [[{ space: mockSpaces[0] }]],
            }),
        } as Response),
      );

      const result = await getSpaces('test-token');
      expect(result).toEqual(mockSpaces);
      expect(fetchSpy).toHaveBeenCalledWith('https://studio.ronin.co/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'token=test-token',
        },
        body: JSON.stringify({
          queries: [
            {
              get: {
                members: {
                  using: ['space', 'account'],
                  with: {
                    team: null,
                  },
                },
              },
            },
          ],
        }),
      });

      fetchSpy.mockRestore();
    });

    test('should throw error when API request fails', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response),
      );

      await expect(getSpaces('test-token')).rejects.toThrow(
        'Failed to fetch available spaces: API request failed with status: 500',
      );

      fetchSpy.mockRestore();
    });

    test('should throw error when API returns error message', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              error: 'API Error',
            }),
        } as Response),
      );

      await expect(getSpaces('test-token')).rejects.toThrow(
        'Failed to fetch available spaces: API Error',
      );

      fetchSpy.mockRestore();
    });
  });

  describe('getOrSelectSpaceId', () => {
    test('should return existing space from config', async () => {
      // Write a test config file directly
      const configDir = path.join(tempDir, '.ronin');
      const configPath = path.join(configDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({ space: 'existing-space' }));

      const result = await getOrSelectSpaceId();
      expect(result).toBe('existing-space');
    });

    test('should auto-select space when only one available', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                [{ space: { id: 'single-space', handle: 'test', name: 'Test' } }],
              ],
            }),
        } as Response),
      );

      const result = await getOrSelectSpaceId('test-token');
      expect(result).toBe('single-space');

      // Verify config was saved
      const configPath = path.join(tempDir, '.ronin', 'config.json');
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(savedConfig.space).toBe('single-space');

      fetchSpy.mockRestore();
    });

    test('should prompt user to select space when multiple available', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                [
                  { space: { id: 'space-1', handle: 'test-1', name: 'Test 1' } },
                  { space: { id: 'space-2', handle: 'test-2', name: 'Test 2' } },
                ],
              ],
            }),
        } as Response),
      );
      const selectSpy = spyOn(selectModule, 'select').mockResolvedValue('space-2');

      const result = await getOrSelectSpaceId('test-token');
      expect(result).toBe('space-2');

      // Verify config was saved
      const configPath = path.join(tempDir, '.ronin', 'config.json');
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(savedConfig.space).toBe('space-2');

      fetchSpy.mockRestore();
      selectSpy.mockRestore();
    });

    test('should throw error when no spaces available', async () => {
      const fetchSpy = spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [[]],
            }),
        } as Response),
      );

      await expect(getOrSelectSpaceId('test-token')).rejects.toThrow(
        "You don't have access to any space or your CLI session is invalid",
      );

      fetchSpy.mockRestore();
    });

    test('should throw error when space is not specified', async () => {
      await expect(getOrSelectSpaceId()).rejects.toThrow('Space ID is not specified');
    });

    test('should login when api returns 400 - fails', async () => {
      mock('https://studio.ronin.co/api', {
        response: {
          status: 400,
          data: 'This session is no longer valid.',
        },
        method: 'POST',
      });

      // @ts-expect-error This is a mock.
      spyOn(logInModule, 'default').mockReturnValue(undefined);

      try {
        await getSpaces('test-token');
      } catch (error) {
        const err = error as Error;
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Failed to fetch available spaces: Failed to log in.');
      }
    });

    test('should login when api returns 400 - succeeds', async () => {
      mock('https://studio.ronin.co/api', {
        response: {
          status: 400,
          data: 'This session is no longer valid.',
        },
        method: 'POST',
      });
      spyOn(logInModule, 'default')
        .mockReturnValueOnce(Promise.resolve('test-token'))
        .mockReturnValueOnce(Promise.resolve(undefined));

      try {
        await getSpaces('broken-token');
      } catch (error) {
        const err = error as Error;
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Failed to fetch available spaces: Failed to log in.');
      }
    });
  });
});
