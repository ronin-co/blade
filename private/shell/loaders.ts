import path from 'node:path';

import { compile } from '@mdx-js/mdx';
import YAML from 'js-yaml';

import type { ClientChunks } from '@/private/shell/types';
import { getFileList, scanExports, wrapClientExport } from '@/private/shell/utils';
import { generateUniqueId } from '@/private/universal/utils/crypto';
import type * as esbuild from 'esbuild';

export const getClientReferenceLoader: (clientChunks: ClientChunks) => esbuild.Plugin = (
  clientChunks,
) => ({
  name: 'Client Reference Loader',
  async setup(build) {
    build.onLoad({ filter: /\.client.(js|jsx|ts|tsx)?$/ }, async (source) => {
      let contents = await Bun.file(source.path).text();
      let loader = path.extname(source.path).slice(1) as 'js' | 'jsx' | 'ts' | 'tsx';

      const transpiler = new Bun.Transpiler({ loader });
      const exports = scanExports(transpiler, contents);

      contents += "const CLIENT_REFERENCE = Symbol.for('react.client.reference');\n";
      contents += "const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');\n";

      contents = contents.replaceAll(/export default function/g, 'function');
      contents = contents.replaceAll(/export default (.*)/g, '');
      contents = contents.replaceAll(/export {([\s\S]*?)}/g, '');
      contents = contents.replaceAll(/export /g, '');

      const relativeSourcePath = path.relative(process.cwd(), source.path);
      const chunkId = generateUniqueId();
      clientChunks.set(source.path, chunkId);

      for (const exportItem of exports) {
        contents += `${wrapClientExport(exportItem, { id: chunkId, path: relativeSourcePath })}\n`;

        const usableName = exportItem.originalName
          ? `${exportItem.originalName} as ${exportItem.name}`
          : exportItem.name;

        contents +=
          exportItem.name === 'default'
            ? `export default ${exportItem.originalName};`
            : `export { ${usableName} };`;
      }

      const requiresTranspilation = ['jsx', 'ts', 'tsx'].some((extension) => {
        return source.path.endsWith(`.${extension}`);
      });

      if (requiresTranspilation) {
        const newContents = `import { jsxDEV as jsxDEV_7x81h0kn, Fragment as Fragment_8vg9x3sq } from "react/jsx-dev-runtime";`;

        contents = `${newContents}\n${transpiler.transformSync(contents)}`;
        loader = 'js';
      }

      return {
        contents,
        loader,
      };
    });
  },
});

export const getClientChunkLoader: (clientChunks: ClientChunks) => esbuild.Plugin = (
  clientChunks,
) => ({
  name: 'Client Chunk Loader',
  async setup(build) {
    build.onLoad({ filter: /\.client.(js|jsx|ts|tsx)?$/ }, async (source) => {
      let contents = await Bun.file(source.path).text();
      const loader = path.extname(source.path).slice(1) as 'js' | 'jsx' | 'ts' | 'tsx';

      const chunkId = clientChunks.get(source.path);

      const transpiler = new Bun.Transpiler({ loader });
      const exports = scanExports(transpiler, contents);

      contents += `
        window.BLADE_CHUNKS["${chunkId}"] = {
          ${exports
            .map((exportItem) => {
              return `"${exportItem.name}": ${exportItem.originalName || exportItem.name},`;
            })
            .join('\n')}
        };
      `;

      return {
        contents,
        loader,
      };
    });
  },
});

export const getFileListLoader: () => esbuild.Plugin = () => ({
  name: 'File List Loader',
  setup(build) {
    build.onResolve({ filter: /^server-list$/ }, (source) => {
      return { path: source.path, namespace: 'dynamic-list' };
    });

    build.onLoad({ filter: /^server-list$/, namespace: 'dynamic-list' }, async () => {
      const contents = await getFileList();

      return {
        contents,
        loader: 'tsx',
        resolveDir: process.cwd(),
      };
    });
  },
});

export const getMdxLoader: (environment: 'development' | 'production') => esbuild.Plugin =
  (environment) => ({
    name: 'MDX Loader',
    setup(build) {
      build.onLoad({ filter: /\.mdx$/ }, async (source) => {
        const contents = await Bun.file(source.path).text();

        const yamlPattern = /^\s*---\s*\n([\s\S]*?)\n\s*---\s*/;

        const yaml = contents.match(yamlPattern);
        let mdxContents = contents;

        if (yaml) {
          const yamlData = YAML.load(yaml[1]);
          const hook = `import { useMetadata } from '@ronin/blade/server/hooks';\n\n{useMetadata(${JSON.stringify(yamlData)})}\n\n`;

          mdxContents = contents.replace(yaml[0], hook);
        }

        const mdx = await compile(mdxContents, {
          development: environment === 'development',
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
export const getReactAriaLoader: () => esbuild.Plugin = () => ({
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
            contents: await Bun.file(source.path).text(),
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
