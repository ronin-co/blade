import resolveFrom from 'resolve-from';

import { nodePath, sourceDirPath } from '@/private/shell/constants';
import { type VirtualFileItem, composeBuildContext } from '@/private/shell/utils/build';

const makePathAbsolute = (input: string) => {
  if (input.startsWith('./')) return input.slice(1);
  if (input.startsWith('/')) return input;
  return `/${input}`;
};

// Tiny helpers for safe, cross-platform matching.
const reEscape = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toPosix = (input: string) => input.replace(/\\/g, '/');

const ignoreStart = new RegExp(
  `^(?:${[nodePath, sourceDirPath].map((p) => reEscape(toPosix(p))).join('|')})`,
);

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
        name: 'Memory File Loader',
        resolveId: {
          filter: {
            id: { include: [/^\//], exclude: [ignoreStart] },
          },
          handler(id) {
            return `virtual:${id}`;
          },
        },
        load: {
          filter: {
            id: /^virtual:/,
          },
          handler(id) {
            const absolutePath = id.replace('virtual:', '');
            const sourceFile = virtualFiles.find(({ path }) => path === absolutePath);
            if (!sourceFile) return;
            return sourceFile.content;
          },
        },
      },
      {
        name: 'Memory Dependency Loader',
        resolveId: {
          filter: {
            id: [/^[\w@][\w./-]*$/],
          },
          handler(id) {
            return resolveFrom(nodePath, id);
          },
        },
      },
    ],
  });
};
