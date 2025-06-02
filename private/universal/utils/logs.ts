import { IS_DEV } from '@/private/universal/utils/constants';

/**
 * Log helpful information to the console.
 *
 * @param {...string} args - The same arguments that `console.log` receives.
 *
 * @returns Nothing.
 */
const info = (...args: Parameters<typeof console.log>) => {
  if (IS_DEV) {
    console.log(...args);
    return;
  }

  console.debug(...args);
};

export default {
  info,
};
