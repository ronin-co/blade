import { exists, readFile } from 'node:fs/promises';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import withToc from '@stefanprobst/rehype-extract-toc';
import withTocExport from '@stefanprobst/rehype-extract-toc/mdx';
import { type TSESTree, parse } from '@typescript-eslint/typescript-estree';
import type * as esbuild from 'esbuild';
import YAML from 'js-yaml';
import MagicString from 'magic-string';

import {
  type ExportItem,
  type TotalFileList,
  crawlDirectory,
  extractDeclarationName,
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
      const exportList: Array<ExportItem> = [];

      for (const node of ast.body) {
        // Skip remote re-exports.
        if (
          node.type === 'ExportAllDeclaration' ||
          (node.type === 'ExportNamedDeclaration' && node.source)
        ) {
          continue;
        }

        // Handle named exports
        if (node.type === 'ExportNamedDeclaration') {
          const decl = node.declaration;
          if (decl) {
            // Function or class declaration
            const name = extractDeclarationName(decl);
            if (name && decl.type !== 'VariableDeclaration') {
              exportList.push({ localName: name, externalName: name });
            }
            // Variable declarations
            else if (decl.type === 'VariableDeclaration') {
              for (const d of decl.declarations) {
                if (d.id.type === 'Identifier') {
                  exportList.push({ localName: d.id.name, externalName: d.id.name });
                }
              }
            }
          }
          // Specifiers
          for (const spec of node.specifiers) {
            const localName = extractDeclarationName(spec.local as TSESTree.Node) || '';
            const exportedName =
              extractDeclarationName(spec.exported as TSESTree.Node) || '';
            exportList.push({ localName, externalName: exportedName });
          }
          ms.remove(node.range[0], node.range[1]);
        }

        // Handle default exports
        else if (node.type === 'ExportDefaultDeclaration') {
          const decl = node.declaration;
          const localName = extractDeclarationName(decl) || '__default_export';
          if (localName === '__default_export') {
            // anonymous default: replace export default with const
            ms.overwrite(
              node.range[0],
              node.range[0] + 'export default'.length,
              `const ${localName} =`,
            );
          } else {
            // drop `export default` for named declarations
            ms.remove(node.range[0], node.range[0] + 'export default'.length);
          }
          exportList.push({ localName, externalName: 'default' });
        }
      }

      // Append property assignments and re-exports
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
