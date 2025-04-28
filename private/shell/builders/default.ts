import path from 'node:path';

import { outputDirectory, serverInputFile, serverOutputFile } from '../constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '../loaders';
import { cleanUp, handleBuildLogs, logSpinner, prepareClientAssets } from '../utils';

await cleanUp();
await prepareClientAssets('production');

const spinner = logSpinner('Performing server build (production)').start();

// Inline all environment variables on Cloudflare Pages, because their runtime does not
// have support for `import.meta.env`. Everywhere else, only inline what is truly
// necessary (what cannot be made available at runtime).
const define: { [key: string]: string } = Bun.env['CF_PAGES']
  ? Object.fromEntries(
      Object.entries(import.meta.env)
        .filter(([key]) => key.startsWith('BLADE_') || key.startsWith('__BLADE_'))
        .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    )
  : {
      'import.meta.env.__BLADE_ASSETS': JSON.stringify(import.meta.env.__BLADE_ASSETS),
      'import.meta.env.__BLADE_ASSETS_ID': JSON.stringify(
        import.meta.env.__BLADE_ASSETS_ID,
      ),
    };

const output = await Bun.build({
  entrypoints: [serverInputFile],
  outdir: outputDirectory,
  plugins: [
    getClientReferenceLoader('production'),
    getFileListLoader(true),
    getMdxLoader('production'),
    getReactAriaLoader(),
  ],
  naming: `[dir]/${path.basename(serverOutputFile)}`,
  minify: true,
  sourcemap: 'external',
  target: 'browser',
  define,
});

if (output.success) {
  spinner.succeed();
} else {
  spinner.fail();
}

handleBuildLogs(output);
