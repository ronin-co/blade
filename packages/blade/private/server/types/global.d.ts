import type { DevSession } from '@/private/universal/types/util';

declare global {
  var DEV_SESSIONS: Map<string, DevSession>;
}
