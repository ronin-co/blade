declare module 'bun' {
  interface Env {
    // Can be provided manually.
    BLADE_APP_TOKEN: string;
    BLADE_DATA_WORKER: string;
    BLADE_STORAGE_WORKER: string;

    BLADE_PUBLIC_GIT_COMMIT?: string;
    BLADE_PUBLIC_GIT_BRANCH?: string;

    // Provided automatically by BLADE.
    BLADE_ENV: 'development' | 'production';

    // Provided automatically by BLADE, but only for internal use.
    __BLADE_ASSETS: string;
    __BLADE_ASSETS_ID: string;
    __BLADE_DEBUG_LEVEL: 'verbose' | 'error';
    __BLADE_PORT: string;
    __BLADE_PROJECTS: string;
    __BLADE_PROVIDER: import('./util').DeploymentProvider;
    __BLADE_SERVICE_WORKER: boolean;
  }
}
