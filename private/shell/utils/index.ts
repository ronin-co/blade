import path from 'node:path';

import { copyFile, cp, exists, mkdir, readdir, rm } from 'node:fs/promises';
import type { BuildOutput, Transpiler } from 'bun';
import ora from 'ora';

import { CLIENT_ASSET_PREFIX, DEFAULT_PAGE_PATH } from '../../universal/utils/constants';
import { generateUniqueId } from '../../universal/utils/crypto';
import { getOutputFile } from '../../universal/utils/paths';
import {
  clientManifestFile,
  directoriesToParse,
  frameworkDirectory,
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
} from '../constants';
import {
  getClientChunkLoader,
  getClientComponentLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '../loaders';
import type { ClientChunks, FileError } from '../types';
import { getProvider } from './providers';

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
    const keyName =
      directoryName === 'defaultPages'
        ? path.join(DEFAULT_PAGE_PATH, filePath)
        : filePath;

    if (filePath.endsWith('/')) {
      exportList[keyName.slice(0, filePath.length - 1)] = `'DIRECTORY'`;
    } else {
      importList.push(`import * as ${variableName} from '${filePathFull}';`);
      exportList[keyName] = variableName;
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

  let file = imports.join('\n\n');

  file += '\n\n';
  file += 'export const pages = { ...customPages, ...defaultPages };\n';
  file += 'export const triggers = { ...customTriggers };\n';

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

  if (Bun.env['CF_PAGES']) {
    import.meta.env['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['CF_PAGES_BRANCH'];
    import.meta.env['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['CF_PAGES_COMMIT_SHA'];
  }

  if (Bun.env['VERCEL']) {
    import.meta.env['BLADE_PUBLIC_GIT_BRANCH'] = Bun.env['VERCEL_GIT_COMMIT_REF'];
    import.meta.env['BLADE_PUBLIC_GIT_COMMIT'] = Bun.env['VERCEL_GIT_COMMIT_SHA'];
  }

  import.meta.env.BLADE_PUBLIC_SENTRY_DSN ??= '';
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

  // Get the current provider based on the environment variables.
  import.meta.env.__BLADE_PROVIDER = getProvider();
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
    // Bun logs a warning when it encounters a `sideTriggers` property in `package.json`
    // containing a glob (a wildcard), because Bun doesn't support those yet. We want to
    // silence this warning, unless it is requested to be logged explicitly.
    if (
      log.message.includes('wildcard sideTriggers') &&
      Bun.env['__BLADE_DEBUG_LEVEL'] !== 'verbose'
    )
      return;

    // Print the log to the terminal.
    console.log(log);
  }
};

export const prepareClientAssets = async (environment: 'development' | 'production') => {
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
    entrypoints: [require.resolve('../../client/assets/chunks.ts')],
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
    // On Cloudflare Pages, inline plain-text environment variables in the client bundles.
    define: Bun.env['CF_PAGES']
      ? Object.fromEntries(clientEnvironmentVariables)
      : undefined,
  });

  await Bun.write(clientManifestFile, JSON.stringify(clientChunks, null, 2));

  handleBuildLogs(output);

  const chunkFile = Bun.file(path.join(outputDirectory, getOutputFile(bundleId, 'js')));

  const chunkFilePrefix = [
    Bun.env['CF_PAGES'] ? 'if(!import.meta.env){import.meta.env={}};' : '',
    `if(!window['BLADE_CHUNKS']){window['BLADE_CHUNKS']={}};`,
    `window['BLADE_BUNDLE']='${bundleId}';`,
    await chunkFile.text(),
  ].join('');

  await Bun.write(chunkFile, chunkFilePrefix);

  const content = ['pages', 'components', 'contexts'].flatMap((directory) => {
    return projects.map((project) => `${path.join(project, directory)}/**/*.{ts,tsx}`);
  });

  // Consider the directory that contains BLADE's source code.
  content.push(`${frameworkDirectory}/private/**/*.{js,jsx}`);

  const tailwindPath = require.resolve('tailwindcss');
  const tailwindBinPath = path.join(
    tailwindPath.substring(0, tailwindPath.lastIndexOf('/node_modules/')),
    'node_modules/.bin/tailwindcss',
  );

  const tailwindProcess = Bun.spawn(
    [
      tailwindBinPath,
      '--input',
      path.join(__dirname, '../../client/assets/styles.css'),
      '--output',
      path.join(outputDirectory, getOutputFile(bundleId, 'css')),
      ...(environment === 'production' ? ['--minify'] : []),
      '--content',
      content.join(','),
    ],
    {
      // Don't write any input to the process.
      stdin: null,
      // Pipe useful logs that aren't errors to the terminal.
      stdout: 'inherit',
      // Tailwind prints non-error logs as errors, which we want to ignore.
      stderr: 'pipe',
      env: {
        ...import.meta.env,
        FORCE_COLOR: '3',
      },
      cwd: process.cwd(),
    },
  );
  if (environment === 'production') {
    const tailwindProcessExitCode = await tailwindProcess.exited;
    if (tailwindProcessExitCode !== 0) {
      clientSpinner.fail('Failed to build Tailwind CSS styles.');
      const { value } = await tailwindProcess.stderr.getReader().read();
      const errorMessage = new TextDecoder().decode(value);
      console.log(
        loggingPrefixes.error,
        errorMessage.replaceAll('\n', `\n${loggingPrefixes.error}`),
      );
      process.exit(1);
    }
  }

  const fontFileDirectory = path.join(
    path.dirname(require.resolve('@fontsource-variable/inter')),
    'files',
  );
  const fontFileOutputDirectory = path.join(outdir, 'files');
  const fontFiles = (await readdir(fontFileDirectory))
    .filter((file) => file.includes('wght-normal'))
    .map((file) => ({
      input: path.join(fontFileDirectory, file),
      output: path.join(fontFileOutputDirectory, file),
    }));

  // Copy hard-coded static assets into output directory.
  if (await exists(publicDirectory))
    await cp(publicDirectory, outputDirectory, { recursive: true });

  // Copy font files from font package.
  await mkdir(fontFileOutputDirectory);
  await Promise.all(fontFiles.map((file) => copyFile(file.input, file.output)));

  import.meta.env['__BLADE_ASSETS'] = JSON.stringify([
    { type: 'js', source: getOutputFile(bundleId, 'js') },
    ...fontFiles.map((file) => ({
      type: 'font',
      source: `/${path.relative(outputDirectory, file.output)}`,
    })),
    { type: 'css', source: getOutputFile(bundleId, 'css') },
  ]);

  import.meta.env['__BLADE_ASSETS_ID'] = bundleId;

  clientSpinner.succeed();
};
