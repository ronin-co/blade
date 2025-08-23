import path from 'node:path';
import resolveFrom from 'resolve-from';
import { aliasPlugin } from 'rolldown/experimental';

import { nodePath, sourceDirPath } from '@/private/shell/constants';
import { type VirtualFileItem, composeBuildContext } from '@/private/shell/utils/build';

const makePathAbsolute = (input: string) => {
  if (input.startsWith('./')) return input.slice(1);
  if (input.startsWith('/')) return input;
  return `/${input}`;
};

type TypeScriptConfig = { compilerOptions?: { paths?: Record<string, string[]> } };

/**
 * Composes a list of aliases for the `aliasPlugin` from a `tsconfig.json` file.
 *
 * @param config - The content of a `tsconfig.json` file.
 *
 * @returns A list of aliases.
 */
export const composeAliases = (config: string): Parameters<typeof aliasPlugin>[0] => {
  const content = JSON.parse(config) as TypeScriptConfig;
  const paths = content?.compilerOptions?.paths || {};

  const entries = Object.entries(paths).flatMap(([key, targets]) => {
    const hasStar = key.includes('*');
    const find = hasStar ? new RegExp(`^${reEscape(key).replace('\\*', '(.*)')}$`) : key;

    return targets.map((target) => {
      const base = makePathAbsolute(target);
      const replacement = hasStar ? base.replace('*', '$1') : base;

      return { find, replacement };
    });
  });

  return { entries };
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
  assetPrefix?: string;
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

  const tsconfig = virtualFiles.find((file) => file.path === '/tsconfig.json');

  return composeBuildContext(environment, {
    // Normalize file paths, so that all of them are absolute.
    virtualFiles,
    plugins: [
      ...(tsconfig ? [aliasPlugin(composeAliases(tsconfig.content))] : []),
      {
        name: 'Memory File Loader',
        resolveId: {
          filter: {
            id: { include: [/^\//], exclude: [ignoreStart] },
          },
          handler(id) {
            const rx = new RegExp(`^${reEscape(id)}(?:\\.(?:ts|tsx|js|jsx))?$`);
            const sourceFile = virtualFiles.find(({ path }) => rx.test(path));

            if (!sourceFile) return;

            return `virtual:${sourceFile.path}`;
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

            return {
              code: sourceFile.content,
              moduleType: path.extname(sourceFile.path).slice(1),
            };
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
    assetPrefix: config.assetPrefix,
  });
};
