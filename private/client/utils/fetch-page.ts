import '../types/global.d.ts';

import { omit } from 'radash';
import type { ReactNode } from 'react';

import type { PageFetchingOptions } from '../../universal/types/util';
import { getOutputFile } from '../../universal/utils/paths.ts';
import { createFromReadableStream } from '../utils/parser';
import { fetchRetry } from './data';

const fetchPage = async (
  path: string,
  options?: PageFetchingOptions,
): Promise<{ body: ReactNode; time: number } | null> => {
  let body = null;

  if (options && Object.keys(options).length > 0) {
    const formData = new FormData();

    formData.append('options', JSON.stringify(omit(options, ['files'])));

    // Since binary data cannot be serialized into JSON, we need to send it separately
    // as form data fields.
    if (options.files) {
      for (const [identifier, value] of options.files.entries()) {
        formData.append('files', value, identifier);
      }
    }

    body = formData;
  }

  const headers = new Headers({
    Accept: 'application/json',
  });

  const response = await fetchRetry(path, { method: 'POST', body, headers });

  // If the status code is not in the 200-299 range, we want to throw an error that will
  // be caught and rendered further upwards in the code.
  if (!response.ok) {
    // TODO: If the response is JSON, that means it was already handled and reported by
    // BLADE on the server-side, so we do not need to report it again on the client-side.
    if (response.headers.get('Content-Type') === 'application/json') {
      console.error(await response.json());
      return null;
    }

    throw new Error(await response.text());
  }

  const bundleId = response.headers.get('X-Bundle-Id');
  const updateTime = response.headers.get('X-Update-Time');

  if (!bundleId || !updateTime) throw new Error('Missing response headers on client.');
  if (!response.body) throw new Error('Missing response body on client.');

  if (!window['BLADE_BUNDLES'].has(bundleId)) {
    const root = window['BLADE_ROOT'];
    if (!root) throw new Error('Missing React root');

    // Load new CSS.
    await new Promise((resolve, reject) => {
      const link = document.createElement('link');

      link.rel = 'stylesheet';
      link.onload = resolve;
      link.onerror = reject;
      link.href = getOutputFile(bundleId, 'css');

      document.head.appendChild(link);
    });

    // Once the CSS is loaded, unmount React, but retain the DOM nodes.
    const snapshot = document.documentElement.innerHTML;
    root.unmount();
    document.documentElement.innerHTML = snapshot;

    // Once the old React has been unmounted, load the new JS, which can mount
    // a new React as well, in case that React got upgraded.
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.async = true;
      script.type = 'module';
      script.onload = resolve;
      script.onerror = reject;
      script.src = getOutputFile(bundleId, 'js');

      document.head.appendChild(script);
    });
  }

  return {
    body: await createFromReadableStream(response.body),
    time: Number.parseInt(updateTime),
  };
};

export default fetchPage;
