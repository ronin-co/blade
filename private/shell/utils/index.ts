import fs from 'node:fs';
import { exists, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  compile as compileTailwind,
  optimize as optimizeTailwind,
} from '@tailwindcss/node';
import { Scanner as TailwindScanner } from '@tailwindcss/oxide';
import type { Transpiler } from 'bun';
import ora from 'ora';

import {
  directoriesToParse,
  loggingPrefixes,
  outputDirectory,
  routerInputFile,
  styleInputFile,
} from '@/private/shell/constants';
import type { FileError } from '@/private/shell/types';
import type { DeploymentProvider } from '@/private/universal/types/util';
import { getOutputFile } from '@/private/universal/utils/paths';

const crawlDirectory = async (directory: string): Promise<string[]> => {
  const files = await readdir(directory, { recursive: true });
  return files.map((file) => (path.extname(file) === '' ? `${file}/` : file));
};

const getImportList = async (directoryName: string, directoryPath: string) => {
  const files = (await exists(directoryPath)) ? await crawlDirectory(directoryPath) : [];

  const importList = [];
  const exportList: { [key: string]: string } = {};

  for (let index = 0; index < files.length; index++) {
    const filePath = files[index] as (typeof files)[number];
    const filePathFull = path.join(directoryPath, filePath);
    const variableName = directoryName + index;

    if (filePath.endsWith('/')) {
      exportList[filePath.slice(0, filePath.length - 1)] = `'DIRECTORY'`;
    } else {
      importList.push(`import * as ${variableName} from '${filePathFull}';`);
      exportList[filePath] = variableName;
    }
  }

  const exportItems = Object.entries(exportList).map(([path, variable]) => {
    return `'${path}': ${variable}`;
  });

  let code = `${importList.join('\n')}\n\n`;
  code += `const ${directoryName} = { ${exportItems.join(',\n')} };`;

  return code;
};

export const getFileList = async (): Promise<string> => {
  const directories = Object.entries(directoriesToParse);
  const importPromises = directories.map(([name, path]) => getImportList(name, path));
  const imports = await Promise.all(importPromises);
  const routerExists = await exists(routerInputFile);

  if (await exists(routerInputFile)) {
    imports.push(`import { default as honoRouter } from '${routerInputFile}';`);
  }

  let file = imports.join('\n\n');

  file += '\n\n';
  file += `const router = ${routerExists ? 'honoRouter' : 'null'};\n`;
  file += 'export { pages, triggers, router };\n';

  return file;
};

export const wrapClientExport = (
  exportItem: ExportItem,
  chunk: { id: string; path: string },
) => {
  const internalName = exportItem.originalName || exportItem.name;
  const externalName = exportItem.name;

  return `
  if (typeof window === 'undefined' || isNetlify) {

    try {
    Object.defineProperties(
      ${internalName}.$$typeof === REACT_FORWARD_REF_TYPE ? ${internalName}.render : ${internalName},
      {
        $$typeof: { value: CLIENT_REFERENCE },
        name: { value: '${externalName}' },
        chunk: { value: '${chunk.id}' },
        id: { value: '${chunk.path}' }
      }
    );
  } catch (err) {}


  } else {

    if (!window.BLADE_CHUNKS["${chunk.id}"]) window.BLADE_CHUNKS["${chunk.id}"] = {};
    window.BLADE_CHUNKS["${chunk.id}"]["${externalName}"] = ${internalName};

  }
  `;
};

interface ExportItem {
  name: string;
  originalName: string | null;
}

export const scanExports = (transpiler: Transpiler, code: string): ExportItem[] => {
  const { exports: fileExports } = transpiler.scan(code);
  const defaultExportName = fileExports.includes('default')
    ? // Named default export — e.g. `export default Test;`
      code.match(/export default (\w+);/)?.[1] ||
      // Function default export — e.g. `export default function Graph() {}`
      code.match(/export default function (\w+)\(\) {/)?.[1]
    : null;

  return fileExports.map((name) => {
    const namedRegExp = new RegExp(`export\\s*{\\s*(\\w+)\\s*as\\s*${name}\\s*}`, 'g');
    const namedMatches = namedRegExp.exec(code);
    const originalName =
      name === 'default'
        ? (defaultExportName as string)
        : namedMatches
          ? namedMatches[1]
          : null;

    return {
      name,
      originalName,
    };
  });
};

export const composeEnvironmentVariables = (options: {
  isBuilding: boolean;
  isServing: boolean;
  isLoggingQueries: boolean;
  enableServiceWorker: boolean;
  provider: DeploymentProvider;
}): Record<string, string> => {
  const { provider, isBuilding, isServing, isLoggingQueries, enableServiceWorker } =
    options;

  const filteredVariables = Object.entries(Bun.env).filter(([key]) => {
    return key.startsWith('BLADE_PUBLIC_') || key === 'BLADE_ENV';
  }) as Array<[string, string]>;

  const defined = Object.fromEntries(filteredVariables);

  if (Bun.env['BLADE_ENV']) {
    let message = `${loggingPrefixes.error} The \`BLADE_ENV\` environment variable is provided by BLADE`;
    message += ` and cannot be overwritten. Using the \`blade\` command for "development"`;
    message += ` and \`blade build\` for "production" will automatically infer the value.`;
    console.error(message);
    process.exit(0);
  }

  defined['__BLADE_PROVIDER'] = provider;
  defined['__BLADE_SERVICE_WORKER'] = enableServiceWorker.toString();

  if (provider === 'cloudflare') {
    defined['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['CF_PAGES_BRANCH'] ?? '';
    defined['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['CF_PAGES_COMMIT_SHA'] ?? '';
  }

  if (provider === 'netlify') {
    defined['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['BRANCH'] ?? '';
    defined['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['COMMIT_REF'] ?? '';
  }

  if (provider === 'vercel') {
    defined['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['VERCEL_GIT_COMMIT_REF'] ?? '';
    defined['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['VERCEL_GIT_COMMIT_SHA'] ?? '';
  }

  defined['BLADE_DATA_WORKER'] ??= 'https://data.ronin.co';
  defined['BLADE_STORAGE_WORKER'] ??= 'https://storage.ronin.co';

  // Used by dependencies and the application itself to understand which environment the
  // application is currently running in.
  const environment = isBuilding || isServing ? 'production' : 'development';
  defined['NODE_ENV'] = environment;
  defined['BUN_ENV'] = environment;
  defined['BLADE_ENV'] = environment;

  // This variable is used internally by BLADE to determine how much information should
  // be logged to the terminal.
  defined['__BLADE_DEBUG_LEVEL'] = isLoggingQueries ? 'verbose' : 'error';

  const mapped = Object.entries(defined).map(([key, value]) => {
    return [`import.meta.env.${key}`, JSON.stringify(value)];
  });

  return Object.fromEntries(mapped);
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

  const inputFile = Bun.file(styleInputFile);
  const input = (await inputFile.exists())
    ? await inputFile.text()
    : `@import 'tailwindcss';`;

  const basePath = isPackageLinked()
    ? path.join(process.cwd(), 'node_modules', '@ronin/blade')
    : process.cwd();
  const compiler = await compileTailwind(input, {
    onDependency(_path) {},
    base: basePath,
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
  await Bun.write(tailwindOutput, optimizedStyles.code);
};

export const isPackageLinked = () => {
  const packagePath = path.join(process.cwd(), 'node_modules', '@ronin/blade');
  try {
    return fs.lstatSync(packagePath).isSymbolicLink();
  } catch {
    return false;
  }
};
