import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  type OutputOptions,
  type RolldownOutput,
  type Plugin as RolldownPlugin,
  rolldown,
} from 'rolldown';

import {
  clientInputFile,
  nodePath,
  outputDirectory,
  packageMetaFilename,
  serverInputFolder,
  tsconfigFilename,
} from '@/private/shell/constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getProviderLoader,
  getReactAriaLoader,
  getTailwindLoader,
} from '@/private/shell/loaders';
import { composeEnvironmentVariables, exists } from '@/private/shell/utils';
import { getProvider } from '@/private/shell/utils/providers';
import { generateUniqueId } from '@/private/universal/utils';
import { getPublicFile } from '@/private/universal/utils/paths';

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
 * @param [options.assetPrefix] - A custom URL prefix for static assets.
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
    assetPrefix?: string;

    plugins?: Array<RolldownPlugin>;
    virtualFiles?: Array<VirtualFileItem>;
    external?: Array<string | RegExp>;
  },
): Promise<{
  rebuild: () => Promise<RolldownOutput>;
  dispose: () => Promise<void>;
  active: boolean;
}> => {
  const provider = getProvider();

  // Build inputs
  const serverEntry = path.join(serverInputFolder, `${provider}.js`);
  const swEntry = path.join(serverInputFolder, 'service-worker.js');

  let tsconfigExists: boolean | undefined;
  let packageMetaFile: string | undefined;

  if (options?.virtualFiles) {
    const filePath = `/${path.basename(packageMetaFilename)}`;

    packageMetaFile = options?.virtualFiles?.find((item) => {
      return item.path === filePath;
    })?.content;
  } else {
    [tsconfigExists, packageMetaFile] = await Promise.all([
      exists(tsconfigFilename),
      readFile(packageMetaFilename, 'utf-8'),
    ]);
  }

  const packageMetaContent = packageMetaFile ? JSON.parse(packageMetaFile) : {};

  const input: Record<string, string> = {
    client: clientInputFile,
    'edge-worker': serverEntry,
  };

  if (options?.enableServiceWorker) input['service_worker'] = swEntry;

  /** Whether the build is currently running. */
  let running = false;

  const bundle = await rolldown({
    input,
    platform: provider === 'vercel' ? 'node' : 'browser',

    // If the provided files are virtual, we resolve the TS config paths using a
    // separate plugin on the outside.
    tsconfig: tsconfigExists ? tsconfigFilename : undefined,

    resolve: {
      // If the provided files are virtual, Rolldown can't reliably resolve the modules,
      // so we provide the resolving logic ourselves as a plugin from the outside.
      modules: options?.virtualFiles ? undefined : [nodePath],

      // When linking the framework package, Rolldown doesn't recognize these dependencies
      // correctly, so we have to alias them explicitly.
      alias: {
        react: path.join(nodePath, 'react'),
        'react-dom': path.join(nodePath, 'react-dom'),
      },
    },

    external: [
      ...(packageMetaContent?.blade?.external || []),
      ...(options?.external || []),

      // These dependencies cannot be inlined, since they make use of native modules.
      'hive/node-driver',
      'hive/bun-driver',
      'hive/disk-storage',
    ],

    plugins: [
      getFileListLoader(options?.virtualFiles),
      getMdxLoader(environment),
      getReactAriaLoader(),
      getClientReferenceLoader(),
      getTailwindLoader(environment),
      getProviderLoader(environment, provider),
      ...(options?.plugins || []),
    ],

    transform: {
      define: composeEnvironmentVariables({
        isLoggingQueries: options?.logQueries || false,
        enableServiceWorker: options?.enableServiceWorker || false,
        assetPrefix: options?.assetPrefix || null,
        provider,
        environment,
      }),
    },
  });

  return {
    async rebuild(): Promise<RolldownOutput> {
      // Mark the build as running. This must happen as early as possible.
      running = true;

      const bundleId = generateUniqueId();

      const outputOptions: OutputOptions = {
        dir: outputDirectory,
        sourcemap: true,
        banner: `if(!import.meta.env){import.meta.env={}};import.meta.env.__BLADE_BUNDLE_ID='${bundleId}';`,
        minify: environment === 'production',
        entryFileNames: (chunk) => {
          if (chunk.name === 'client') return getPublicFile(bundleId, 'js');
          return '[name].js';
        },
        assetFileNames: getPublicFile(bundleId, 'css'),
        chunkFileNames: getPublicFile(bundleId, 'js', true),
      };

      try {
        return options?.virtualFiles
          ? await bundle.generate(outputOptions)
          : await bundle.write(outputOptions);
      } finally {
        // Mark the build as no longer running. This must happen regardless of whether
        // the build failed or completed successfully.
        running = false;
      }
    },
    dispose: () => bundle.close(),

    // We're using a getter since the closure would otherwise cause an outdated value.
    get active() {
      return running;
    },
  };
};
