import { triggers } from 'blade/schema';

import type { AuthConfig } from '@/utils/types';

export default (_authConfig?: AuthConfig) => {
  return triggers({
    beforeAdd: () => {}
  });
};
