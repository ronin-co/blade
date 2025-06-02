import type { UniversalContext } from '@/private/universal/context';
import type { FormattedResults } from 'ronin/types';

interface QueryItemBase {
  /**
   * The query that should be executed on the server.
   *
   * We are tracking queries as strings instead of objects because we are performing a
   * lot of comparisons and deduplication across the framework, so tracking them as
   * strings is more efficient than stringifying them again for every comparison.
   * Especially because we only need the raw object once at the end, when actually
   * executing the queries.
   */
  query: string;
  database?: string;
  result?: FormattedResults<unknown>[number];
  error?: unknown;
}

export interface QueryItemRead extends QueryItemBase {
  type: 'read';
  paginationDetails?: {
    countForQueryAtIndex: PaginationInstruction['queryIndex'];
    direction: PaginationInstruction['direction'];
  };
  /** Whether the query is addressing multiple models at once. */
  multiModel?: boolean;
}

export interface QueryItemWrite extends QueryItemBase {
  type: 'write';
  hookHash: string;
}

export type Asset = {
  type: 'css' | 'js';
  source: string;
};

export type PaginationInstruction = {
  leafIndex: number;
  hookHash: number;
  queryIndex: number;
  direction: 'before' | 'after';
  cursor: string;
  targetModel?: string;
};

export type GeoLocation = {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timeZone: string | null;
};

export interface UserAgent {
  browser: string | null;
  browserVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  os: string | null;
  osVersion: string | null;
}

export type PageFetchingOptions = {
  /**
   * This property is used by `useMutation` on the client and allows for processing
   * queries on the edge, after which the edge then makes the results of the queries
   * available to the client using the defined checksum.
   */
  queries?: QueryItemWrite[];
  /**
   * A list of files that are referenced from the queries.
   */
  files?: Map<string, Blob>;
  /**
   * The page to render instead of the requested one in the case that an error has
   * occurred with the provided queries. This is useful if a new page was requested, but
   * the old page should be re-rendered if an error has occurred.
   */
  errorFallback?: string;
  /**
   * By default, the URL in the address bar of the browser will be updated after every
   * page transition. If this is not desired, you can disable it by setting this property
   * to `false`.
   */
  updateAddressBar?: boolean;
};

export interface CustomNavigator {
  userAgent: UniversalContext['userAgent'];
  geoLocation: UniversalContext['geoLocation'];
  languages: UniversalContext['languages'];
}

export type DeploymentProvider = 'cloudflare' | 'netlify' | 'vercel' | '';
