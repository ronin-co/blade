import { handle } from '@hono/node-server/vercel';

import { app } from '../index';

export default handle(app);
