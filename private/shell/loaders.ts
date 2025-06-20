import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import withToc from '@stefanprobst/rehype-extract-toc';
import withTocExport from '@stefanprobst/rehype-extract-toc/mdx';
import type * as esbuild from 'esbuild';
import YAML from 'js-yaml';

import { getFileList, scanExports, wrapClientExport } from '@/private/shell/utils';
import { generateUniqueId } from '@/private/universal/utils/crypto';

export const getClientReferenceLoader = (): esbuild.Plugin => ({
  name: 'Client Reference Loader',
  setup(build) {
    build.onLoad({ filter: /\.client.(js|jsx|ts|tsx)?$/ }, async (source) => {
      let contents = await Bun.file(source.path).text();
      const loader = path.extname(source.path).slice(1) as 'js' | 'jsx' | 'ts' | 'tsx';

      const transpiler = new Bun.Transpiler({ loader });
      const exports = scanExports(transpiler, contents);

      contents += "const CLIENT_REFERENCE = Symbol.for('react.client.reference');\n";
      contents += "const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');\n";
      contents += "const isNetlify = typeof Netlify !== 'undefined';\n";

      contents = contents.replaceAll(/export default function/g, 'function');
      contents = contents.replaceAll(/export default (.*)/g, '');
      contents = contents.replaceAll(/export {([\s\S]*?)}/g, '');
      contents = contents.replaceAll(/export /g, '');

      const chunkId = generateUniqueId();

      for (const exportItem of exports) {
        contents += `${wrapClientExport(exportItem, chunkId)}\n`;

        const usableName = exportItem.originalName
          ? `${exportItem.originalName} as ${exportItem.name}`
          : exportItem.name;

        contents +=
          exportItem.name === 'default'
            ? `export default ${exportItem.originalName};`
            : `export { ${usableName} };`;
      }

      return {
        contents,
        loader,
      };
    });
  },
});

export const getFileListLoader = (): esbuild.Plugin => ({
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

export const getMdxLoader = (
  environment: 'development' | 'production',
): esbuild.Plugin => ({
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
