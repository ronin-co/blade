import type { ServerContext } from '@/private/server/context';
import type {
  GeoLocation,
  QueryItemWrite,
  UserAgent,
} from '@/private/universal/types/util';

/** This context can be consumed by client and server components. */
export type UniversalContext<
  TParams extends Record<string, unknown> | Array<string> = Record<
    string,
    string | Array<string> | null
  >,
> = {
  url: string;
  params: TParams extends Array<string> ? { [K in TParams[number]]: string } : TParams;
  userAgent: UserAgent;
  lastUpdate: number;
  geoLocation: GeoLocation;
  addressBarInSync: boolean;
  languages: string[];
  collected: {
    queries: QueryItemWrite[];
  };
};

/**
 * Picks the properties of the available server context that can be serialized and passed
 * on to the client-side.
 *
 * @param serverContext A server context object.
 *
 * @returns All server context that can be passed to the client-side.
 */
export const getSerializableContext = (
  serverContext: ServerContext,
): UniversalContext => ({
  url: serverContext.url,
  params: serverContext.params,
  userAgent: serverContext.userAgent,
  lastUpdate: Date.now(),
  geoLocation: serverContext.geoLocation,
  addressBarInSync: serverContext.addressBarInSync,
  languages: serverContext.languages,
  collected: {
    // Only the result of write queries should be exposed to the client, since the client
    // generally does not perform read queries. Exposing the result of read queries would
    // be a security vulnerability.
    queries: serverContext.collected.queries.filter(
      (details) => details.type === 'write',
    ),
  },
});
