import path from 'node:path';
import resolveFrom from 'resolve-from';
import { aliasPlugin } from 'rolldown/experimental';

import { nodePath, sourceDirPath } from '@/private/shell/constants';
import { type VirtualFileItem, composeBuildContext } from '@/private/shell/utils/build';

const DEPENDENCY_CACHE = new Map<string, string>();

/**
 * Remaps a package ID based on the provided build configuration.
 *
 * @param id - The original package ID.
 * @param config - The build configuration containing dependency overrides.
 *
 * @returns The remapped package ID if an override exists; otherwise, the original ID.
 */
const overridePackageId = (id: string, config: BuildConfig): string => {
  if (!config.dependencies || !config.dependencies.overrides) return id;

  // Check for direct package remapping
  const overriddenId = config.dependencies.overrides[id];
  if (overriddenId) return overriddenId;

  // Check for scoped package remapping
  // (e.g., 'foo/bar' -> remap 'foo' to 'baz' = 'baz/bar')
  for (const [from, to] of Object.entries(config.dependencies.overrides)) {
    if (id === from || id.startsWith(`${from}/`)) {
      return id.replace(from, to);
    }
  }

  return id;
};

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

/**
 * Checks if we're using a linked package (e.g., `bun link`).
 * When linked, the source directory is outside the current working directory.
 */
const isLinkedPackage = (): boolean => {
  const cwd = toPosix(process.cwd());
  const source = toPosix(sourceDirPath);
  // If source is outside cwd, we're using a linked package
  return !source.startsWith(cwd);
};

const ignoreStart = new RegExp(
  `^(?:${[nodePath, sourceDirPath].map((p) => reEscape(toPosix(p))).join('|')})`,
);

interface BuildConfig {
  /**
   * Optional prefix to prepend to asset URLs in the build output.
   */
  assetPrefix?: string;
  /**
   * Any additional configuration for dependencies to include in the build.
   */
  dependencies?: {
    /**
     * Map of dependency names to override their resolution.
     */
    overrides?: Record<string, string>;
  };
  /**
   * The build environment, either 'development' or 'production'.
   *
   * @default 'development'
   */
  environment?: 'development' | 'production';
  /**
   * The source files to include in the build.
   */
  sourceFiles: Array<VirtualFileItem>;
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
            const resolvedId = overridePackageId(id, config);

            // Check if this import is pointing to a linked package (outside cwd)
            // If so, use resolve-from to properly resolve local dependencies
            if (isLinkedPackage()) {
              try {
                return resolveFrom(nodePath, resolvedId);
              } catch {
                return null;
              }
            }

            // Handle relative imports from CDN modules
            const isRelativePath =
              resolvedId.includes('../') || resolvedId.includes('./');
            if (isRelativePath && importer?.startsWith('cdn:')) {
              const importerCdnId = importer.replace('cdn:', '');

              // Attempt to look up the final URL (after redirects) from cache
              let finalImporterUrl = DEPENDENCY_CACHE.get(importer);
              if (!finalImporterUrl) {
                // If not in cache, make an educated guess
                // Bare package paths (no extension) typically resolve to /index.js
                const hasExtension = /\.[a-z]+$/i.test(importerCdnId);
                finalImporterUrl = hasExtension
                  ? importerCdnId
                  : `${importerCdnId}/index.js`;
              }

              const url = resolveImportPath(resolvedId, finalImporterUrl);
              return `cdn:${url}`;
            }

            // Handle relative imports from local node_modules
            if (isRelativePath && importer) {
              const resolvedIdRelative = path.join(path.dirname(importer), resolvedId);
              const splitLastNodeModule = resolvedIdRelative
                .split(/node_modules[\\/]/)
                .pop();

              // TODO(@nurodev): Add nullish check

              return `cdn:https://unpkg.com/${splitLastNodeModule}`;
            }

            // Handle bare imports (non-relative) from CDN modules
            // For bare imports from CDN, still use unpkg.com
            if (importer?.startsWith('cdn:'))
              return `cdn:https://unpkg.com/${resolvedId}`;

            // Handle bare imports from local files
            return `cdn:https://unpkg.com/${resolvedId}`;
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
