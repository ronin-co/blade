// Can be provided to the shell process of Blade.
declare namespace NodeJS {
  interface ProcessEnv {
    BLADE_DATA_WORKER: string;
    BLADE_STORAGE_WORKER: string;
    BLADE_PUBLIC_GIT_COMMIT?: string;
    BLADE_PUBLIC_GIT_BRANCH?: string;
  }
}

// Provided automatically to the server and client bundles by Blade.
interface ImportMetaEnv {
  // For use by apps built with Blade.
  readonly BLADE_ENV: 'development' | 'production';

  // For internal use.
  readonly __BLADE_DEBUG_LEVEL: 'verbose' | 'error';
  readonly __BLADE_PROVIDER: import('./util').DeploymentProvider;
  readonly __BLADE_SERVICE_WORKER: string;
}

// biome-ignore lint/correctness/noUnusedVariables: This is needed.
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'build-meta' {
  export const bundleId: string;
}
