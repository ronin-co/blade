import path from 'node:path';

// Keep for path normalization behavior in Memory Loader
// removed unused import of sourceDirPath to satisfy linter
import type { VirtualFileItem } from '@/private/shell/utils/build';
import { composeBuildContext } from '@/private/shell/utils/build';

interface BuildConfig {
  sourceFiles: Array<VirtualFileItem>;
  environment?: 'development' | 'production';
}

interface OutputFileLike {
  path: string;
  contents: Uint8Array;
  readonly text: string;
  hash?: string;
}

interface BuildOutput {
  errors: Array<unknown>;
  warnings: Array<unknown>;
  outputFiles: Array<OutputFileLike>;
}

/**
 * Allows for performing an in-memory build.
 *
 * @param config - The configuration options for customizing the build behavior.
 *
 * @returns The generated build output in the form of virtual files.
 */
export const build = async (config: BuildConfig): Promise<BuildOutput> => {
  const environment = config?.environment || 'development';

  const virtualFiles = config.sourceFiles.map(({ path, content }) => {
    const newPath = path.startsWith('./')
      ? path.slice(1)
      : path.startsWith('/')
        ? path
        : `/${path}`;
    return { path: newPath, content };
  });

  const mainBuild = await composeBuildContext(environment, {
    // Normalize file paths, so that all of them are absolute.
    virtualFiles,
    plugins: [
      {
        name: 'Memory Loader',
        resolveId(id, importer) {
          // Turn relative to absolute for virtual files
          if (id.startsWith('.')) {
            const abs = path.join(path.dirname(importer || process.cwd()), id);
            if (virtualFiles.some((f) => f.path === abs)) return abs;
          }
          // keep node_modules and framework files resolved by default resolver
          return null;
        },
        load(id) {
          const sourceFile = virtualFiles.find((sourceFile) => sourceFile.path === id);
          if (!sourceFile) return null;
          return sourceFile.content;
        },
      },
    ],
  });

  const { errors, warnings, outputFiles } = await mainBuild.rebuild();
  return { errors, warnings, outputFiles: outputFiles ?? [] };
};
