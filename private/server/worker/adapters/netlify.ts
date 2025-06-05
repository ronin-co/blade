import { handle } from 'hono/netlify';

import app from '../index';

import type { Config } from '@netlify/edge-functions';

export default handle(app);

export const config = {
  path: '/',
} satisfies Config;
