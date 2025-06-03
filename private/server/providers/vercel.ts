import { handle } from '@hono/node-server/vercel';

import app from '../worker/index';

export default handle(app);
