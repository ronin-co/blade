import { cp, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import * as esbuild from 'esbuild';

import {
  clientInputFile,
  defaultDeploymentProvider,
  outputDirectory,
  publicDirectory,
  serverInputFolder,
} from '@/private/shell/constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '@/private/shell/loaders';
import {
  composeEnvironmentVariables,
  exists,
  prepareStyles,
} from '@/private/shell/utils';
import {
  transformToCloudflareOutput,
  transformToNetlifyOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';
import type { DeploymentProvider } from '@/private/universal/types/util';
import { generateUniqueId } from '@/private/universal/utils/crypto';
import { getOutputFile } from '@/private/universal/utils/paths';

export const build = async (
  environment: 'development' | 'production',
  provider: DeploymentProvider,
  options?: {
    enableServiceWorker?: boolean;
    logQueries?: boolean;
    plugins?: Array<esbuild.Plugin>;
  },
): Promise<esbuild.BuildContext> => {
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

  let bundleId: string | undefined;

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
      getMdxLoader('production'),
      getReactAriaLoader(),
      getClientReferenceLoader(),
      {
        name: 'Init Loader',
        setup(build) {
          build.onStart(() => {
            bundleId = generateUniqueId();
          });

          build.onResolve({ filter: /^build-meta$/ }, (source) => ({
            path: source.path,
            namespace: 'dynamic-meta',
          }));

          build.onLoad({ filter: /^build-meta$/, namespace: 'dynamic-meta' }, () => ({
            contents: `export const bundleId = "${bundleId}";`,
            loader: 'ts',
            resolveDir: process.cwd(),
          }));

          build.onEnd(async (result) => {
            if (result.errors.length === 0) {
              const clientBundle = path.join(
                outputDirectory,
                getOutputFile('init', 'js'),
              );
              const clientSourcemap = path.join(
                outputDirectory,
                getOutputFile('init', 'js.map'),
              );

              await Promise.all([
                rename(clientBundle, clientBundle.replace('init.js', `${bundleId}.js`)),
                rename(
                  clientSourcemap,
                  clientSourcemap.replace('init.js.map', `${bundleId}.js.map`),
                ),
              ]);

              await prepareStyles(environment, projects, bundleId as string);
            }
          });
        },
      },
      {
        name: 'Provider Loader',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length > 0 || environment !== 'production') return;

            // Copy hard-coded static assets into output directory.
            if (await exists(publicDirectory)) {
              await cp(publicDirectory, outputDirectory, { recursive: true });
            }

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
          });
        },
      },
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
