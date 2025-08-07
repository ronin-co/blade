import { cp, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import withToc from '@stefanprobst/rehype-extract-toc';
import withTocExport from '@stefanprobst/rehype-extract-toc/mdx';
import {
  compile as compileTailwind,
  optimize as optimizeTailwind,
} from '@tailwindcss/node';
import { Scanner as TailwindScanner } from '@tailwindcss/oxide';
import { type TSESTree, parse } from '@typescript-eslint/typescript-estree';
import type * as esbuild from 'esbuild';
import YAML from 'js-yaml';
import MagicString from 'magic-string';

import {
  outputDirectory,
  publicDirectory,
  routerInputFile,
  styleInputFile,
} from '@/private/shell/constants';
import {
  type ExportItem,
  type TotalFileList,
  crawlDirectory,
  crawlVirtualDirectory,
  exists,
  extractDeclarationName,
  getFileList,
  wrapClientExport,
} from '@/private/shell/utils';
import {
  transformToCloudflareOutput,
  transformToNetlifyOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';
import type { DeploymentProvider } from '@/private/universal/types/util';
import { generateUniqueId } from '@/private/universal/utils/crypto';
import { getOutputFile } from '@/private/universal/utils/paths';

const ID_FIELD = '__BLADE_BUNDLE_ID';

export const getClientReferenceLoader = (): esbuild.Plugin => ({
  name: 'Client Reference Loader',
  setup(build) {
    build.onLoad({ filter: /\.client.(js|jsx|ts|tsx)?$/ }, async (source) => {
      const rawContents = await readFile(source.path, 'utf8');
      const loader = path.extname(source.path).slice(1) as 'js' | 'jsx' | 'ts' | 'tsx';
      const relativeSourcePath = path.relative(process.cwd(), source.path);
      const chunkId = generateUniqueId();

      const contents = [
        "const CLIENT_REFERENCE = Symbol.for('react.client.reference');",
        "const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');",
        "const isNetlify = typeof Netlify !== 'undefined';",
        '', // Empty line
        rawContents,
      ].join('\n');

      const ast = parse(contents, { range: true, loc: true, jsx: true });
      const ms = new MagicString(contents);
      const exportList: Array<ExportItem> = [];

      for (const node of ast.body) {
        // Skip remote re-exports (`export * from ...`) and types (`export type`).
        if (
          node.type === 'ExportAllDeclaration' ||
          (node.type === 'ExportNamedDeclaration' &&
            (node.source || node.exportKind === 'type'))
        ) {
          continue;
        }

        // Handle named exports.
        if (node.type === 'ExportNamedDeclaration') {
          const decl = node.declaration;

          if (decl) {
            // Record function/class/var exports.
            const name = extractDeclarationName(decl);

            if (name && decl.type !== 'VariableDeclaration') {
              exportList.push({ localName: name, externalName: name });
            } else if (decl.type === 'VariableDeclaration') {
              for (const d of decl.declarations) {
                if (d.id.type === 'Identifier') {
                  exportList.push({ localName: d.id.name, externalName: d.id.name });
                }
              }
            }

            // Remove only the `export ` prefix so the declaration remains.
            ms.remove(node.range[0], decl.range[0]);
          } else {
            // Pure `export { foo, bar }` — drop the whole statement.
            for (const spec of node.specifiers) {
              const localName = extractDeclarationName(spec.local as TSESTree.Node) || '';
              const exportedName =
                extractDeclarationName(spec.exported as TSESTree.Node) || '';
              exportList.push({ localName, externalName: exportedName });
            }
            ms.remove(node.range[0], node.range[1]);
          }
        }

        // Handle default exports.
        else if (node.type === 'ExportDefaultDeclaration') {
          const decl = node.declaration;

          // Pure identifier re-export: Remove whole statement.
          if (decl.type === 'Identifier') {
            const name = decl.name;
            exportList.push({ localName: name, externalName: 'default' });
            ms.remove(node.range[0], node.range[1]);
            continue;
          }

          // Anonymous default (e.g. `export default () => {}`).
          const localName = extractDeclarationName(decl) || '__default_export';
          if (localName === '__default_export') {
            ms.overwrite(
              node.range[0],
              node.range[0] + 'export default'.length,
              `const ${localName} =`,
            );

            continue;
          }

          // Named default declaration (function/class).
          ms.remove(node.range[0], node.range[0] + 'export default'.length);

          exportList.push({ localName, externalName: 'default' });
        }
      }

      // Append property assignments and re-exports.
      for (const exp of exportList) {
        ms.append(
          `\n${wrapClientExport(exp, { id: chunkId, path: relativeSourcePath })}`,
        );

        if (exp.localName === exp.externalName) {
          ms.append(`\nexport { ${exp.localName} };`);
        } else {
          ms.append(`\nexport { ${exp.localName} as ${exp.externalName} };`);
        }
      }

      return {
        contents: ms.toString(),
        loader,
      };
    });
  },
});

export const getFileListLoader = (filePaths?: Array<string>): esbuild.Plugin => ({
  name: 'File List Loader',
  setup(build) {
    const files: TotalFileList = new Map();
    const componentDirectories = ['components'];

    const directories = [
      ['pages', path.join(process.cwd(), 'pages')],
      ['triggers', path.join(process.cwd(), 'triggers')],
      ['components', path.join(process.cwd(), 'components')],
    ];

    if (filePaths) {
      for (const [directoryName] of directories) {
        files.set(directoryName, crawlVirtualDirectory(filePaths, directoryName));
      }
    }
    // If no virtual files were provided, crawl the directories on the file system.
    else {
      build.onStart(async () => {
        await Promise.all(
          directories.map(async ([directoryName, directoryPath]) => {
            const results = (await exists(directoryPath))
              ? await crawlDirectory(directoryPath)
              : [];
            const finalResults = directoryName.startsWith('components')
              ? results.filter((item) => item.relativePath.includes('.client'))
              : results;

            files.set(directoryName, finalResults);
          }),
        );
      });
    }

    build.onResolve({ filter: /^server-list$/ }, (source) => {
      return { path: source.path, namespace: 'server-imports' };
    });

    build.onLoad({ filter: /^server-list$/, namespace: 'server-imports' }, async () => ({
      contents: getFileList(files, ['pages', 'triggers'], await exists(routerInputFile)),
      loader: 'tsx',
      resolveDir: process.cwd(),
    }));

    build.onResolve({ filter: /^client-list$/ }, (source) => {
      return { path: source.path, namespace: 'client-imports' };
    });

    build.onLoad({ filter: /^client-list$/, namespace: 'client-imports' }, async () => ({
      contents: getFileList(files, componentDirectories),
      loader: 'tsx',
      resolveDir: process.cwd(),
    }));
  },
});

export const getMdxLoader = (
  environment: 'development' | 'production',
): esbuild.Plugin => ({
  name: 'MDX Loader',
  setup(build) {
    build.onLoad({ filter: /\.mdx$/ }, async (source) => {
      const contents = await readFile(source.path, 'utf8');

      const yamlPattern = /^\s*---\s*\n([\s\S]*?)\n\s*---\s*/;

      const yaml = contents.match(yamlPattern);
      let mdxContents = contents;

      if (yaml) {
        const yamlData = YAML.load(yaml[1]);
        const hook = `import { useMetadata } from 'blade/server/hooks';\n\n{useMetadata(${JSON.stringify(yamlData)})}\n\n`;

        mdxContents = contents.replace(yaml[0], hook);
      }

      const mdx = await compile(mdxContents, {
        development: environment === 'development',
        rehypePlugins: [withToc, withTocExport],
      });

      const tsx = String(mdx.value);

      return {
        contents: tsx,
        loader: 'tsx',
      };
    });
  },
});

export const getProviderLoader = (
  environment: 'development' | 'production',
  provider: DeploymentProvider,
): esbuild.Plugin => ({
  name: 'Provider Loader',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0 || environment !== 'production') return;

      // Copy hard-coded static assets into output directory.
      if (await exists(publicDirectory)) {
        await cp(publicDirectory, outputDirectory, { recursive: true });
      }

      switch (provider) {
        case 'cloudflare': {
          await transformToCloudflareOutput();
          break;
        }
        case 'netlify': {
          await transformToNetlifyOutput();
          break;
        }
        case 'vercel': {
          await transformToVercelBuildOutput();
          break;
        }
      }
    });
  },
});

export const getMetaLoader = (virtual: boolean): esbuild.Plugin => ({
  name: 'Init Loader',
  setup(build) {
    build.onStart(() => {
      build.initialOptions.define![ID_FIELD] = generateUniqueId();
    });

    build.onResolve({ filter: /^build-meta$/ }, (source) => ({
      path: source.path,
      namespace: 'dynamic-meta',
    }));

    build.onLoad({ filter: /^build-meta$/, namespace: 'dynamic-meta' }, () => ({
      contents: `export const bundleId = "${build.initialOptions.define![ID_FIELD]}";`,
      loader: 'ts',
      resolveDir: process.cwd(),
    }));

    build.onEnd(async (result) => {
      if (result.errors.length === 0 && !virtual) {
        const bundleId = build.initialOptions.define![ID_FIELD];

        const clientBundle = path.join(outputDirectory, getOutputFile('init', 'js'));
        const clientSourcemap = path.join(
          outputDirectory,
          getOutputFile('init', 'js.map'),
        );

        await Promise.all([
          rename(clientBundle, clientBundle.replace('init.js', `${bundleId}.js`)),
          rename(
            clientSourcemap,
            clientSourcemap.replace('init.js.map', `${bundleId}.js.map`),
          ),
        ]);
      }
    });
  },
});

export const getTailwindLoader = (
  environment: 'development' | 'production',
): esbuild.Plugin => ({
  name: 'Init Loader',
  setup(build) {
    let compiler: Awaited<ReturnType<typeof compileTailwind>>;
    let candidates: Array<string> = [];

    const scanner = new TailwindScanner({});

    build.onStart(async () => {
      const input = (await exists(styleInputFile))
        ? await readFile(styleInputFile, 'utf8')
        : `@import 'tailwindcss';`;

      compiler = await compileTailwind(input, {
        onDependency(_path) {},
        base: process.cwd(),
      });

      candidates = [];
    });

    build.onLoad({ filter: /\.(?:tsx|jsx)$/ }, async (args) => {
      const content = await readFile(args.path, 'utf8');
      const extension = path.extname(args.path).slice(1);
      const newCandidates = scanner.getCandidatesWithPositions({ content, extension });

      candidates.push(...newCandidates.map((item) => item.candidate));

      // Let `esbuild` decide how to process the file.
      return null;
    });

    build.onEnd(async (result) => {
      if (result.errors.length === 0) {
        const bundleId = build.initialOptions.define![ID_FIELD];
        const compiledStyles = compiler.build(candidates);

        const optimizedStyles = optimizeTailwind(compiledStyles, {
          file: 'input.css',
          minify: environment === 'production',
        });

        const tailwindOutput = path.join(outputDirectory, getOutputFile(bundleId, 'css'));
        await writeFile(tailwindOutput, optimizedStyles.code);
      }
    });
  },
});

// TODO: Move this into a config file or plugin.
//
// This ensures that no unnecessary localizations are included in the client bundle,
// which would otherwise increase the bundle size.
//
// https://github.com/adobe/react-spectrum/blob/1dcc8705115364a2c2ead2ececae8883dd6e9d07/packages/dev/optimize-locales-plugin/LocalesPlugin.js
export const getReactAriaLoader = (): esbuild.Plugin => ({
  name: 'React Aria Loader',
  setup(build) {
    build.onLoad(
      {
        filter:
          /(@react-stately|@react-aria|@react-spectrum|react-aria-components)\/(.*)\/[a-zA-Z]{2}-[a-zA-Z]{2}\.(js|mjs)$/,
      },
      async (source) => {
        const { name } = path.parse(source.path);

        if (name === 'en-US') {
          return {
            contents: await readFile(source.path),
            loader: 'js',
          };
        }

        return {
          contents: 'const removedLocale = undefined;\nexport default removedLocale;',
          loader: 'js',
        };
      },
    );
  },
});
