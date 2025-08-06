import path from 'node:path';
import type { BuildOptions, BuildResult, Loader } from 'esbuild';

import { build as buildContext } from '@/private/shell/utils/build';

interface SourceFile {
  /**
   * The path of the file, relative to the project root. For example, when providing a
   * page, its path might be `pages/index.tsx`.
   */
  path: string;
  /** The content of the file, as a string. */
  content: string;
}
interface BuildConfig {
  sourceFiles: Array<SourceFile>;
  environment?: 'development' | 'production';
}

interface BuildOutput
  extends Pick<BuildResult<BuildOptions>, 'errors' | 'warnings' | 'outputFiles'> {}

export const build = async (config: BuildConfig): Promise<BuildOutput> => {
  const environment = config?.environment || 'development';

  const mainBuild = await buildContext(environment, {
    plugins: [
      {
        name: 'Memory Loader',
        setup(build) {
          const rawLoaders = ['js', 'jsx', 'ts', 'tsx', 'json'];

          build.onResolve({ filter: /.*/ }, (args) => {
            // Entry points should be loaded from disk.
            if (args.kind === 'entry-point') return;

            // Turn "./message.txt" into an absolute key "/src/message.txt"
            const resolved = args.path.startsWith('.')
              ? path.join(args.resolveDir, args.path)
              : args.path;
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
