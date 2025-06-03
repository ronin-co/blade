import { handle } from 'hono/service-worker';

import app from '../index';

self.addEventListener('fetch', handle(app as any) as any);
