import type { ResponseStream } from '@/private/server/utils';

declare global {
  var DEV_SESSIONS: Map<string, ResponseStream>;
}
