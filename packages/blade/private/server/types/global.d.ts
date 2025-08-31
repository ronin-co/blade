import type { PageStream } from '@/private/server/utils';

declare global {
  var DEV_SESSIONS: Map<string, PageStream>;
}
