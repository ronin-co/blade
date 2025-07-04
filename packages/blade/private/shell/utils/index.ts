import { constants, access, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  compile as compileTailwind,
  optimize as optimizeTailwind,
} from '@tailwindcss/node';
import { Scanner as TailwindScanner } from '@tailwindcss/oxide';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import ora from 'ora';

import {
  loggingPrefixes,
  outputDirectory,
  routerInputFile,
  styleInputFile,
} from '@/private/shell/constants';
import type { FileError } from '@/private/shell/types';
import type { DeploymentProvider } from '@/private/universal/types/util';
import { getOutputFile } from '@/private/universal/utils/paths';

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

const getImportList = async (directoryName: string, files: FileList) => {
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

export const getFileList = async (
  files: TotalFileList,
  directories: Array<string>,
  router?: boolean,
): Promise<string> => {
  const importPromises = directories.map((name) => getImportList(name, files.get(name)!));
  const imports = await Promise.all(importPromises);
  const routerExists = router ? await exists(routerInputFile) : false;

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

export const extractDeclarationName = (
  node: TSESTree.Node | null | undefined,
): string | null => {
  if (!node) return null;
  switch (node.type) {
    case 'Identifier':
      return node.name;
    case 'Literal':
      return String((node as TSESTree.Literal).value);
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

  const mapped = Object.fromEntries(Object.entries(defined).map(([key, value]) => {
    const stringValue = JSON.stringify(value);
    return [`import.meta.env.${key}`, stringValue];
  }));

  // This is the only `process.env` environment variable that we want to replace.
  mapped['process.env.NODE_ENV'] = environment;

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

/**
 * Compiles the Tailwind CSS stylesheet for the application.
 *
 * @param environment - The environment in which the application is running.
 * @param projects - The list of Blade projects to scan for Tailwind CSS classes.
 * @param bundleId - The unique identifier for the current bundle.
 *
 * @returns A promise that resolves when the styles have been prepared.
 */
export const prepareStyles = async (
  environment: 'development' | 'production',
  projects: Array<string>,
  bundleId: string,
) => {
  // Consider the directories containing the source code of the application.
  const content = ['pages', 'components', 'contexts'].flatMap((directory) => {
    return projects.map((project) => path.join(project, directory));
  });

  const input = (await exists(styleInputFile))
    ? await readFile(styleInputFile, 'utf8')
    : `@import 'tailwindcss';`;

  const compiler = await compileTailwind(input, {
    onDependency(_path) {},
    base: process.cwd(),
  });

  const scanner = new TailwindScanner({
    sources: content.map((base) => ({ base, pattern: '**/*', negated: false })),
  });

  const candidates = scanner.scan();
  const compiledStyles = compiler.build(candidates);

  const optimizedStyles = optimizeTailwind(compiledStyles, {
    file: 'input.css',
    minify: environment === 'production',
  });

  const tailwindOutput = path.join(outputDirectory, getOutputFile(bundleId, 'css'));
  await writeFile(tailwindOutput, optimizedStyles.code);
};
