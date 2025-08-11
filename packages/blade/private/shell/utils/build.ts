import path from 'node:path';
import {
  type OutputAsset,
  type OutputChunk,
  type Plugin as RolldownPlugin,
  type RollupBuild,
  rollup,
} from 'rolldown';

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
  getTailwindLoader,
} from '@/private/shell/loaders';
import { composeEnvironmentVariables } from '@/private/shell/utils';
import { getProvider } from '@/private/shell/utils/providers';
import { getOutputFile } from '@/private/universal/utils/paths';

export interface VirtualFileItem {
  /**
   * The path of the file, relative to the project root. For example, when providing a
   * page, its path might be `/pages/index.tsx`.
   */
  path: string;
  /** The content of the file, as a string. */
  content: string;
}

/**
 * Prepares a Rolldown-powered build context for building a Blade application.
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
export const composeBuildContext = async (
  environment: 'development' | 'production',
  options?: {
    enableServiceWorker?: boolean;
    logQueries?: boolean;
    plugins?: Array<RolldownPlugin>;
    virtualFiles?: Array<VirtualFileItem>;
  },
): Promise<{
  rebuild: () => Promise<{
    errors: Array<unknown>;
    warnings: Array<unknown>;
    outputFiles?: Array<{
      path: string;
      contents: Uint8Array;
      readonly text: string;
      hash?: string;
    }>;
  }>;
  dispose: () => Promise<void>;
}> => {
  const provider = getProvider();

  // Build inputs
  const serveEntry = path.join(serverInputFolder, `${provider}.js`);
  const swEntry = path.join(serverInputFolder, 'service-worker.js');

  const input: Record<string, string> = {
    client: clientInputFile,
    provider: serveEntry,
  };

  if (options?.enableServiceWorker) input['service_worker'] = swEntry;

  // Define replacement plugin (simple string replacement for import.meta.env and NODE_ENV)
  const defineMap = composeEnvironmentVariables({
    isLoggingQueries: options?.logQueries || false,
    enableServiceWorker: options?.enableServiceWorker || false,
    provider,
    environment,
  });

  const definePlugin: RolldownPlugin = {
    name: 'blade-define-replacements',
    transform(code: string) {
      let transformed = code;
      for (const [key, value] of Object.entries(defineMap)) {
        // naive replace is acceptable for explicit keys like import.meta.env.X and process.env.NODE_ENV
        transformed = transformed.split(key).join(value);
      }
      return { code: transformed, map: null };
    },
  };

  // Banner to ensure import.meta.env exists
  const banner = 'if(!import.meta.env){import.meta.env={}};';

  const plugins: Array<RolldownPlugin> = [
    getFileListLoader(options?.virtualFiles),
    getMdxLoader(environment),
    getReactAriaLoader(),
    getClientReferenceLoader(),
    getTailwindLoader(environment, options?.virtualFiles),
    getMetaLoader(Boolean(options?.virtualFiles)),
    getProviderLoader(environment, provider),
    definePlugin,
    ...(options?.plugins || []),
  ];

  // Keep cache between rebuilds for faster dev builds
  let previousBundle: RollupBuild | null = null;

  const writeToDisk = !options?.virtualFiles;

  return {
    async rebuild() {
      const bundle = await rollup({
        input,
        plugins,
        // external dependencies
        external: ['node:events'],
        cache: previousBundle ?? undefined,
      });

      previousBundle = bundle;

      const entryFileNames = (chunk: OutputChunk) => {
        // client entry gets our fixed init name to be renamed later by meta loader
        if (chunk.facadeModuleId === clientInputFile) {
          return getOutputFile('init', 'js');
        }
        // provider entry should be the default deployment provider filename
        if (chunk.facadeModuleId === serveEntry) {
          return `${defaultDeploymentProvider}.js`;
        }
        // service worker
        if (options?.enableServiceWorker && chunk.facadeModuleId === swEntry) {
          return 'service-worker.js';
        }
        return '[name].js';
      };

      const outputOptions = {
        dir: outputDirectory,
        format: 'es' as const,
        sourcemap: true,
        entryFileNames,
        banner,
      };

      if (writeToDisk) {
        await bundle.write(outputOptions);
        return { errors: [], warnings: [] };
      }

      const generated = await bundle.generate(outputOptions);

      // Adapt to esbuild-like output files API
      const outputFiles = (generated.output as Array<OutputChunk | OutputAsset>).flatMap(
        (item) => {
          if (item.type === 'chunk') {
            const text = item.code;
            const contents = new TextEncoder().encode(text);
            return [
              {
                path: path.join(outputDirectory, (item as OutputChunk).fileName),
                contents,
                get text() {
                  return text;
                },
                hash: 'noop',
              },
            ];
          }
          {
            const source = (item as OutputAsset).source as string | Uint8Array;
            const text =
              typeof source === 'string' ? source : new TextDecoder().decode(source);
            const contents =
              typeof source === 'string' ? new TextEncoder().encode(source) : source;
            return [
              {
                path: path.join(outputDirectory, (item as OutputAsset).fileName),
                contents,
                get text() {
                  return text;
                },
                hash: 'noop',
              },
            ];
          }
        },
      );

      return { errors: [], warnings: [], outputFiles };
    },
    async dispose() {
      // Rolldown/Rollup bundles are closed per build; nothing persistent to dispose here
      previousBundle = null;
      await Promise.resolve();
    },
  };
};
