import type { PageList, TreeItem } from '@/private/server/types';
import { joinPaths } from '@/private/server/utils/paths';
import { DEFAULT_PAGE_PATH } from '@/private/universal/utils/constants';

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
  const newSegments = [...segments] as [string];
  const currentSegment = newSegments[0];

  newSegments.shift();

  const filePrefix = currentSegment ? currentSegment : indexName;
  let fileExtension: 'tsx' | 'mdx' = 'tsx';
  let fileName = `${filePrefix}.${fileExtension}`;
  let filePath = joinPaths(parentDirectory, fileName);

  if (typeof pages[filePath] === 'object') {
    return {
      path: filePath,
      params,
    };
  }

  fileExtension = 'mdx';
  fileName = `${filePrefix}.${fileExtension}`;
  filePath = joinPaths(parentDirectory, fileName);

  if (typeof pages[filePath] === 'object') {
    return {
      path: filePath,
      params,
    };
  }

  // If the current segment is empty, it's guaranteed that there won't be a named
  // directory that we have to look inside. A directory with a dynamic name (such as
  // "[space]") might exist, but that will be handled further down below.
  if (currentSegment) {
    const directoryName = currentSegment;
    const directoryPath = joinPaths(parentDirectory, directoryName);

    if (pages[directoryPath] === 'DIRECTORY') {
      return getEntryPath(pages, newSegments, indexName, directoryPath, params);
    }
  }

  const directoryContents = Object.keys(pages)
    .filter((path) => {
      if (parentDirectory) {
        // Exclude the parent directory itself.
        if (path === parentDirectory) return false;

        // Include all paths that start with the parent directory.
        return path.startsWith(parentDirectory);
      }

      // If there is no parent directory, include all paths.
      return true;
    })
    .map((path) => {
      return parentDirectory ? path.replace(`${parentDirectory}/`, '') : path;
    })
    .filter((path) => {
      // Filter out the contents of sub directories, so that only the names of files and
      // directories on the current (first) level remain.
      return !path.includes('/');
    })
    .sort((a, b) => {
      // Sort dynamic path segments to the end.
      return Number(a.startsWith('[')) - Number(b.startsWith('['));
    });

  for (const item of directoryContents) {
    const location = joinPaths(parentDirectory, item);

    if (indexName !== 'index' && item === `${indexName}.tsx`) {
      return {
        path: location,
        params,
      };
    }

    const { type, name, value = null } = getParameter(item, currentSegment, newSegments);

    if (type) {
      params[name] = value;

      if (type === 'file') {
        return {
          path: location,
          params,
        };
      }

      // If a directory that matches the current segment was found, we need to look
      // inside that directory to find suitable page files.
      if (type === 'directory') {
        return getEntryPath(pages, newSegments, indexName, location, params);
      }
    }
  }

  // No matching page was found.
  return null;
};

const getEntry = (
  pages: PageList,
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

    return {
      path: joinPaths(DEFAULT_PAGE_PATH, `${options.error}.tsx`),
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
