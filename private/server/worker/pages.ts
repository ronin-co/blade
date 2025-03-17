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
  parentDirectory = '',
  params: Params = {},
  traverseUpwards = false,
): Omit<PageEntry, 'errorPage'> | null => {
  const newSegments = [...segments] as [string];
  const currentSegment = newSegments[0];

  newSegments.shift();

  const filePrefix = currentSegment ? currentSegment : 'index';
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
      return getEntryPath(pages, newSegments, directoryPath, params, traverseUpwards);
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
    });

  for (const item of directoryContents) {
    const { type, name, value = null } = getParameter(item, currentSegment, newSegments);
    const location = joinPaths(parentDirectory, item);

    if (type) {
      params[name] = value;

      if (type === 'file') {
        return {
          path: location,
          params,
        };
      }

      if (type === 'directory') {
        return getEntryPath(pages, newSegments, location, params, traverseUpwards);
      }
    }
  }

  const finalSegments = [parentDirectory, ...segments].filter(Boolean);

  // If it is allowed to look further upward in the tree for matches, then do so.
  // Only continue traversing upwards if there are at least two segments left in the
  // path. If there is only one segment left, we have reached the root of the app and
  // should stop traversing.
  if (traverseUpwards && finalSegments.length >= 2) {
    finalSegments.splice(-2, 1);
    return getEntryPath(pages, finalSegments, undefined, undefined, true);
  }

  // No matching page was found.
  return null;
};

const getEntry = (
  pages: Record<string, TreeItem | 'DIRECTORY'>,
  segments: string[],
  error?: PageEntry['errorPage'],
): PageEntry => {
  let newSegments = segments;

  // If an error is being rendered for the current page, remove the last segment from the
  // path and replace it with the error code, such that the respective error page on the
  // directory level of the page can be rendered, if it exists.
  if (error) {
    // Clone the list of segments to avoid modifying the original list.
    newSegments = [...segments];

    // If the last path segment is a dynamic segment, don't remove it, since we want to
    // attach the error path after it. For example, `/account/[id]` should become
    // `/account/[id]/404`.
    //
    // If the last path segment is not a dynamic segment, however, remove it, to ensure
    // that the error path is attached to the correct directory level. For example,
    // `/account` should become `/404`.
    if (!newSegments.at(-1)?.startsWith('[')) newSegments.pop();

    // Attach the error path to the list of segments, in order to find a page within the
    // app whose name matches the error code.
    newSegments.push(error.toString());
  }

  const entry = getEntryPath(pages, newSegments, undefined, undefined, Boolean(error));

  // If a page that matches the provided path segments was found, return it.
  if (entry) {
    return error ? { ...entry, errorPage: error } : entry;
  }

  // TODO: Render a default 404 page provided by Blade.
  if (error) {
    return {
      path: '404.tsx',
      params: {},
      errorPage: 404,
    };
  }

  return getEntry(pages, newSegments, 404);
};

const getPathSegments = (pathname: string): string[] => {
  const [segments] = pathname.slice(1, pathname.length).split('?');
  if (!segments) return [''];
  return segments.split('/');
};

export { getPathSegments, getEntry };
