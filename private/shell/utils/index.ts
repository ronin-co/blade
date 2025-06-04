import fs from 'node:fs';
import path from 'node:path';

import { cp, exists, readdir, rm } from 'node:fs/promises';
import {
  compile as compileTailwind,
  optimize as optimizeTailwind,
} from '@tailwindcss/node';
import { Scanner as TailwindScanner } from '@tailwindcss/oxide';
import type { BuildOutput, Transpiler } from 'bun';
import ora from 'ora';

import {
  clientInputFile,
  clientManifestFile,
  directoriesToParse,
  frameworkDirectory,
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
  routerInputFile,
  styleInputFile,
} from '@/private/shell/constants';
import {
  getClientChunkLoader,
  getClientComponentLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '@/private/shell/loaders';
import type { ClientChunks, FileError } from '@/private/shell/types';
import { getProvider } from '@/private/shell/utils/providers';
import type { DeploymentProvider } from '@/private/universal/types/util';
import { CLIENT_ASSET_PREFIX } from '@/private/universal/utils/constants';
import { generateUniqueId } from '@/private/universal/utils/crypto';
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

  return `try {
    Object.defineProperties(
      ${internalName}.$$typeof === REACT_FORWARD_REF_TYPE ? ${internalName}.render : ${internalName},
      {
        $$typeof: { value: CLIENT_REFERENCE },
        name: { value: '${externalName}' },
        chunk: { value: '${chunk.id}' },
        id: { value: '${chunk.path}' }
      }
    );
  } catch (err) {}`;
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

// Collect the list of variables that will automatically be replaced in the client and
// server bundles.
export const setEnvironmentVariables = (options: {
  isBuilding: boolean;
  isServing: boolean;
  isLoggingQueries: boolean;
  port: number;
  projects: string[];
}) => {
  if (import.meta.env['BLADE_ENV']) {
    let message = `${loggingPrefixes.error} The \`BLADE_ENV\` environment variable is provided by BLADE`;
    message += ` and cannot be overwritten. Using the \`blade\` command for "development"`;
    message += ` and \`blade build\` for "production" will automatically infer the value.`;
    console.error(message);
    process.exit(0);
  }

  // Get the current provider based on the environment variables.
  const provider = getProvider();
  import.meta.env.__BLADE_PROVIDER = provider;

  if (provider === 'cloudflare') {
    import.meta.env['BLADE_APP_TOKEN'] ??= '';
    import.meta.env['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['CF_PAGES_BRANCH'] ?? '';
    import.meta.env['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['CF_PAGES_COMMIT_SHA'] ?? '';
  }

  if (provider === 'vercel') {
    import.meta.env['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['VERCEL_GIT_COMMIT_REF'];
    import.meta.env['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['VERCEL_GIT_COMMIT_SHA'];
  }

  import.meta.env.BLADE_DATA_WORKER ??= 'https://data.ronin.co';
  import.meta.env.BLADE_STORAGE_WORKER ??= 'https://storage.ronin.co';

  // Used by dependencies and the application itself to understand which environment the
  // application is currently running in.
  const environment =
    options.isBuilding || options.isServing ? 'production' : 'development';
  import.meta.env['NODE_ENV'] = environment;
  import.meta.env['BUN_ENV'] = environment;
  import.meta.env['BLADE_ENV'] = environment;

  // This variable is used internally by BLADE to determine how much information should
  // be logged to the terminal.
  import.meta.env['__BLADE_DEBUG_LEVEL'] = options.isLoggingQueries ? 'verbose' : 'error';

  // The port on which the development server or production server will run. It is
  // determined outside the actual worker script because it should remain the same
  // whenever the worker script is re-evaluated during development.
  import.meta.env['__BLADE_PORT'] = String(options.port);

  // The directories that contain the source code of the application.
  import.meta.env['__BLADE_PROJECTS'] = JSON.stringify(options.projects);
};

export const getClientEnvironmentVariables = () => {
  const filteredVariables = Object.entries(import.meta.env).filter(([key]) => {
    return key.startsWith('BLADE_PUBLIC_') || key === 'BLADE_ENV';
  });

  return Object.fromEntries(filteredVariables);
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
 * Prints the logs of a build to the terminal, since Bun doesn't do that automatically.
 *
 * @param output A build output object.
 */
export const handleBuildLogs = (output: BuildOutput) => {
  for (const log of output.logs) {
    // Bun logs a warning when it encounters a `sideEffects` property in `package.json`
    // containing a glob (a wildcard), because Bun doesn't support those yet. We want to
    // silence this warning, unless it is requested to be logged explicitly.
    if (
      log.message.includes('wildcard sideEffects') &&
      Bun.env['__BLADE_DEBUG_LEVEL'] !== 'verbose'
    )
      return;

    // Print the log to the terminal.
    console.log(log);
  }
};

export const prepareClientAssets = async (
  environment: 'development' | 'production',
  provider?: DeploymentProvider,
) => {
  const bundleId = generateUniqueId();

  const clientSpinner = logSpinner(
    `Performing client build${environment === 'production' ? ' (production)' : ''}`,
  ).start();

  const clientChunks: ClientChunks = {};
  const clientEnvironmentVariables = Object.entries(getClientEnvironmentVariables()).map(
    ([key, value]) => {
      return [`import.meta.env.${key}`, JSON.stringify(value)];
    },
  );

  const outdir = path.join(outputDirectory, CLIENT_ASSET_PREFIX);
  const projects = JSON.parse(import.meta.env['__BLADE_PROJECTS']) as string[];

  const output = await Bun.build({
    entrypoints: [clientInputFile],
    outdir,
    plugins: [
      getClientComponentLoader(projects),
      getClientChunkLoader(clientChunks),
      getMdxLoader(environment),
      getReactAriaLoader(),
    ],
    sourcemap: 'external',
    target: 'browser',
    naming: path.basename(getOutputFile(bundleId, 'js')),
    minify: environment === 'production',
    // When using a serverless deployment provider, inline plain-text environment
    // variables in the client bundles.
    define: provider ? Object.fromEntries(clientEnvironmentVariables) : undefined,
  });

  await Bun.write(clientManifestFile, JSON.stringify(clientChunks, null, 2));

  handleBuildLogs(output);

  const chunkFile = Bun.file(path.join(outputDirectory, getOutputFile(bundleId, 'js')));

  const chunkFilePrefix = [
    provider ? 'if(!import.meta.env){import.meta.env={}};' : '',
    `if(!window['BLADE_CHUNKS']){window['BLADE_CHUNKS']={}};`,
    `window['BLADE_BUNDLE']='${bundleId}';`,
    await chunkFile.text(),
  ].join('');

  await Bun.write(chunkFile, chunkFilePrefix);

  await prepareStyles(environment, projects, bundleId);

  // Copy hard-coded static assets into output directory.
  if (await exists(publicDirectory))
    await cp(publicDirectory, outputDirectory, { recursive: true });

  import.meta.env['__BLADE_ASSETS'] = JSON.stringify([
    { type: 'js', source: getOutputFile(bundleId, 'js') },
    { type: 'css', source: getOutputFile(bundleId, 'css') },
  ]);

  import.meta.env['__BLADE_ASSETS_ID'] = bundleId;

  clientSpinner.succeed();
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
const prepareStyles = async (
  environment: 'development' | 'production',
  projects: Array<string>,
  bundleId: string,
) => {
  // Consider the directories containing the source code of the application.
  const content = ['pages', 'components', 'contexts'].flatMap((directory) => {
    return projects.map((project) => path.join(project, directory));
  });

  // Consider the directory containing BLADE's component source code.
  content.push(path.join(frameworkDirectory, 'private', 'client', 'components'));

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

export const elevateReact = async () => {
  if (isPackageLinked()) {
    const sourceReact = path.join(
      process.cwd(),
      'node_modules',
      '@ronin/blade',
      'node_modules',
      'react',
    );
    const sourceReactDom = path.join(
      process.cwd(),
      'node_modules',
      '@ronin/blade',
      'node_modules',
      'react-dom',
    );
    const targetReact = path.join(process.cwd(), 'node_modules', 'react');
    const targetReactDom = path.join(process.cwd(), 'node_modules', 'react-dom');

    // Remove existing directories if they exist.
    await rm(targetReact, { recursive: true, force: true });
    await rm(targetReactDom, { recursive: true, force: true });

    // Copy the directories.
    await cp(sourceReact, targetReact, { recursive: true });
    await cp(sourceReactDom, targetReactDom, { recursive: true });
  }
};

export const isPackageLinked = () => {
  const packagePath = path.join(process.cwd(), 'node_modules', '@ronin/blade');
  try {
    return fs.lstatSync(packagePath).isSymbolicLink();
  } catch (error) {
    return false;
  }
};
