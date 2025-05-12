export type FileError = { code: string };

export type ClientChunks = { [key: string]: string };

type ServerlessFunctionConfig = {
  environment?: Array<Record<string, string>>;
  handler: string;
  maxDuration?: number;
  memory?: number;
  regions?: Array<string>;
  runtime: string;
  supportsResponseStreaming?: boolean;
  supportsWrapper?: boolean;
};

export type VercelNodejsServerlessFunctionConfig = ServerlessFunctionConfig & {
  launcherType: 'Nodejs';
  /** @default false */
  shouldAddHelpers?: boolean;
  /** @default false */
  shouldAddSourceMapSupport?: boolean;
};

type HandleValue =
  | 'error' //  Check matches after error (500, 404, etc.)
  | 'filesystem' // Check matches after the filesystem misses
  | 'hit'
  | 'miss' // Check matches after every filesystem miss
  | 'resource'
  | 'rewrite';

type Handler = {
  handle: HandleValue;
  src?: string;
  dest?: string;
  status?: number;
};

type Source = {
  caseSensitive?: boolean;
  check?: boolean;
  continue?: boolean;
  dest?: string;
  headers?: Record<string, string>;
  methods?: Array<string>;
  middlewarePath?: string;
  middlewareRawSrc?: Array<string>;
  src: string;
  status?: number;
};

type Route = Source | Handler;

export type VercelConfig = {
  version: 3;
  routes?: Array<Route>;
};
