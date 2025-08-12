import { constants, access, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';

import {
  loggingPrefixes,
  outputDirectory,
  routerInputFile,
} from '@/private/shell/constants';
import type { FileError } from '@/private/shell/types';
import type { VirtualFileItem } from '@/private/shell/utils/build';
import type { DeploymentProvider } from '@/private/universal/types/util';

interface FileItem {
  type: 'FILE' | 'DIRECTORY';
  absolutePath: string;
  relativePath: string;
}

type FileList = Array<FileItem>;

export type TotalFileList = Map<string, FileList>;

export const crawlDirectory = async (directoryPath: string): Promise<FileList> => {
  const files = await readdir(directoryPath, { recursive: true });

  return files.map((file) => ({
    type: path.extname(file) === '' ? 'DIRECTORY' : 'FILE',
    absolutePath: path.join(directoryPath, file),
    relativePath: file,
  }));
};

/**
 * Crawls a directory that only exists virtually (in memory) and not on the file system.
 *
 * @param virtualFiles - The entire list of virtual files.
 * @param directoryName — The directory within the list of files that should be crawled.
 *
 * @returns A list of nested files and directories.
 */
export const crawlVirtualDirectory = (
  virtualFiles: Array<VirtualFileItem>,
  directoryName: string,
): FileList => {
  const entries: FileList = [];
  const seenDirs = new Set<string>();
  const rootDir = `/${directoryName}`;

  for (const { path: absoluteFilePath } of virtualFiles) {
    // Only include items under the specified directory.
    if (!absoluteFilePath.startsWith(`/${directoryName}`)) continue;
    const parts = absoluteFilePath.split('/');

    // Emit intermediate directories.
    for (let i = 1; i < parts.length - 1; i++) {
      const absoluteDirPath = parts.slice(0, i + 1).join('/');

      if (!seenDirs.has(absoluteDirPath) && absoluteDirPath !== rootDir) {
        seenDirs.add(absoluteDirPath);

        entries.push({
          type: 'DIRECTORY',
          absolutePath: absoluteDirPath,
          relativePath: path.relative(rootDir, absoluteDirPath),
        });
      }
    }

    // Emit the file itself.
    entries.push({
      type: 'FILE',
      absolutePath: absoluteFilePath,
      relativePath: path.relative(rootDir, absoluteFilePath),
    });
  }

  return entries;
};

const getImportList = (directoryName: string, files: FileList): string => {
  const importList = [];
  const exportList: { [key: string]: string } = {};

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const variableName = directoryName + index;

    if (file.type === 'DIRECTORY') {
      exportList[file.relativePath] = `'DIRECTORY'`;
    } else {
      // Normalize the path for use in import statements (convert backslashes to forward slashes on Windows).
      const normalizedPath = file.absolutePath.replace(/\\/g, '/');
      importList.push(`import * as ${variableName} from '${normalizedPath}';`);
      exportList[file.relativePath] = variableName;
    }
  }

  const exportItems = Object.entries(exportList).map(([path, variable]) => {
    return `'${path}': ${variable}`;
  });

  let code = `${importList.join('\n')}\n\n`;
  code += `const ${directoryName} = { ${exportItems.join(',\n')} };`;

  return code;
};

export const getFileList = (
  files: TotalFileList,
  directories: Array<string>,
  routerExists?: boolean,
): string => {
  const imports = directories.map((name) => getImportList(name, files.get(name)!));

  if (routerExists) {
    // Normalize the path for use in import statements (convert backslashes to forward slashes on Windows).
    const normalizedRouterPath = routerInputFile.replace(/\\/g, '/');
    imports.push(`import { default as honoRouter } from '${normalizedRouterPath}';`);
  }

  let file = imports.join('\n\n');

  file += '\n\n';
  file += `export const router = ${routerExists ? 'honoRouter' : 'null'};\n`;
  file += `export { ${directories.join(', ')} };\n`;

  return file;
};

export interface ExportItem {
  localName: string;
  externalName: string;
}

export const wrapClientExport = (
  exportItem: ExportItem,
  chunk: { id: string; path: string },
) => {
  const { externalName, localName } = exportItem;

  return `
    if (typeof window === 'undefined' || isNetlify) {
      try {
        Object.defineProperties(
          ${localName}.$$typeof === REACT_FORWARD_REF_TYPE ? ${localName}.render : ${localName},
          {
            $$typeof: { value: CLIENT_REFERENCE },
            name: { value: '${externalName}' },
            chunk: { value: '${chunk.id}' },
            id: { value: '${chunk.path}' }
          }
        );
      } catch (err) {}
    } else {
      if (!window['BLADE_CHUNKS']) window['BLADE_CHUNKS'] = {};
      if (!window.BLADE_CHUNKS["${chunk.id}"]) window.BLADE_CHUNKS["${chunk.id}"] = {};
      window.BLADE_CHUNKS["${chunk.id}"]["${externalName}"] = ${localName};
    }
  `;
};

export const extractDeclarationName = (node: any | null | undefined): string | null => {
  if (!node) return null;
  switch (node.type) {
    case 'Identifier':
      return node.name;
    case 'Literal':
      return String(node.value);
    default:
      if ('id' in node && node.id?.type === 'Identifier') return node.id.name;
      return null;
  }
};

export const composeEnvironmentVariables = (options: {
  environment: 'development' | 'production';
  isLoggingQueries: boolean;
  enableServiceWorker: boolean;
  provider: DeploymentProvider;
}): Record<string, string> => {
  const { provider, environment, isLoggingQueries, enableServiceWorker } = options;

  const filteredVariables = Object.entries(process.env).filter(([key]) => {
    return key.startsWith('BLADE_');
  }) as Array<[string, string]>;

  const defined = Object.fromEntries(filteredVariables);

  if (process.env['BLADE_ENV']) {
    let message = `${loggingPrefixes.error} The \`BLADE_ENV\` environment variable is provided by BLADE`;
    message += ` and cannot be overwritten. Using the \`blade\` command for "development"`;
    message += ` and \`blade build\` for "production" will automatically infer the value.`;
    console.error(message);
    process.exit(0);
  }

  defined['__BLADE_PROVIDER'] = provider;
  defined['__BLADE_SERVICE_WORKER'] = enableServiceWorker.toString();

  if (provider === 'cloudflare') {
    defined['BLADE_PUBLIC_GIT_BRANCH'] = process.env['CF_PAGES_BRANCH'] ?? '';
    defined['BLADE_PUBLIC_GIT_COMMIT'] = process.env['CF_PAGES_COMMIT_SHA'] ?? '';
  }

  if (provider === 'netlify') {
    defined['BLADE_PUBLIC_GIT_BRANCH'] = process.env['BRANCH'] ?? '';
    defined['BLADE_PUBLIC_GIT_COMMIT'] = process.env['COMMIT_REF'] ?? '';
  }

  if (provider === 'vercel') {
    defined['BLADE_PUBLIC_GIT_BRANCH'] = process.env['VERCEL_GIT_COMMIT_REF'] ?? '';
    defined['BLADE_PUBLIC_GIT_COMMIT'] = process.env['VERCEL_GIT_COMMIT_SHA'] ?? '';
  }

  defined['BLADE_DATA_WORKER'] ??= 'https://data.ronin.co';
  defined['BLADE_STORAGE_WORKER'] ??= 'https://storage.ronin.co';
  defined['RONIN_TOKEN'] = process.env['RONIN_TOKEN'] ?? '';

  // Used by dependencies and the application itself to understand which environment the
  // application is currently running in.
  defined['NODE_ENV'] = environment;
  defined['BUN_ENV'] = environment;
  defined['BLADE_ENV'] = environment;

  // This variable is used internally by BLADE to determine how much information should
  // be logged to the terminal.
  defined['__BLADE_DEBUG_LEVEL'] = isLoggingQueries ? 'verbose' : 'error';

  const mapped = Object.fromEntries(
    Object.entries(defined).map(([key, value]) => {
      const stringValue = JSON.stringify(value);
      return [`import.meta.env.${key}`, stringValue];
    }),
  );

  // This is the only `process.env` environment variable that we want to replace.
  mapped['process.env.NODE_ENV'] = JSON.stringify(environment);

  return mapped;
};

export const logSpinner = (text: string) => {
  return ora({
    prefixText: loggingPrefixes.info,
    text,
    // Make CTRL+C work as expected.
    discardStdin: false,
  });
};

export const cleanUp = async () => {
  const removalSpinner = logSpinner('Cleaning up previous build').start();

  try {
    await rm(outputDirectory, { recursive: true });
  } catch (err: unknown) {
    if ((err as FileError).code !== 'ENOENT') {
      console.error(err);
    }
  }

  removalSpinner.succeed();
};

/**
 * Checks if a file or directory exists.
 *
 * @param path - The file or directory to check for.
 *
 * @returns A boolean indicating whether the file or directory exists.
 */
export const exists = (path: string) =>
  access(path, constants.F_OK)
    .then(() => true)
    .catch(() => false);
