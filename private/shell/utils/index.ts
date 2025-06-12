import fs from 'node:fs';
import { cp, exists, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  compile as compileTailwind,
  optimize as optimizeTailwind,
} from '@tailwindcss/node';
import { Scanner as TailwindScanner } from '@tailwindcss/oxide';
import type { Transpiler } from 'bun';
import * as esbuild from 'esbuild';
import ora from 'ora';

import {
  clientInputFile,
  clientOutputDirectory,
  defaultDeploymentProvider,
  directoriesToParse,
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
  routerInputFile,
  serverInputFolder,
  styleInputFile,
} from '@/private/shell/constants';
import { getMdxLoader, getReactAriaLoader } from '@/private/shell/loaders';
import type { FileError } from '@/private/shell/types';
import {
  getProvider,
  mapProviderInlineDefinitions,
  transformToCloudflareOutput,
  transformToNetlifyOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';
import type { Asset, DeploymentProvider } from '@/private/universal/types/util';
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
  enableServiceWorker: boolean;
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
  import.meta.env.__BLADE_SERVICE_WORKER = options.enableServiceWorker ? 'true' : 'false';

  if (provider === 'cloudflare') {
    import.meta.env['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['CF_PAGES_BRANCH'] ?? '';
    import.meta.env['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['CF_PAGES_COMMIT_SHA'] ?? '';
  }

  if (provider === 'netlify') {
    import.meta.env['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['BRANCH'] ?? '';
    import.meta.env['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['COMMIT_REF'] ?? '';
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
 * Prints the logs of a build to the terminal.
 *
 * @param output A build output object.
 */
export const handleBuildLogs = (output: esbuild.BuildResult) => {
  console.log(output);
};

export const prepareClientAssets = async (
  environment: 'development' | 'production',
  bundleId: string,
  provider: DeploymentProvider,
) => {
  const clientSpinner = logSpinner(
    `Performing client build${environment === 'production' ? ' (production)' : ''}`,
  ).start();

  const clientEnvironmentVariables = Object.entries(getClientEnvironmentVariables()).map(
    ([key, value]) => {
      return [`import.meta.env.${key}`, JSON.stringify(value)];
    },
  );

  const projects = JSON.parse(import.meta.env['__BLADE_PROJECTS']) as string[];
  const isDefaultProvider = provider === defaultDeploymentProvider;
  const enableServiceWorker = import.meta.env.__BLADE_SERVICE_WORKER === 'true';

  const output = await esbuild.build({
    entryPoints: [clientInputFile],
    outdir: clientOutputDirectory,
    plugins: [getMdxLoader(environment), getReactAriaLoader()],
    sourcemap: 'external',
    entryNames: path.basename(getOutputFile(bundleId)),
    minify: environment === 'production',
    // When using a serverless deployment provider, inline plain-text environment
    // variables in the client bundles.
    define: isDefaultProvider
      ? undefined
      : Object.fromEntries(clientEnvironmentVariables),
  });

  handleBuildLogs(output);

  const chunkFile = Bun.file(path.join(outputDirectory, getOutputFile(bundleId, 'js')));

  const chunkFilePrefix = [
    isDefaultProvider ? '' : 'if(!import.meta.env){import.meta.env={}};',
    `if(!window['BLADE_CHUNKS']){window['BLADE_CHUNKS']={}};`,
    `window['BLADE_BUNDLE']='${bundleId}';`,
    await chunkFile.text(),
  ].join('');

  await Bun.write(chunkFile, chunkFilePrefix);

  await prepareStyles(environment, projects, bundleId);

  // Copy hard-coded static assets into output directory.
  if (await exists(publicDirectory))
    await cp(publicDirectory, outputDirectory, { recursive: true });

  const assets = new Array<Asset>(
    { type: 'js', source: getOutputFile(bundleId, 'js') },
    { type: 'css', source: getOutputFile(bundleId, 'css') },
  );

  // In production, load the service worker script.
  if (enableServiceWorker) {
    assets.push({ type: 'worker', source: '/service-worker.js' });
  }

  import.meta.env['__BLADE_ASSETS'] = JSON.stringify(assets);
  import.meta.env['__BLADE_ASSETS_ID'] = bundleId;

  clientSpinner.succeed();
};

export const prepareServerAssets = async (provider: DeploymentProvider) => {
  const serverSpinner = logSpinner('Performing server build (production)').start();

  const buildEntrypoint = async (provider: DeploymentProvider): Promise<void> => {
    const output = await esbuild.build({
      entryPoints: [path.join(serverInputFolder, `${provider}.js`)],
      outdir: outputDirectory,
      plugins: [
        // getClientReferenceLoader('production'),
        // getFileListLoader(),
        // getMdxLoader('production'),
        // getReactAriaLoader(),
      ],
      entryNames: `[dir]/${provider.endsWith('-worker') ? provider : defaultDeploymentProvider}`,
      minify: true,
      sourcemap: 'external',
      target: provider === 'vercel' ? 'node' : 'esnext',
      define: mapProviderInlineDefinitions(provider),
    });

    handleBuildLogs(output);
  };

  await Promise.all([buildEntrypoint(provider), buildEntrypoint('service-worker')]);

  serverSpinner.succeed();

  switch (provider) {
    case 'cloudflare': {
      await transformToCloudflareOutput();
      break;
    }
    case 'netlify': {
      await transformToNetlifyOutput();
      break;
    }
    case 'vercel': {
      await transformToVercelBuildOutput();
      break;
    }
  }
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
