#!/usr/bin/env bun
import path from 'node:path';
import { parseArgs } from 'node:util';
import { $ } from 'bun';
import getPort, { portNumbers } from 'get-port';

import { frameworkDirectory } from '@/private/shell/constants';
import {
  cleanUp,
  getFileList,
  logSpinner,
  scanExports,
  setEnvironmentVariables,
  wrapClientExport,
} from '@/private/shell/utils';
import * as esbuild from 'esbuild';

import {
  loggingPrefixes,
  outputDirectory,
  serverInputFolder,
} from '@/private/shell/constants';
import { generateUniqueId } from '@/private/universal/utils/crypto';

// We want people to add BLADE to `package.json`, which, for example, ensures that
// everyone in a team is using the same version when working on apps.
if (!Bun.env['npm_lifecycle_event']) {
  console.error(
    `${loggingPrefixes.error} The package must be installed locally, not globally.`,
  );
  process.exit(0);
}

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    debug: {
      type: 'boolean',
      default: false,
    },
    queries: {
      type: 'boolean',
      default: false,
    },
    port: {
      type: 'string',
      default: Bun.env['PORT'] || '3000',
    },
    sw: {
      type: 'boolean',
      default: false,
      description: 'Enable service worker support',
    },
  },
  strict: true,
  allowPositionals: true,
});

const isInitializing = positionals.includes('init');
const isBuilding = positionals.includes('build');
const isServing = positionals.includes('serve');
const isDeveloping = !isBuilding && !isServing;
const enableServiceWorker = values.sw;

if (isInitializing) {
  const projectName = positionals[positionals.indexOf('init') + 1] ?? 'blade-example';
  const originDirectory = path.join(frameworkDirectory, 'examples', 'basic');
  const targetDirectory = path.join(process.cwd(), projectName);

  const { success, stderr } = Bun.spawnSync([
    'cp',
    '-r',
    originDirectory,
    targetDirectory,
  ]);

  try {
    await $`cd ${targetDirectory} && git init`.quiet();
  } catch (error) {
    logSpinner('Failed to initialize git repository. Is git installed?').fail();
    console.error(error);
  }

  try {
    await Bun.write(
      path.join(targetDirectory, '.gitignore'),
      `node_modules
      .env
      .blade
      `,
    );
  } catch (error) {
    logSpinner('Failed to create .gitignore').fail();
    console.error(error);
  }

  if (success) {
    logSpinner('Created example app').succeed();
  } else {
    logSpinner('Failed to create example app').fail();
    console.error(stderr);
  }

  process.exit();
}

let port = Number.parseInt(values.port);

if (isDeveloping) {
  const usablePort = await getPort({ port: portNumbers(port, port + 1000) });

  if (port !== usablePort) {
    logSpinner(`Port ${port} is already in use! Using ${usablePort}`).warn();
    port = usablePort;
  }
}

const projects = [process.cwd()];
const tsConfig = Bun.file(path.join(process.cwd(), 'tsconfig.json'));

// If a `tsconfig.json` file exists that contains a `references` field, we should include
// files from the referenced projects as well.
if (await tsConfig.exists()) {
  const tsConfigContents = await tsConfig.json();
  const { references } = tsConfigContents || {};

  if (references && Array.isArray(references) && references.length > 0) {
    projects.push(
      ...references.map((reference) => path.join(process.cwd(), reference.path)),
    );
  }
}

setEnvironmentVariables({
  isBuilding,
  isServing,
  isLoggingQueries: values.queries || false,
  enableServiceWorker,
  port,
  projects,
});

if (isBuilding || isDeveloping) {
  const provider = import.meta.env.__BLADE_PROVIDER;

  await cleanUp();

  await esbuild.build({
    entryPoints: [
      path.join(serverInputFolder, `${provider}.js?client`),
      path.join(serverInputFolder, `${provider}.js?server`),
    ],
    outdir: outputDirectory,
    bundle: true,
    nodePaths: [path.join(process.cwd(), 'node_modules')],
    plugins: [
      {
        name: 'conditional-xform',
        setup(build) {
          // 1. Detect the “?xform” entry and resolve it into a special namespace:
          build.onResolve({ filter: /\?client$/ }, (args) => ({
            path: args.path.replace(/\?client$/, ''),
            namespace: 'client',
          }));

          build.onResolve({ filter: /.*/, namespace: 'client' }, async (args) => {
            if (args.path === 'server-list') {
              return {
                path: args.path,
                namespace: 'dynamic-list-client',
              };
            }

            const result = await build.resolve(args.path, {
              kind: args.kind,
              resolveDir: args.resolveDir,
              importer: args.importer,
            });

            return {
              path: result.path,
              namespace: 'client', // ← re-use the same namespace
            };
          });

          build.onResolve({ filter: /\?server$/ }, (args) => ({
            path: args.path.replace(/\?server$/, ''),
            namespace: 'server',
          }));

          build.onResolve({ filter: /.*/, namespace: 'server' }, async (args) => {
            if (args.path === 'server-list') {
              return {
                path: args.path,
                namespace: 'dynamic-list-server',
              };
            }

            const result = await build.resolve(args.path, {
              kind: args.kind,
              resolveDir: args.resolveDir,
              importer: args.importer,
            });

            return {
              path: result.path,
              namespace: 'server', // ← re-use the same namespace
            };
          });

          const clientChunks = new Map<string, string>();

          build.onLoad(
            { filter: /\.client.(js|jsx|ts|tsx)?$/, namespace: 'client' },
            async (source) => {
              let contents = await Bun.file(source.path).text();
              const loader = path.extname(source.path).slice(1) as
                | 'js'
                | 'jsx'
                | 'ts'
                | 'tsx';

              const chunkId = generateUniqueId();
              clientChunks.set(source.path, chunkId);

              console.log('CLIENT CHUNK 1', source.path);

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
            },
          );

          build.onLoad(
            { filter: /\.client.(js|jsx|ts|tsx)?$/, namespace: 'server' },
            async (source) => {
              let contents = await Bun.file(source.path).text();
              let loader = path.extname(source.path).slice(1) as
                | 'js'
                | 'jsx'
                | 'ts'
                | 'tsx';

              const transpiler = new Bun.Transpiler({ loader });
              const exports = scanExports(transpiler, contents);

              contents +=
                "const CLIENT_REFERENCE = Symbol.for('react.client.reference');\n";
              contents +=
                "const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');\n";

              contents = contents.replaceAll(/export default function/g, 'function');
              contents = contents.replaceAll(/export default (.*)/g, '');
              contents = contents.replaceAll(/export {([\s\S]*?)}/g, '');
              contents = contents.replaceAll(/export /g, '');

              const relativeSourcePath = path.relative(process.cwd(), source.path);
              const clientChunk = clientChunks.get(source.path);
              console.log('CLIENT CHUNK 2', source.path, clientChunk);
              if (!clientChunk)
                throw new Error(`Missing client chunk for ${relativeSourcePath}`);

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

              if (requiresTranspilation) {
                const newContents = `import { jsxDEV as jsxDEV_7x81h0kn, Fragment as Fragment_8vg9x3sq } from "react/jsx-dev-runtime";`;

                contents = `${newContents}\n${transpiler.transformSync(contents)}`;
                loader = 'js';
              }

              return {
                contents,
                loader,
              };
            },
          );

          build.onLoad({ filter: /.*/, namespace: 'client' }, async (source) => {
            const contents = await Bun.file(source.path).text();
            const loader = path.extname(source.path).slice(1) as 'js';

            return {
              contents,
              loader: loader.replace('mjs', 'js'),
              resolveDir: path.dirname(source.path),
            };
          });

          build.onLoad({ filter: /.*/, namespace: 'server' }, async (source) => {
            const contents = await Bun.file(source.path).text();
            const loader = path.extname(source.path).slice(1) as 'js';

            return {
              contents,
              loader: loader.replace('mjs', 'js'),
              resolveDir: path.dirname(source.path),
            };
          });

          build.onLoad(
            { filter: /^server-list$/, namespace: 'dynamic-list-client' },
            async () => {
              const contents = await getFileList('client');

              return {
                contents,
                loader: 'tsx',
                resolveDir: process.cwd(),
              };
            },
          );

          build.onLoad(
            { filter: /^server-list$/, namespace: 'dynamic-list-server' },
            async () => {
              const contents = await getFileList('server');

              return {
                contents,
                loader: 'tsx',
                resolveDir: process.cwd(),
              };
            },
          );

          build.onResolve({ filter: /^client:(.*)$/ }, (args) => {
            // strip off the prefix and hand back a namespace
            const newPath = args.path.replace('client:', '');
            return {
              path: newPath,
              namespace: 'client',
            };
          });

          build.onResolve({ filter: /^server:(.*)$/ }, (args) => {
            // strip off the prefix and hand back a namespace
            const newPath = args.path.replace('server:', '');
            return {
              path: newPath,
              namespace: 'server',
            };
          });

          // 3. Everything else (including the “?full” entry and its deps) uses the default JS loader.
        },
      },
    ],
    entryNames: '[dir]/[name]-[hash]',
  });
}
