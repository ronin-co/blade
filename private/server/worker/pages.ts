import '../types/global.d.ts';

import type { TreeItem } from '../types/index.ts';
import { joinPaths } from '../utils/paths';

type Params = { [key: string]: string | string[] | null };

const getParameter = (
  item: string,
  currentSegment: string,
  remainingSegments: string[],
) => {
  let type = '';
  let name = '';
  const extension = item.endsWith('].tsx') ? 'tsx' : item.endsWith('].mdx') && 'mdx';

  let value: string | string[] = currentSegment;

  if (extension === 'mdx' || extension === 'tsx') {
    type = 'file';
    name = item.replace('[', '').replace(`].${extension}`, '');
  } else if (item.endsWith(']')) {
    type = 'directory';
    name = item.replace('[', '').replace(']', '');
  }

  if (name.startsWith('...')) {
    name = name.replace('...', '');
    value = Array.from(remainingSegments);

    // Only add the segment to the list if it isn't empty, otherwise we'll end up with
    // params containing an array like `[undefined]`.
    if (currentSegment) value.unshift(currentSegment);
  }

  return {
    type,
    name,
    value,
  };
};

export type PageEntry = {
  path: string;
  params: {
    [key: string]: string | string[] | null;
  };
  errorPage?: 404 | 500;
};

const getEntryPath = (
  pages: Record<string, TreeItem | 'DIRECTORY'>,
  segments: string[],
  indexName = 'index',
  parentDirectory = '',
  params: Params = {},
): Omit<PageEntry, 'errorPage'> | null => {
  const [currentSegment, ...remainingSegments] = segments;
  const filePrefix = currentSegment || indexName;

  // Try to find a direct file match first.
  for (const ext of ['tsx', 'mdx']) {
    const filePath = joinPaths(parentDirectory, `${filePrefix}.${ext}`);
    if (typeof pages[filePath] === 'object') return { path: filePath, params };
  }

  // If the current segment is empty, it's guaranteed that there won't be a named
  // directory that we have to look inside. A directory with a dynamic name (such as
  // "[space]") might exist, but that will be handled further down below.
  if (currentSegment) {
    const directoryPath = joinPaths(parentDirectory, currentSegment);
    if (pages[directoryPath] === 'DIRECTORY') {
      return getEntryPath(pages, remainingSegments, indexName, directoryPath, params);
    }
  }

  const directoryContents = Object.keys(pages)
    .filter((path) => {
      if (!parentDirectory) return !path.includes('/');
      return (
        // Include all paths that start with the parent directory.
        path.startsWith(parentDirectory) &&
        // Exclude the parent directory itself.
        path !== parentDirectory &&
        !path.replace(`${parentDirectory}/`, '').includes('/')
      );
    })
    .map((path) => (parentDirectory ? path.replace(`${parentDirectory}/`, '') : path))
    // Sort dynamic path segments to the end.
    .sort((a, b) => Number(a.startsWith('[')) - Number(b.startsWith('[')));

  for (const item of directoryContents) {
    const location = joinPaths(parentDirectory, item);

    if (indexName !== 'index' && item === `${indexName}.tsx`) {
      return { path: location, params };
    }

    const { type, name, value } = getParameter(item, currentSegment, remainingSegments);
    if (!type) continue;

    const newParams = { ...params, [name]: value };

    if (type === 'file') {
      return { path: location, params: newParams };
    }

    if (type === 'directory') {
      return getEntryPath(pages, remainingSegments, indexName, location, newParams);
    }
  }

  return null;
};

const getEntry = (
  pages: Record<string, TreeItem | 'DIRECTORY'>,
  segments: string[],
  options?: {
    error?: PageEntry['errorPage'];
    forceNativeError?: boolean;
  },
): PageEntry => {
  const newSegments = segments;
  const hasError = options?.error !== undefined;

  // If a native error page is being force-rendered, don't even try to find a matching
  // app-provided error page, because we *must* render the native one provided by Blade.
  const entry = options?.forceNativeError
    ? null
    : getEntryPath(pages, newSegments, options?.error?.toString());

  // If a page that matches the provided path segments was found, return it.
  if (entry) {
    return hasError ? { ...entry, errorPage: options.error } : entry;
  }

  // If an error page should be rendered and no matching page was found, that means the
  // app does not define a custom error page for the given error code. In that case, we
  // want to render the respective native error page for the given error code.
  if (hasError) {
    const finalSegments = [...segments];

    if (finalSegments.length >= 2) {
      finalSegments.splice(-2, 1);
      return getEntry(pages, finalSegments, options);
    }

    // TODO: Pass path of native error page.
    return {
      path: `${options.error}.tsx`,
      params: {},
      errorPage: options.error,
    };
  }

  // If a regular page (not an error page) should be rendered and no matching page was
  // found, that means the respective page was not defined by the app and we must try to
  // render a "Not Found" (404) page provided by the app instead.
  return getEntry(pages, newSegments, { error: 404 });
};

const getPathSegments = (pathname: string): string[] => {
  const [segments] = pathname.slice(1, pathname.length).split('?');
  if (!segments) return [''];
  return segments.split('/');
};

export { getPathSegments, getEntry };
