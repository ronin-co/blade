import { afterEach, beforeAll, describe, expect, jest, mock, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { readConfig, resetConfig, saveConfig } from '@/src/utils/config';

describe('config', () => {
  const configDir = path.join(process.cwd(), '.ronin');
  const configPath = path.join(configDir, 'config.json');

  beforeAll(() => {
    mock.restore();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mock.restore();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    if (fs.existsSync(configDir)) {
      fs.rmdirSync(configDir, { recursive: true });
    }

    jest.clearAllMocks();
  });

  describe('saveConfig', () => {
    test('should save new config', () => {
      const config = { space: 'test-space', modelsDir: 'schema/index.ts' };
      saveConfig(config);

      expect(JSON.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual(config);
    });

    test('should merge with existing config', () => {
      const initialConfig = { space: 'test-space' };
      const additionalConfig = { modelsDir: 'models' };

      saveConfig(initialConfig);
      saveConfig(additionalConfig);

      expect(JSON.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual({
        ...initialConfig,
        ...additionalConfig,
      });
    });
  });

  describe('resetConfig', () => {
    test('should delete config file if it exists', () => {
      saveConfig({ space: 'test-space' });
      expect(fs.existsSync(configPath)).toBe(true);

      resetConfig();
      expect(fs.existsSync(configPath)).toBe(false);
    });

    test('should not throw if config file does not exist', () => {
      expect(() => resetConfig()).not.toThrow();
    });
  });

  describe('readConfig', () => {
    test('should return empty object if config does not exist', () => {
      expect(readConfig()).toEqual({});
    });

    test('should return config if it exists', () => {
      const config = { space: 'test-space', modelsDir: 'models' };
      saveConfig(config);
      expect(readConfig()).toEqual(config);
    });
  });
});
