import { publicDirectoryName } from '@/private/shell/constants';
import { CLIENT_ASSET_PREFIX } from '@/private/universal/utils/constants';

// This helper takes a link destination (such as `/[space]/settings`) and replaces all
// the path segments that might already have a value in the current URL. For example, if
// `/[space]/settings` is passed and the current URL is `/gorillas/help`, the link
// destination will be transformed into `/gorillas/settings`.
export const populatePathSegments = (
  defaultHref: string,
  params: { [key: string]: string | string[] | null },
) => {
  let href = defaultHref;

  const currentQuery = Object.assign({}, params);

  // Parse dynamic path segments such as `[view]` in the path.
  const pathSegments = Array.from(href.matchAll(/\[(.*?)\]/g));

  for (const pathSegment of pathSegments) {
    const [segment, segmentName] = pathSegment as unknown as [string, string];

    // To retrieve the value of path segments such as `[...record]`, we need to remove
    // the `...` and filter out the name ("record" in the example above).
    const name = segmentName.replace('...', '');

    let value = currentQuery[name] as string | string[] | null;

    // If no match is available for a path segment, we don't want to populate it, so that
    // developers can see that a value is missing for it.
    if (!value) continue;

    // Process catch-all path segments such as `[...record]`.
    if (Array.isArray(value)) {
      value = value.join('/');
    }

    href = href.replace(segment, value);
  }

  // Strip trailing slashes in order to normalize the pathname, since trailing slashes
  // are also stripped automatically by the router, so there can never be a URL with
  // trailing slashes inside. However, we don't want to replace a singular slash if there
  // is one, as that would be the index/root page.
  return href === '/' ? href : href.replace(/\/$/, '');
};

export const getOutputFile = (bundleId: string, ext: 'js' | 'css', chunk?: boolean) => {
  return `${CLIENT_ASSET_PREFIX}/${chunk ? 'chunk' : 'main'}.${bundleId}.${ext}`;
};

export const getPublicFile: typeof getOutputFile = (...args) => {
  return `${publicDirectoryName}/${getOutputFile(...args)}`;
};
