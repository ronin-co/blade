import path from 'node:path';
import {
  type ChunkFileNamesFunction,
  type OutputOptions,
  type RolldownOutput,
  type Plugin as RolldownPlugin,
  rolldown,
} from 'rolldown';

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
import { composeEnvironmentVariables, exists } from '@/private/shell/utils';
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
 * Prepares a Rolldown build context for building a Blade application.
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
  rebuild: () => Promise<RolldownOutput>;
}> => {
  const provider = getProvider();

  // Build inputs
  const serveEntry = path.join(serverInputFolder, `${provider}.js`);
  const swEntry = path.join(serverInputFolder, 'service-worker.js');

  const tsconfigFilename = path.join(process.cwd(), 'tsconfig.json');

  const input: Record<string, string> = {
    client: clientInputFile,
    provider: serveEntry,
  };

  if (options?.enableServiceWorker) input['service_worker'] = swEntry;

  // Banner to ensure import.meta.env exists
  const banner = 'if(!import.meta.env){import.meta.env={}};';

  const bundle = await rolldown({
    input,
    resolve: {
      modules: [nodePath],
      tsconfigFilename: (await exists(tsconfigFilename)) ? tsconfigFilename : undefined,

      // When linking the framework package, rolldown doesn't recognize these dependencies
      // correctly, so we have to alias them explicitly.
      alias: {
        react: path.join(nodePath, 'react'),
        'react-dom': path.join(nodePath, 'react-dom'),
      },
    },

    // TODO: Remove this once `@ronin/engine` no longer relies on it.
    external: ['node:events'],

    plugins: [
      getFileListLoader(options?.virtualFiles),
      getMdxLoader(environment),
      getReactAriaLoader(),
      getClientReferenceLoader(),
      getTailwindLoader(environment, options?.virtualFiles),
      getMetaLoader(Boolean(options?.virtualFiles)),
      getProviderLoader(environment, provider),
      ...(options?.plugins || []),
    ],

    define: composeEnvironmentVariables({
      isLoggingQueries: options?.logQueries || false,
      enableServiceWorker: options?.enableServiceWorker || false,
      provider,
      environment,
    }),
  });

  return {
    async rebuild(): Promise<RolldownOutput> {
      const entryFileNames: ChunkFileNamesFunction = (chunk) => {
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

      const outputOptions: OutputOptions = {
        dir: outputDirectory,
        format: 'es' as const,
        sourcemap: true,
        entryFileNames,
        banner,
      };

      return options?.virtualFiles
        ? bundle.generate(outputOptions)
        : bundle.write(outputOptions);
    },
  };
};
