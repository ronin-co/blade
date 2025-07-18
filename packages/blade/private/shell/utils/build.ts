import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as esbuild from 'esbuild';

import {
  clientInputFile,
  defaultDeploymentProvider,
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
} from '@/private/shell/loaders';
import { composeEnvironmentVariables, exists } from '@/private/shell/utils';
import { getProvider } from '@/private/shell/utils/providers';
import { getOutputFile } from '@/private/universal/utils/paths';

export const build = async (
  environment: 'development' | 'production',
  options?: {
    enableServiceWorker?: boolean;
    logQueries?: boolean;
    plugins?: Array<esbuild.Plugin>;
  },
): Promise<esbuild.BuildContext> => {
  const provider = getProvider();
  const projects = [process.cwd()];
  const tsConfig = path.join(process.cwd(), 'tsconfig.json');

  // If a `tsconfig.json` file exists that contains a `references` field, we should include
  // files from the referenced projects as well.
  if (await exists(tsConfig)) {
    const tsConfigContents = JSON.parse(await readFile(tsConfig, 'utf-8'));
    const { references } = tsConfigContents || {};

    if (references && Array.isArray(references) && references.length > 0) {
      projects.push(
        ...references.map((reference) => path.join(process.cwd(), reference.path)),
      );
    }
  }

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
    platform: provider === 'vercel' ? 'node' : 'browser',
    format: 'esm',
    jsx: 'automatic',
    nodePaths: [path.join(process.cwd(), 'node_modules')],
    minify: environment === 'production',
    // TODO: Remove this once `@ronin/engine` no longer relies on it.
    external: ['node:events'],
    plugins: [
      getFileListLoader(projects),
      getMdxLoader(environment),
      getReactAriaLoader(),
      getClientReferenceLoader(),
      getMetaLoader(environment, projects),
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
