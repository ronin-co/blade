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
  errorPage: 404 | 500 | null;
};

const getEntryPath = (
  pages: Record<string, TreeItem | 'DIRECTORY'>,
  segments: string[],
  options?: {
    parentDirectory?: string;
    params?: Params;
    errorPage?: PageEntry['errorPage'];
  },
): PageEntry | null => {
  const { parentDirectory = '', params = {}, errorPage = null } = options || {};

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
      errorPage,
    };
  }

  fileExtension = 'mdx';
  fileName = `${filePrefix}.${fileExtension}`;
  filePath = joinPaths(parentDirectory, fileName);

  if (typeof pages[filePath] === 'object') {
    return {
      path: filePath,
      params,
      errorPage,
    };
  }

  // If the current segment is empty, it's guaranteed that there won't be a named
  // directory that we have to look inside. A directory with a dynamic name (such as
  // "[space]") might exist, but that will be handled further down below.
  if (currentSegment) {
    const directoryName = currentSegment;
    const directoryPath = joinPaths(parentDirectory, directoryName);

    if (pages[directoryPath] === 'DIRECTORY') {
      return getEntryPath(pages, newSegments, {
        parentDirectory: directoryPath,
        params,
        errorPage,
      });
    }
  }

  if (!parentDirectory && currentSegment === '404') return null;

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
          errorPage,
        };
      }

      if (type === 'directory') {
        return getEntryPath(pages, newSegments, {
          parentDirectory: location,
          params,
          errorPage,
        });
      }
    }
  }

  const notFoundSegments = [parentDirectory, ...segments].filter(Boolean);
  notFoundSegments.pop();
  if (errorPage) notFoundSegments.pop();
  notFoundSegments.push('404');

  return getEntryPath(pages, notFoundSegments, { errorPage: 404 });
};

const getPathSegments = (pathname: string): string[] => {
  const [segments] = pathname.slice(1, pathname.length).split('?');
  if (!segments) return [''];
  return segments.split('/');
};

export { getPathSegments, getEntryPath };
