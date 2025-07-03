import { handle } from 'hono/netlify';

import { app } from '../index';

export default handle(app);

export const config = {
  path: [],
};
