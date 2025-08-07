import path from 'node:path';
import type { Loader, Message, OutputFile } from 'esbuild';

import { nodePath, sourceDirPath } from '@/private/shell/constants';
import type { VirtualFileItem } from '@/private/shell/utils';
import { composeBuildContext } from '@/private/shell/utils/build';

interface BuildConfig {
  sourceFiles: Array<VirtualFileItem>;
  environment?: 'development' | 'production';
}

interface BuildOutput {
  errors: Array<Message>;
  warnings: Array<Message>;
  outputFiles: Array<OutputFile>;
}

/**
 * Allows for performing an in-memory build.
 *
 * @param config - The configuration options for customizing the build behavior.
 *
 * @returns The generated build output in the form of virtual files.
 */
export const build = async (config: BuildConfig): Promise<BuildOutput> => {
  const environment = config?.environment || 'development';

  const mainBuild = await composeBuildContext(environment, {
    // Normalize file paths, so that all of them are absolute.
    virtualFiles: config.sourceFiles.map(({ path, content }) => {
      const newPath = path.startsWith('./')
        ? path.slice(1)
        : path.startsWith('/')
          ? path
          : `/${path}`;
      return { path: newPath, content };
    }),
    plugins: [
      {
        name: 'Memory Loader',
        setup(build) {
          const rawLoaders = ['js', 'jsx', 'ts', 'tsx', 'json'];

          build.onResolve({ filter: /.*/ }, (args) => {
            // Turn relative paths into absolute ones.
            const resolved = args.path.startsWith('.')
              ? path.join(args.resolveDir, args.path)
              : args.path;

            if (
              // Load files in `node_modules` from disk.
              resolved.startsWith(nodePath) ||
              // Load framework source files from disk (framework might be linked).
              resolved.startsWith(sourceDirPath) ||
              // Load dependency imports from disk (like "react").
              !resolved.startsWith('/')
            ) {
              return;
            }

            return { path: resolved, namespace: 'memory' };
          });

          build.onLoad({ filter: /.*/, namespace: 'memory' }, (args) => {
            const sourceFile = config.sourceFiles.find((sourceFile) => {
              return sourceFile.path === args.path;
            });

            if (!sourceFile) {
              throw new Error(`No source file found for import "${args.path}".`);
            }

            const contents = sourceFile.content;
            const extension = path.extname(args.path).slice(1);
            const loader = (rawLoaders.includes(extension) ? extension : 'js') as Loader;

            return { contents, loader };
          });
        },
      },
    ],
  });

  const { errors, warnings, outputFiles } = await mainBuild.rebuild();
  return { errors, warnings, outputFiles };
};
