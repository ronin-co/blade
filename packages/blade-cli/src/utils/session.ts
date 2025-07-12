import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spinner } from '@/src/utils/spinner';
import toml, { type JsonMap } from '@iarna/toml';
import ini from 'ini';

const CACHE_DIR = path.join(os.homedir(), '.ronin');
const CACHE_DIR_FILE = path.join(CACHE_DIR, 'session.json');

interface Session {
  token: string;
}

interface BunConfig {
  install?: {
    scopes?: {
      'ronin-types'?: {
        url?: string;
        token?: string;
      };
      ronin?: {
        url?: string;
        token?: string;
      };
    };
  };
}
interface NpmConfig {
  '@ronin-types:registry'?: string;
  '@ronin:registry'?: string;
  '//ronin.supply/:_authToken'?: string;
  [key: string]: string | undefined;
}

export const getSession = async (): Promise<Session | null> => {
  try {
    const contents = await fs.readFile(CACHE_DIR_FILE, {
      encoding: 'utf-8',
    });

    const parsedContents = JSON.parse(contents);
    if (parsedContents?.token) return parsedContents;
  } catch (err) {
    if ((err as { code: string }).code !== 'ENOENT') throw err;
  }

  return null;
};

export const readConfigFile = async <T>(
  filePath: string,
  name: string,
  parser: (config: string) => T,
): Promise<T> => {
  let configContents: T;

  try {
    const contents = await fs.readFile(filePath, { encoding: 'utf-8' });
    configContents = parser(contents);
  } catch (err) {
    if ((err as { code: string }).code !== 'ENOENT') {
      spinner.fail(`Failed to read ${name} config file at ${filePath}`);
    }
    configContents = {} as T; // Return an empty object of type T
  }

  return configContents;
};

const writeConfigFile = (filePath: string, contents: string): Promise<void> => {
  return fs.writeFile(filePath, contents, { encoding: 'utf-8' });
};

export const storeSession = async (token: string): Promise<void> => {
  // Ensure that the cache directory exists.
  try {
    await fs.stat(CACHE_DIR);
  } catch (err) {
    if ((err as { code: string }).code === 'ENOENT') {
      await fs.mkdir(CACHE_DIR);
    } else {
      throw err;
    }
  }

  return writeConfigFile(CACHE_DIR_FILE, JSON.stringify({ token }, null, 2));
};

export const storeTokenForNPM = async (token: string): Promise<void> => {
  const npmConfigFile =
    process.env.npm_config_userconfig || path.join(os.homedir(), '.npmrc');
  const npmConfigContents = await readConfigFile<NpmConfig>(
    npmConfigFile,
    'npm',
    ini.parse,
  );

  npmConfigContents['@ronin-types:registry'] = 'https://ronin.supply';
  npmConfigContents['//ronin.supply/:_authToken'] = token;

  // Remove the old registry config, since it causes a conflict with the `@ronin` scope
  // available on npm, which the RONIN team uses to publish packages.
  delete npmConfigContents['@ronin:registry'];

  await writeConfigFile(npmConfigFile, ini.stringify(npmConfigContents));
};

export const storeTokenForBun = async (token: string): Promise<void> => {
  const bunConfigFile = path.join(os.homedir(), '.bunfig.toml');
  const bunConfigContents = await readConfigFile<BunConfig>(
    bunConfigFile,
    'Bun',
    toml.parse,
  );

  // Safely initialize potentially missing keys.
  if (!bunConfigContents.install) bunConfigContents.install = {};
  if (!bunConfigContents.install.scopes) bunConfigContents.install.scopes = {};
  if (!bunConfigContents.install.scopes['ronin-types'])
    bunConfigContents.install.scopes['ronin-types'] = {};

  bunConfigContents.install.scopes['ronin-types'].url = 'https://ronin.supply';
  bunConfigContents.install.scopes['ronin-types'].token = token;

  // Remove the old registry config, since it causes a conflict with the `@ronin` scope
  // available on npm, which the RONIN team uses to publish packages.
  delete bunConfigContents.install.scopes.ronin;

  await writeConfigFile(
    bunConfigFile,
    toml.stringify(bunConfigContents as unknown as JsonMap),
  );
};
