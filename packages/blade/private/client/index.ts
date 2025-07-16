import 'client-list';

import '@/private/client/components/history';
import '@/public/client/components';
import { fetchPage } from '@/private/client/utils/page';

const path = location.pathname + location.search + location.hash;
fetchPage(path, true);
