import { cp, readFile } from 'node:fs/promises';
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
import YAML from 'js-yaml';
import MagicString from 'magic-string';
import type { Plugin as RolldownPlugin } from 'rolldown';

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
import type { VirtualFileItem } from '@/private/shell/utils/build';
import {
  transformToCloudflareOutput,
  transformToNetlifyOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';
import type { DeploymentProvider } from '@/private/universal/types/util';
import { generateUniqueId } from '@/private/universal/utils/crypto';
import { getOutputFile } from '@/private/universal/utils/paths';

let CURRENT_BUNDLE_ID = '';

export const getClientReferenceLoader = (): RolldownPlugin => ({
  name: 'Client Reference Loader',
  transform(code, id) {
    if (!/\.client\.(js|jsx|ts|tsx)$/.test(id)) return null;
    const rawContents = code;
    const relativeSourcePath = path.relative(process.cwd(), id.replace(/^\0+/, ''));
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
      ms.append(`\n${wrapClientExport(exp, { id: chunkId, path: relativeSourcePath })}`);

      if (exp.localName === exp.externalName) {
        ms.append(`\nexport { ${exp.localName} };`);
      } else {
        ms.append(`\nexport { ${exp.localName} as ${exp.externalName} };`);
      }
    }

    return { code: ms.toString(), map: null };
  },
});

export const getFileListLoader = (
  virtualFiles?: Array<VirtualFileItem>,
): RolldownPlugin => {
  let files: TotalFileList = new Map();

  const directories = [
    ['pages', path.join(process.cwd(), 'pages')],
    ['triggers', path.join(process.cwd(), 'triggers')],
    ['components', path.join(process.cwd(), 'components')],
  ];

  return {
    name: 'File List Loader',
    async buildStart() {
      files = new Map();

      if (virtualFiles) {
        for (const [directoryName] of directories) {
          files.set(directoryName, crawlVirtualDirectory(virtualFiles, directoryName));
        }
      } else {
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
      }
    },
    resolveId(source) {
      if (source === 'server-list') return '\u0000server-list.tsx';
      if (source === 'client-list') return '\u0000client-list.tsx';

      return null;
    },
    async load(id) {
      if (id === '\u0000server-list.tsx') {
        return getFileList(files, ['pages', 'triggers'], await exists(routerInputFile));
      }

      if (id === '\u0000client-list.tsx') {
        return getFileList(files, ['components']);
      }

      return null;
    },
  };
};

export const getMdxLoader = (
  environment: 'development' | 'production',
): RolldownPlugin => ({
  name: 'MDX Loader',
  async transform(code, id) {
    if (!id.endsWith('.mdx')) return null;
    const contents = code;

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
    return { code: tsx, map: null };
  },
});

export const getProviderLoader = (
  environment: 'development' | 'production',
  provider: DeploymentProvider,
): RolldownPlugin => ({
  name: 'Provider Loader',
  async writeBundle() {
    if (environment !== 'production') return;

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
  },
});

export const getMetaLoader = (): RolldownPlugin => ({
  name: 'Init Loader',
  buildStart() {
    CURRENT_BUNDLE_ID = generateUniqueId();
  },
  resolveId(source) {
    if (source === 'build-meta') return '\u0000build-meta.ts';
    return null;
  },
  load(id) {
    if (id === '\u0000build-meta.ts') {
      return `export const bundleId = "${CURRENT_BUNDLE_ID}";`;
    }
    return null;
  },
  generateBundle(_options, bundle) {
    const initName = getOutputFile('init', 'js');
    const desired = getOutputFile(CURRENT_BUNDLE_ID, 'js');
    for (const [fileName, chunk] of Object.entries(bundle)) {
      if (fileName === initName && chunk.type === 'chunk') {
        chunk.fileName = desired;
      }
      if (fileName === `${initName}.map` && chunk.type === 'asset') {
        // update sourcemap file name
        chunk.fileName = `${desired}.map`;
      }
    }
  },
});

export const getTailwindLoader = (
  environment: 'development' | 'production',
): RolldownPlugin => {
  let compiler: Awaited<ReturnType<typeof compileTailwind>>;
  let candidates: Array<string> = [];

  const scanner = new TailwindScanner({});

  return {
    name: 'Tailwind CSS Loader',
    async buildStart() {
      let input = `@import 'tailwindcss';`;

      // Always reading the file and handling the error if the file doesn't exist is
      // faster than first checking if the file exists.
      try {
        input = await readFile(styleInputFile, 'utf8');
      } catch (err) {
        if ((err as { code: string }).code !== 'ENOENT') throw err;
      }

      compiler = await compileTailwind(input, {
        onDependency(_path) {},
        base: process.cwd(),
      });

      candidates = [];
    },
    transform: {
      filter: {
        id: /\.(tsx|jsx)$/,
      },
      async handler(content, filePath) {
        const extension = path.extname(filePath).slice(1); // "tsx" | "jsx"
        const newCandidates = scanner.getCandidatesWithPositions({ content, extension });

        candidates.push(...newCandidates.map((item) => item.candidate));
      },
    },
    generateBundle() {
      let source = compiler.build(candidates);

      if (environment === 'production') {
        source = optimizeTailwind(source, { minify: true }).code;
      }

      this.emitFile({
        type: 'asset',
        fileName: getOutputFile('[hash]', 'css'),
        source,
      });
    },
  };
};

// TODO: Move this into a config file or plugin.
//
// This ensures that no unnecessary localizations are included in the client bundle,
// which would otherwise increase the bundle size.
//
// https://github.com/adobe/react-spectrum/blob/1dcc8705115364a2c2ead2ececae8883dd6e9d07/packages/dev/optimize-locales-plugin/LocalesPlugin.js
export const getReactAriaLoader = (): RolldownPlugin => ({
  name: 'React Aria Loader',
  async load(id) {
    const localeRe =
      /(@react-stately|@react-aria|@react-spectrum|react-aria-components)\/(.*)\/[a-zA-Z]{2}-[a-zA-Z]{2}\.(js|mjs)$/;
    if (!localeRe.test(id)) return null;
    const { name } = path.parse(id);
    if (name === 'en-US') {
      return await readFile(id, 'utf8');
    }
    return 'const removedLocale = undefined;\nexport default removedLocale;';
  },
});
