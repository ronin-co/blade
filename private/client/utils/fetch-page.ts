import '../types/global.d.ts';

import { omit } from 'radash';
import type { ReactNode } from 'react';

import type { PageFetchingOptions } from '../../universal/types/util';
import { getOutputFile } from '../../universal/utils/paths.ts';
import { createFromReadableStream } from '../utils/parser';
import { fetchRetry } from './data';

const loadResource = async (bundleId: string, type: 'style' | 'script') => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');

    link.rel = 'preload';
    link.as = type;
    link.onload = resolve;
    link.onerror = reject;
    link.href = getOutputFile(bundleId, type === 'style' ? 'css' : 'js');

    document.head.appendChild(link);
  });
};

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
    'X-Client-Bundle-Id': window['BLADE_BUNDLE'],
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

  const serverBundleId = response.headers.get('X-Server-Bundle-Id');
  if (!response.body) throw new Error('Missing response body on client.');

  // If the bundles used on the client are the same as the ones available on the server,
  // the server will not provide a new bundle, which means we can just proceed with
  // rendering the page using the existing React instance.
  if (!serverBundleId) {
    const updateTime = response.headers.get('X-Update-Time');
    if (!updateTime) throw new Error('Missing response headers on client.');

    return {
      body: await createFromReadableStream(response.body),
      time: Number.parseInt(updateTime),
    };
  }

  // Otherwise, if the server did provide a new bundle, that means the client-side
  // instance of React is outdated and needs to be replaced with a new one.

  // Download the new markup, CSS, and JS at the same time, but don't execute
  // any of them just yet.
  const [markup] = await Promise.all([
    response.text(),
    loadResource(serverBundleId, 'style'),
    loadResource(serverBundleId, 'script'),
  ]);

  // Unmount React and replace the DOM with the static HTML markup, which then also loads
  // the updated CSS and JS bundles and mounts a new React root. This ensures that not
  // only the CSS and JS bundles can be upgraded, but also React itself.
  const root = window['BLADE_ROOT'];
  if (!root) throw new Error('Missing React root');
  root.unmount();
  window['BLADE_ROOT'] = null;
  document.documentElement.innerHTML = markup;

  // Since rendering the markup above only evaluates the CSS, we have to separately
  // explicitly run the JS as well.
  for (const script of document.querySelectorAll('script.blade-script')) {
    script.remove();
    document.head.appendChild(script.cloneNode());
  }

  // Since the updated DOM will mount a new instance of React, we don't want to proceed
  // with rendering the updated page using the old React instance.
  return null;
};

export default fetchPage;
