import { bundleId } from 'build-meta';
import { omit } from 'radash';
import type { ReactNode } from 'react';

import { fetchRetry } from '@/private/client/utils/data';
import { createFromReadableStream } from '@/private/client/utils/parser';
import type { PageFetchingOptions } from '@/private/universal/types/util';
import { getOutputFile } from '@/private/universal/utils/paths';

/**
 * Downloads a CSS or JS bundle from the server, without evaluating it.
 *
 * @param bundleId - The ID of the bundle to download.
 * @param type - The type of the bundle to download. Can be either 'style' or 'script'.
 *
 * @returns A promise that resolves once the bundle is downloaded.
 */
const loadResource = async (bundleId: string, type: 'style' | 'script') => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');

    link.rel = 'preload';
    link.as = type;
    link.onload = resolve;
    link.onerror = reject;
    link.href = `/${getOutputFile(bundleId, type === 'style' ? 'css' : 'js')}`;

    document.head.appendChild(link);
  });
};

export interface FetchedPage {
  body: ReactNode;
  time: number;
}

/**
 * Resolves a new page from the server-side of Blade.
 *
 * @param path - The path of the page.
 * @param options - Additional options for how to resolve the page.
 *
 * @returns Either a page or `null` if the server has changed.
 */
export const fetchPage = async (
  path: string,
  options?: PageFetchingOptions,
): Promise<FetchedPage | null> => {
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
    'X-Session-Id': window['BLADE_SESSION'],
  });

  const response = await fetchRetry(path, { method: 'POST', body, headers });

  // If the status code is not in the 200-299 range, we want to throw an error that will
  // be caught and rendered further upwards in the code.
  if (!response.ok) throw new Error(await response.text());

  const serverBundleId = response.headers.get('X-Server-Bundle-Id');
  if (!response.body) throw new Error('Missing response body on client.');

  // If the bundles used on the client are the same as the ones available on the server,
  // the server will not provide a new bundle, which means we can just proceed with
  // rendering the page using the existing React instance.
  if (bundleId === serverBundleId) {
    const updateTime = response.headers.get('X-Update-Time');
    if (!updateTime) throw new Error('Missing response headers on client.');

    return {
      body: await createFromReadableStream(response.body),
      time: Number.parseInt(updateTime),
    };
  }

  // If they are not the same, do not try to render. The client chunks will be updated
  // by the browser session endpoint.
  return null;
};

export const mountNewBundle = async (bundleId: string, markup: Promise<string>) => {
  // Download the new markup, CSS, and JS at the same time, but don't execute
  // any of them just yet.
  const [newMarkup] = await Promise.all([
    markup,
    loadResource(bundleId, 'style'),
    loadResource(bundleId, 'script'),
  ]);

  // Unmount React and replace the DOM with the static HTML markup, which then also loads
  // the updated CSS and JS bundles and mounts a new React root. This ensures that not
  // only the CSS and JS bundles can be upgraded, but also React itself.
  const root = window['BLADE_ROOT'];
  if (!root) throw new Error('Missing React root');
  root.unmount();
  window['BLADE_ROOT'] = null;

  const parser = new DOMParser();
  const newDocument = parser.parseFromString(newMarkup, 'text/html');

  // Replace the inner markup of the document element, since it is not possible to
  // replace the document element itself using DOM APIs.
  document.documentElement.innerHTML = newDocument.documentElement.innerHTML;

  // Copy over every attribute from the new document element to the current one, due to
  // the constraint mentioned further above.
  [...Array.from(newDocument.documentElement.attributes)].forEach(({ name, value }) => {
    document.documentElement.setAttribute(name, value);
  });

  // Since rendering the markup above only evaluates the CSS, we have to separately
  // explicitly run the JS as well.
  for (const oldScript of Array.from(document.querySelectorAll('script.blade-script'))) {
    // Cloning the old element will not cause the script to be executed. Instead, we must
    // creae a new element with the same attributes and append it to the DOM.
    const newScript = document.createElement('script');
    // Copy over every attribute
    for (const attr of Array.from(oldScript.attributes)) {
      newScript.setAttribute(attr.name, attr.value);
    }
    document.head.appendChild(newScript);
    oldScript.remove();
  }

  // Print debugging information.
  console.debug('Mounted new client bundles');
};
