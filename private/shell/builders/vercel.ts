import path from 'node:path';

import { serverInputFile } from '../constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '../loaders';
import { cleanUp, handleBuildLogs, logSpinner, prepareClientAssets } from '../utils';

const OUTPUT_FILE_NAME = 'index.js';

const vercelOutputDir = path.resolve(process.cwd(), '.vercel', 'output');
const edgeFuncOutputDir = path.resolve(vercelOutputDir, 'functions', 'index.func');
const edgeFuncOutputFile = path.join(edgeFuncOutputDir, OUTPUT_FILE_NAME);

async function build(): Promise<void> {
  await cleanUp(vercelOutputDir);
  await prepareClientAssets('production', path.join(vercelOutputDir, 'static'));

  const spinner = logSpinner('Performing server build (production)').start();

  const [output] = await Promise.all([
    Bun.build({
      entrypoints: [serverInputFile],
      outdir: edgeFuncOutputDir,
      plugins: [
        getClientReferenceLoader('production'),
        getFileListLoader(true),
        getMdxLoader('production'),
        getReactAriaLoader(),
      ],
      naming: `[dir]/${path.basename(edgeFuncOutputFile)}`,
      minify: false,
      // sourcemap: 'external',
      target: 'node',
      define: {
        'import.meta.env.__BLADE_ASSETS': JSON.stringify(import.meta.env.__BLADE_ASSETS),
        'import.meta.env.__BLADE_ASSETS_ID': JSON.stringify(
          import.meta.env.__BLADE_ASSETS_ID,
        ),
      },
    }),

    Bun.write(
      path.join(vercelOutputDir, 'config.json'),
      JSON.stringify({
        version: 3,
      }),
    ),

    Bun.write(
      path.join(edgeFuncOutputDir, '.vc-config.json'),
      JSON.stringify({
        entrypoint: OUTPUT_FILE_NAME,
        runtime: 'edge',
      }),
    ),
  ]);

  if (output.success) {
    spinner.succeed();
  } else {
    spinner.fail();
  }

  handleBuildLogs(output);
}

build();
