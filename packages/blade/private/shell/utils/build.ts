import path from 'node:path';
import * as esbuild from 'esbuild';

import {
  clientInputFile,
  defaultDeploymentProvider,
  nodePath,
  outputDirectory,
  serverInputFolder,
} from '@/private/shell/constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getMetaLoader,
  getProviderLoader,
  getReactAriaLoader,
  getTailwindLoader,
} from '@/private/shell/loaders';
import { type VirtualFile, composeEnvironmentVariables } from '@/private/shell/utils';
import { getProvider } from '@/private/shell/utils/providers';
import { getOutputFile } from '@/private/universal/utils/paths';

/**
 * Prepares an `esbuild` context for building a Blade application.
 *
 * @param environment - The environment for which the build should run.
 * @param [options] - Optional configuration for running the build.
 * @param [options.enableServiceWorker] - Whether service workers should be enabled.
 * @param [options.logQueries] - Whether executed queries should be logged at runtime.
 * @param [options.plugins] - Optional additional esbuild plugins to add to the build.
 * @param [options.filePaths] - A list of all source file paths in the project. If the
 * list is not provided, the project directory will be crawled automatically.
 *
 * @returns An esbuild context.
 */
export const composeBuildContext = (
  environment: 'development' | 'production',
  options?: {
    enableServiceWorker?: boolean;
    logQueries?: boolean;
    plugins?: Array<esbuild.Plugin>;
    virtualFiles?: Array<VirtualFile>;
  },
): Promise<esbuild.BuildContext> => {
  const provider = getProvider();

  const entryPoints: esbuild.BuildOptions['entryPoints'] = [
    {
      in: clientInputFile,
      out: getOutputFile('init'),
    },
    {
      in: path.join(serverInputFolder, `${provider}.js`),
      out: defaultDeploymentProvider,
    },
  ];

  if (options?.enableServiceWorker) {
    entryPoints.push({
      in: path.join(serverInputFolder, 'service-worker.js'),
      out: 'service-worker',
    });
  }

  return esbuild.context({
    entryPoints,
    outdir: outputDirectory,
    sourcemap: 'external',
    bundle: true,

    // Return the files in memory if a list of source file paths was provided.
    write: !options?.virtualFiles,

    platform: provider === 'vercel' ? 'node' : 'browser',
    format: 'esm',
    jsx: 'automatic',
    nodePaths: [nodePath],
    minify: environment === 'production',

    // TODO: Remove this once `@ronin/engine` no longer relies on it.
    external: ['node:events'],

    plugins: [
      getFileListLoader(options?.virtualFiles),
      getMdxLoader(environment),
      getReactAriaLoader(),
      getClientReferenceLoader(),
      getTailwindLoader(environment),
      getMetaLoader(Boolean(options?.virtualFiles)),
      getProviderLoader(environment, provider),

      ...(options?.plugins || []),
    ],
    banner: {
      // Prevent a crash for missing environment variables by ensuring that
      // `import.meta.env` is defined.
      js: 'if(!import.meta.env){import.meta.env={}};',
    },
    define: composeEnvironmentVariables({
      isLoggingQueries: options?.logQueries || false,
      enableServiceWorker: options?.enableServiceWorker || false,
      provider,
      environment,
    }),
  });
};
