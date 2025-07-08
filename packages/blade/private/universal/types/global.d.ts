declare namespace NodeJS {
  interface ProcessEnv {
    // Can be provided manually.
    BLADE_DATA_WORKER: string;
    BLADE_STORAGE_WORKER: string;

    BLADE_PUBLIC_GIT_COMMIT?: string;
    BLADE_PUBLIC_GIT_BRANCH?: string;

    // Provided automatically by BLADE.
    BLADE_ENV: 'development' | 'production';
  }
}

// Provided automatically by BLADE, but only for internal use.
interface ImportMetaEnv {
  readonly __BLADE_DEBUG_LEVEL: 'verbose' | 'error';
  readonly __BLADE_PROVIDER: import('./util').DeploymentProvider;
  readonly __BLADE_SERVICE_WORKER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'build-meta' {
  export const bundleId: string;
}
