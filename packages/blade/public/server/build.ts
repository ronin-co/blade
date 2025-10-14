import path from 'node:path';
import { aliasPlugin } from 'rolldown/experimental';

import { nodePath, sourceDirPath } from '@/private/shell/constants';
import { type VirtualFileItem, composeBuildContext } from '@/private/shell/utils/build';

const dependencyCache = new Map<string, string>();

/**
 * Fetches a dependency from unpkg.com.
 *
 * @param packageName - The name of the package to fetch (e.g., 'react@18.2.0' or 'lodash').
 *
 * @returns The content of the package's main file.
 */
const fetchFromUnpkg = async (packageName: string): Promise<string | null> => {
  try {
    if (dependencyCache.has(packageName)) return dependencyCache.get(packageName)!;

    const url = new URL(`/${packageName}`, 'https://unpkg.com/');
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${packageName} from unpkg.com: ${response.status}`);
      return null;
    }

    const content = await response.text();

    dependencyCache.set(packageName, content);

    return content;
  } catch (error) {
    console.warn(`Error fetching ${packageName} from unpkg.com:`, error);
    return null;
  }
};

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
const composeAliases = (config: string): Parameters<typeof aliasPlugin>[0] => {
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
            id: [/^[\w@][\w./-]*$/, /^\.\.?\//],
          },
          handler(id, importer) {
            // Handle relative imports from unpkg modules
            if (importer?.startsWith('unpkg:') && id.startsWith('.')) {
              const importerPath = importer.replace('unpkg:', '');

              // Get the directory of the importer (remove the last segment if it's a file)
              const importerDir = importerPath.includes('/')
                ? importerPath.substring(0, importerPath.lastIndexOf('/') + 1)
                : `${importerPath}/`;

              const baseUrl = `https://unpkg.com/${importerDir}`;
              const resolvedPath = new URL(id, baseUrl).pathname.slice(1);
              return `unpkg:${resolvedPath}`;
            }

            // If it's a relative import not from unpkg, let other plugins handle it
            if (id.startsWith('.')) return undefined;

            // Use default Rolldown resolution for `blade/` imports
            if (id.startsWith('blade/')) return undefined;

            // All other npm packages are fetched from unpkg.com
            return `unpkg:${id}`;
          },
        },
        load: {
          filter: {
            id: /^unpkg:/,
          },
          async handler(id) {
            const packageName = id.replace('unpkg:', '');

            const content = await fetchFromUnpkg(packageName);
            if (!content) throw new Error(`Failed to fetch dependency: ${packageName}`);

            return {
              code: content,
              moduleType: 'js',
            };
          },
        },
      },
    ],
    assetPrefix: config.assetPrefix,
  });
};
