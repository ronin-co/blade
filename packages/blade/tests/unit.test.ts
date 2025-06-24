import { expect, test } from 'vitest';

import { getParentDirectories } from '@/private/server/utils/paths';
import { getEntry, getPathSegments } from '@/private/server/worker/pages';
import { isSameOrigin } from '@/public/client/components';
import { examplePage, pages } from './fixtures/pages';

test('get entry path of non-index page', () => {
  const pathSegments = getPathSegments('/login');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: 'login.tsx',
    params: {},
  });
});

test('get entry path of non-index MDX page', () => {
  const pathSegments = getPathSegments('/docs/platform');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: 'docs/platform.mdx',
    params: {},
  });
});

test('get entry path of nested index page', () => {
  const pathSegments = getPathSegments('/account');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: 'account/index.tsx',
    params: {},
  });
});

test('get entry path of nested non-index page', () => {
  const pathSegments = getPathSegments('/account/security');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: 'account/security.tsx',
    params: {},
  });
});

test('get entry path of nested dynamic index page', () => {
  const pathSegments = getPathSegments('/');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: '[space]/index.tsx',
    params: { space: '' },
  });
});

test('get entry path of nested dynamic index page with params', () => {
  const pathSegments = getPathSegments('/ronin');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: '[space]/index.tsx',
    params: { space: 'ronin' },
  });
});

test('get entry path of nested dynamic non-index page with params', () => {
  const pathSegments = getPathSegments('/ronin/settings');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: '[space]/settings/index.tsx',
    params: { space: 'ronin' },
  });
});

test('get entry path of deeply nested dynamic index page', () => {
  const pathSegments = getPathSegments('/ronin/developers/schemas/team/settings');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: '[space]/developers/schemas/[schema]/settings/index.tsx',
    params: { space: 'ronin', schema: 'team' },
  });
});

test('get entry path of deeply nested dynamic non-index page', () => {
  const pathSegments = getPathSegments(
    '/ronin/developers/schemas/team/settings/variants',
  );
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: '[space]/developers/schemas/[schema]/settings/variants.tsx',
    params: { space: 'ronin', schema: 'team' },
  });
});

test('get entry path of page with dynamic page name', () => {
  const pathSegments = getPathSegments(
    '/ronin/help/tickets/front-page-no-longer-responding',
  );
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: '[space]/help/tickets/[ticket].tsx',
    params: { space: 'ronin', ticket: 'front-page-no-longer-responding' },
  });
});

test('get entry path of MDX page with dynamic page name', () => {
  const pathSegments = getPathSegments('/guides/dashboard');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: 'guides/[category].mdx',
    params: { category: 'dashboard' },
  });
});

test('get entry path of deeply nested page where parent of page is dynamic', () => {
  const pathSegments = getPathSegments('/ronin/records/new-teams');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: '[space]/records/[view]/index.tsx',
    params: { space: 'ronin', view: 'new-teams' },
  });
});

/*
test('get entry path of non-existing page', () => {
  const pathSegments = getPathSegments('/docs/non-existent-page');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    // Represents the native error page provided by Blade.
    path: '404.tsx',
    params: {},
    errorPage: 404,
  });
});
*/

test('get entry path of page with catch-all dynamic page name', () => {
  const pathSegments = getPathSegments('/ronin/explore/spaces/test-6');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: '[space]/explore/[schema]/[...record].tsx',
    params: { space: 'ronin', schema: 'spaces', record: ['test-6'] },
  });
});

test('get parent directories of path', () => {
  const parentDirectories = getParentDirectories('/[space]/records/[view]/index.tsx');

  expect(parentDirectories).toMatchObject([
    '/[space]/records/[view]',
    '/[space]/records',
    '/[space]',
    '',
  ]);
});

test('get closest 404 page', () => {
  const pathSegments = getPathSegments('/account/testing/another-test');
  const entry = getEntry(pages, pathSegments);

  expect(entry).toMatchObject({
    path: 'account/404.tsx',
    params: {},
  });
});

test('get closest 404 page to dynamic directory segment', () => {
  const pathSegments = getPathSegments('/ronin');
  const entry = getEntry(pages, pathSegments, { error: 404 });

  expect(entry).toMatchObject({
    path: '[space]/404.tsx',
    params: {},
  });
});

test('get closest 404 page to dynamic directory segment with multiple levels', () => {
  const pathSegments = getPathSegments('/ronin/settings');
  const entry = getEntry(pages, pathSegments, { error: 404 });

  expect(entry).toMatchObject({
    path: '[space]/404.tsx',
    params: {},
  });
});

test('get root 404 page', () => {
  const pathSegments = getPathSegments('/docs/testing-nicely');

  const newPages = {
    ...pages,
    '404.tsx': examplePage,
  };

  const entry = getEntry(newPages, pathSegments);

  expect(entry).toMatchObject({
    path: '404.tsx',
    params: {},
  });
});

test('render page', () => {
  const page = pages['layout.tsx'];
  const component = typeof page === 'object' && 'default' in page ? page.default : null;
  const result = component ? component({}) : null;

  expect(result).toBeNull();
});

test('isSameOrigin should return true for same-origin URLs', () => {
  const currentURL = 'https://example.com/page';

  expect(isSameOrigin('/about', currentURL)).toBe(true);
  expect(isSameOrigin('https://example.com/contact', currentURL)).toBe(true);
  expect(isSameOrigin('https://example.com:443/blog', currentURL)).toBe(true);
  expect(isSameOrigin('https://example.com/page?param=value', currentURL)).toBe(true);
});

test('isSameOrigin should return false for cross-origin URLs', () => {
  const currentURL = 'https://example.com/page';

  expect(isSameOrigin('https://other.com/page', currentURL)).toBe(false);
  expect(isSameOrigin('http://example.com/page', currentURL)).toBe(false);
  expect(isSameOrigin('https://subdomain.example.com/page', currentURL)).toBe(false);
  expect(isSameOrigin('https://example.com:8080/page', currentURL)).toBe(false);
});

test('isSameOrigin should handle relative URLs correctly', () => {
  const currentURL = 'https://example.com:3000/page';

  expect(isSameOrigin('/about', currentURL)).toBe(true);
  expect(isSameOrigin('./relative', currentURL)).toBe(true);
  expect(isSameOrigin('../parent', currentURL)).toBe(true);
});

test('isSameOrigin should handle invalid URLs gracefully', () => {
  const currentURL = 'https://example.com/page';

  expect(isSameOrigin('not-a-url', currentURL)).toBe(false);
  expect(isSameOrigin('', currentURL)).toBe(false);
});
