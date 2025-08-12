import path from 'node:path';

import { type VirtualFileItem, composeBuildContext } from '@/private/shell/utils/build';

const makePathAbsolute = (input: string) => {
  if (input.startsWith('./')) return input.slice(1);
  if (input.startsWith('/')) return input;
  return `/${input}`;
};

interface BuildConfig {
  sourceFiles: Array<VirtualFileItem>;
  environment?: 'development' | 'production';
}

/**
 * Allows for performing an in-memory build.
 *
 * @param config - The configuration options for customizing the build behavior.
 *
 * @returns The generated build output in the form of virtual files.
 */
export const build = async (
  config: BuildConfig,
): Promise<ReturnType<typeof composeBuildContext>> => {
  const environment = config?.environment || 'development';

  const virtualFiles = config.sourceFiles.map(({ path, content }) => {
    return { path: makePathAbsolute(path), content };
  });

  return composeBuildContext(environment, {
    // Normalize file paths, so that all of them are absolute.
    virtualFiles,
    plugins: [
      {
        name: 'Memory Loader',
        resolveId(id, importer) {
          // Turn relative to absolute for virtual files.
          if (id.startsWith('.')) {
            const abs = path.join(path.dirname(importer || process.cwd()), id);
            if (virtualFiles.some((f) => f.path === abs)) return abs;
          }
          // Keep node_modules and framework files resolved by default resolver.
          return null;
        },
        load(id) {
          const sourceFile = virtualFiles.find((sourceFile) => sourceFile.path === id);
          if (!sourceFile) return null;
          return sourceFile.content;
        },
      },
    ],
  });
};
