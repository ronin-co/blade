import path from 'node:path';

import { stat } from 'node:fs/promises';
import { compile } from '@mdx-js/mdx';
import { type BunPlugin, Glob } from 'bun';
import YAML from 'js-yaml';

import { clientManifestFile } from '@/private/shell/constants';
import type { ClientChunks } from '@/private/shell/types';
import { getFileList, scanExports, wrapClientExport } from '@/private/shell/utils';
import { generateUniqueId } from '@/private/universal/utils/crypto';

export const getClientReferenceLoader: (
  environment: 'development' | 'production',
) => BunPlugin = (environment) => ({
  name: 'Client Reference Loader',
  async setup(build) {
    let clientChunks: ClientChunks | null = null;
    let clientChunksTime: Date | null = null;

    build.onLoad({ filter: /\.client.(js|jsx|ts|tsx)?$/ }, async (source) => {
      let contents = await Bun.file(source.path).text();
      let loader = path.extname(source.path).slice(1) as 'js' | 'jsx' | 'ts' | 'tsx';

      const clientChunksUpdated = (await stat(clientManifestFile)).mtime;

      // Read client chunk metadata from manifest file, but only if the file has been
      // updated, which allows us to avoid unnecessary file system reads.
      if (!clientChunksTime || clientChunksUpdated > clientChunksTime) {
        const file = Bun.file(clientManifestFile);

        clientChunks = JSON.parse(await file.text());
        clientChunksTime = clientChunksUpdated;
      }

      if (!clientChunks) throw new Error('No client chunks available');

      const transpiler = new Bun.Transpiler({ loader });
      const exports = scanExports(transpiler, contents);

      contents += "const CLIENT_REFERENCE = Symbol.for('react.client.reference');\n";
      contents += "const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');\n";

      contents = contents.replaceAll(/export default function/g, 'function');
      contents = contents.replaceAll(/export default (.*)/g, '');
      contents = contents.replaceAll(/export {([\s\S]*?)}/g, '');
      contents = contents.replaceAll(/export /g, '');

      const relativeSourcePath = path.relative(process.cwd(), source.path);
      const clientChunk = clientChunks[relativeSourcePath];
      if (!clientChunk) throw new Error(`Missing client chunk for ${relativeSourcePath}`);

      for (const exportItem of exports) {
        contents += `${wrapClientExport(exportItem, { id: clientChunk, path: relativeSourcePath })}\n`;

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

      if (requiresTranspilation && environment !== 'production') {
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

export const getClientChunkLoader: (clientChunks: ClientChunks) => BunPlugin = (
  clientChunks,
) => ({
  name: 'Client Chunk Loader',
  async setup(build) {
    build.onLoad({ filter: /\.client.(js|jsx|ts|tsx)?$/ }, async (source) => {
      let contents = await Bun.file(source.path).text();
      const loader = path.extname(source.path).slice(1) as 'js' | 'jsx' | 'ts' | 'tsx';

      const chunkId = generateUniqueId();
      const relativeSourcePath = path.relative(process.cwd(), source.path);
      clientChunks[relativeSourcePath] = chunkId;

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

export const getFileListLoader: (onResolve: boolean) => BunPlugin = (onResolve) => ({
  name: 'File List Loader',
  setup(build) {
    if (onResolve) {
      build.onResolve({ filter: /^server-list$/ }, (source) => {
        return { path: source.path, namespace: 'dynamic-list' };
      });

      build.onLoad({ filter: /^server-list$/, namespace: 'dynamic-list' }, async () => {
        const contents = await getFileList();

        return {
          contents,
          loader: 'tsx',
        };
      });

      return;
    }

    build.module('server-list', async () => {
      const contents = await getFileList();

      return {
        contents,
        loader: 'tsx',
      };
    });
  },
});

export const getClientComponentLoader: (projects: string[]) => BunPlugin = (
  projects,
) => ({
  name: 'Client Component Loader',
  setup(build) {
    build.onResolve({ filter: /^client-list$/ }, (source) => {
      return { path: source.path, namespace: 'dynamic-client-list' };
    });

    build.onLoad(
      { filter: /^client-list$/, namespace: 'dynamic-client-list' },
      async () => {
        const glob = new Glob('**/*.client.{js,jsx,ts,tsx}');

        // Prevent duplicate files.
        const files = new Set();

        for (const directory of projects) {
          for await (const file of glob.scan({
            cwd: directory,
            absolute: true,
          })) {
            files.add(file);
          }
        }

        return {
          contents: Array.from(files)
            .map((file) => `import "${file}";`)
            .join('\n'),
          loader: 'tsx',
        };
      },
    );
  },
});

export const getMdxLoader: (environment: 'development' | 'production') => BunPlugin = (
  environment,
) => ({
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
export const getReactAriaLoader: () => BunPlugin = () => ({
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
