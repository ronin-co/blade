import type { BrowserSession } from '@/private/universal/types/util';

declare global {
  var SERVER_SESSIONS: Map<BrowserSession['id'], Omit<BrowserSession, 'id'>>;
}
