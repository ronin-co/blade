import { handle } from 'hono/netlify';

import app from '../index';

import type { Config } from '@netlify/functions';

export default handle(app);

export const config = {
  path: '/*',
  preferStatic: true,
} satisfies Config;
