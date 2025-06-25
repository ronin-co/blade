import { exists, readFile } from 'node:fs/promises';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import withToc from '@stefanprobst/rehype-extract-toc';
import withTocExport from '@stefanprobst/rehype-extract-toc/mdx';
import { parse } from '@typescript-eslint/typescript-estree';
import MagicString from 'magic-string';
import type * as esbuild from 'esbuild';
import YAML from 'js-yaml';

import {
  type ExportItem,
  type TotalFileList,
  crawlDirectory,
  extractName,
  getFileList,
  wrapClientExport,
} from '@/private/shell/utils';
import { generateUniqueId } from '@/private/universal/utils/crypto';

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
        rawContents,
      ].join('\n');

      const ast = parse(contents, { range: true, loc: true, jsx: true });
      const ms = new MagicString(contents);
      const exports: Array<ExportItem> = [];

      for (const node of ast.body) {
        // Leave remote re-exports untouched
        if (
          node.type === 'ExportAllDeclaration' ||
          (node.type === 'ExportNamedDeclaration' && node.source)
        ) {
          continue;
        }

        // Named exports (local)
        if (node.type === 'ExportNamedDeclaration') {
          if (node.declaration) {
            const decl = node.declaration;
            // handle function/class declarations
            if (
              (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') &&
              decl.id
            ) {
              exports.push({ localName: decl.id.name, externalName: decl.id.name });
            }
            // handle variable declarations
            else if (decl.type === 'VariableDeclaration') {
              for (const d of decl.declarations) {
                if (d.id.type === 'Identifier') {
                  exports.push({ localName: d.id.name, externalName: d.id.name });
                }
              }
            }
          }
          // specifier list: export { a as b }
          if (node.specifiers.length > 0) {
            for (const spec of node.specifiers) {
              const localName =
                spec.local.type === 'Identifier'
                  ? spec.local.name
                  : String((spec.local as any).value);
              const externalName =
                spec.exported.type === 'Identifier'
                  ? spec.exported.name
                  : String((spec.exported as any).value);
              exports.push({ localName, externalName });
            }
          }
          ms.remove(node.range[0], node.range[1]);
        }

        // Default export
        else if (node.type === 'ExportDefaultDeclaration') {
          const decl = node.declaration;
          const name = extractName(decl) || '__default_export';
          // if it was a named function/class, drop 'export default'
          if (name !== '__default_export' && name !== (decl as any).name) {
            ms.remove(node.range[0], node.range[0] + 'export default'.length);
          }
          // for anonymous/default, rewrite to const
          if (name === '__default_export') {
            ms.overwrite(
              node.range[0],
              node.range[0] + 'export default'.length,
              `const ${name} =`,
            );
          }
          exports.push({ localName: name, externalName: 'default' });
          ms.remove(node.range[0], node.range[0] + 'export default'.length);
        }
      }

      // Append property assignments and re-exports
      for (const exp of exports) {
        ms.append(
          `\n${wrapClientExport(exp, { id: chunkId, path: relativeSourcePath })}`,
        );

        if (exp.externalName === 'default') {
          ms.append(`\nexport { ${exp.localName} as default };`);
        } else if (exp.localName === exp.externalName) {
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

export const getFileListLoader = (projects: Array<string>): esbuild.Plugin => ({
  name: 'File List Loader',
  setup(build) {
    const files: TotalFileList = new Map();

    const directories = [
      ['pages', path.join(process.cwd(), 'pages')],
      ['triggers', path.join(process.cwd(), 'triggers')],
      ['components', path.join(process.cwd(), 'components')],
    ];

    const extraProjects = projects.slice(1);
    const componentDirectories = ['components'];

    for (let index = 0; index < extraProjects.length; index++) {
      const project = extraProjects[index];
      const exportName = `components${index}`;

      directories.push([exportName, path.join(project, 'components')]);
      componentDirectories.push(exportName);
    }

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

    build.onResolve({ filter: /^server-list$/ }, (source) => {
      return { path: source.path, namespace: 'server-imports' };
    });

    build.onLoad({ filter: /^server-list$/, namespace: 'server-imports' }, async () => ({
      contents: await getFileList(files, ['pages', 'triggers']),
      loader: 'tsx',
      resolveDir: process.cwd(),
    }));

    build.onResolve({ filter: /^client-list$/ }, (source) => {
      return { path: source.path, namespace: 'client-imports' };
    });

    build.onLoad({ filter: /^client-list$/, namespace: 'client-imports' }, async () => ({
      contents: await getFileList(files, componentDirectories),
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
