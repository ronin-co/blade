import { handle } from 'hono/service-worker';

import app from '../worker/index';

self.addEventListener('fetch', handle(app as any) as any);
