import path from 'node:path';
import resolveFrom from 'resolve-from';
import { aliasPlugin } from 'rolldown/experimental';

import { nodePath, sourceDirPath } from '@/private/shell/constants';
import { type VirtualFileItem, composeBuildContext } from '@/private/shell/utils/build';

const DEPENDENCY_CACHE = new Map<string, string>();

/**
 * Resolves a relative or absolute import path relative to a CDN URL.
 *
 * @param importPath - The import path (e.g., './utils', '../foo', or 'lodash').
 * @param baseUrl - The base URL to resolve against (e.g., 'https://unpkg.com/react@18.2.0/index.js').
 *
 * @returns The resolved absolute URL.
 */
const resolveImportPath = (importPath: string, baseUrl: string): string => {
  if (importPath.startsWith('http://') || importPath.startsWith('https://'))
    return importPath;

  if (importPath.startsWith('./') || importPath.startsWith('../'))
    return new URL(importPath, baseUrl).href;

  return `https://unpkg.com/${importPath}`;
};

/**
 * Detects the module type from the URL or content.
 *
 * @param url - The URL of the module.
 *
 * @returns The module type ('js', 'jsx', 'ts', or 'tsx').
 */
const detectModuleType = (url: string): 'js' | 'jsx' | 'ts' | 'tsx' => {
  const urlPath = new URL(url).pathname;
  if (urlPath.endsWith('.tsx')) return 'tsx';
  if (urlPath.endsWith('.ts')) return 'ts';
  if (urlPath.endsWith('.jsx')) return 'jsx';
  return 'js';
};

/**
 * Fetches a dependency from a CDN.
 *
 * @param url - The full URL to fetch (e.g., 'https://unpkg.com/react@18.2.0').
 *
 * @returns An object containing the content and the final resolved URL (after redirects).
 */
const fetchFromCDN = async (
  url: string,
): Promise<{
  content: string;
  finalUrl: string;
} | null> => {
  try {
    if (DEPENDENCY_CACHE.has(url))
      return {
        content: DEPENDENCY_CACHE.get(url)!,
        finalUrl: url,
      };

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${url} from CDN: ${response.status}`);
      return null;
    }

    const finalUrl = response.url;
    const content = await response.text();

    DEPENDENCY_CACHE.set(url, content);
    DEPENDENCY_CACHE.set(finalUrl, content);

    return {
      content,
      finalUrl,
    };
  } catch (error) {
    console.warn(`Error fetching ${url} from CDN:`, error);
    return null;
  }
};

/**
 * Set of dependencies that should not be fetched from CDN.
 * These are resolved from local node_modules via aliases.
 */
const EXCLUDED_DEPENDENCIES = new Set([
  // React server context's can conflict if multiple versions are loaded
  'react',
  'react-dom',
  'scheduler',
]);

/**
 * Checks if an import ID or importer path is from an excluded dependency.
 *
 * @param id - The import ID or importer path to check.
 *
 * @returns True if the ID is from an excluded dependency.
 */
const isExcludedDependency = (id: string): boolean => {
  if (EXCLUDED_DEPENDENCIES.has(id)) return true;

  for (const excluded of EXCLUDED_DEPENDENCIES) {
    if (id.startsWith(`${excluded}/`)) return true;

    // Check if path contains the excluded dependency (handles node_modules paths)
    if (id.includes(`/${excluded}/`) || id.includes(`\\${excluded}\\`)) return true;
  }

  return false;
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
            // Skip blade/* imports - these are framework internals, not external CDN deps
            if (id.startsWith('blade/')) {
              try {
                return resolveFrom(nodePath, id);
              } catch (error) {
                console.warn(
                  `Failed to resolve ${id} from node_modules, falling back to default resolution`,
                  error,
                );
                return null;
              }
            }

            // Skip excluded dependencies (React, etc.) - these are resolved via aliases from node_modules
            if (isExcludedDependency(id)) return null;

            // Skip imports that look like rolldown-generated chunk files (contain hash patterns like -BYv80wED)
            // These are internal framework chunks, not npm packages
            if (/-[A-Za-z0-9_-]{8,}\.js$/.test(id)) return null;

            // Skip relative imports from excluded dependencies (e.g., React's internal ./cjs/... imports)
            // These should be resolved normally by Rolldown from node_modules
            if (
              importer &&
              (id.startsWith('./') || id.startsWith('../')) &&
              isExcludedDependency(importer)
            )
              return null;

            // If the importer is a CDN module, resolve relative to it
            if (importer?.startsWith('cdn:')) {
              const importerUrl =
                DEPENDENCY_CACHE.get(importer) || importer.replace('cdn:', '');
              const resolvedUrl = resolveImportPath(id, importerUrl);
              return `cdn:${resolvedUrl}`;
            }

            // Only resolve bare imports that look like actual npm packages
            // npm package names: can start with @ (scoped), or letter, contain letters/numbers/-/_
            // Reject if it looks like an internal chunk (has .js extension without /node_modules/)
            if (id.endsWith('.js') && !id.includes('/')) return null;

            const resolvedUrl = resolveImportPath(id, 'https://unpkg.com/');
            return `cdn:${resolvedUrl}`;
          },
        },
        load: {
          filter: {
            id: /^cdn:/,
          },
          async handler(id) {
            const url = id.replace('cdn:', '');

            const result = await fetchFromCDN(url);
            if (!result) throw new Error(`Failed to fetch dependency: ${url}`);

            DEPENDENCY_CACHE.set(id, result.finalUrl);

            return {
              code: result.content,
              moduleType: detectModuleType(result.finalUrl),
            };
          },
        },
      },
    ],
    assetPrefix: config.assetPrefix,
  });
};
