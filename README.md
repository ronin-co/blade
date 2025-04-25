# RONIN Blade

This package allows for building instant web apps with [React](https://react.dev).

## Features

- **Native Data State Management** (built-in React hooks for reads and mutations)
- **Native Pagination** (built-in React hooks for paginating lists of records)
- **Native Styling** (Tailwind CSS support with zero config)
- **Client & Server Components** (code is not shipped to the client by default, unless you opt in)
- **Web Standard Compliant** (outputs a req/res worker + static files that run anywhere — also runs in containers)
- **No Data Waterfalls** (queries are collected across layouts and pages to ensure a single DB transaction)
- **Instant Prod Builds** (no compiler, only relies on Bun and loaders)
- **Zero Config** (only `pages/index.tsx` and `package.json` are [needed](https://github.com/ronin-co/blade/tree/main/examples/basic) to get Blade to run)
- **Automatic REST API** (Blade auto-generates a REST API at `/api` for you, for models that you want to expose)

Blade works most efficiently when using [RONIN](https://ronin.co) — a globally replicable database powered by SQLite. Blade is and will always be usable with any other data source as well, however you will see performance drawbacks if that datasource isn't equally fast.

The first and currently largest known implementation of Blade is the [RONIN](https://ronin.co) dashboard (its code is currently closed, but will be opened up very soon), which has been implemented with Blade since its inception.

## Considerations

Blade purposefully does not (and likely won't ever) comply with the official specification for React Server Components, because it provides different solutions to the problems that RSC aims to solve.

- **No Server Functions** (instead of executing arbitrary code, the only way to invoke the server in Blade is through a [mutation](#usemutation-client))
- **No Async Components** (I/O leads to slow code, so reads in Blade are always synchronous, but async behind the scenes)
- **No Suspense** (Blade does not support reads on the client — server components can only read and client components can only write)

## Temporary Limitations

- You can already deploy Blade anywhere, but in terms of zero-config, Blade currently only works in containers. Zero-config support for Vercel, Cloudflare, and all other providers will land very soon.
- Tailwind v4 (only v3) is not yet supported. Support will land very soon.
- The experimental React version defined in our [examples](https://github.com/ronin-co/blade/tree/main/examples/basic) is currently required. Support for the latest stable version will follow very soon.

## Setup

To get started with Blade, first make sure you have [Bun](https://bun.sh) installed, which is a JavaScript runtime.

Next, create a new app with this command:

```bash
bunx @ronin/blade init
```

Afterward, enter the newly created directory and install the dependencies:

```bash
cd blade-example
bun install
```

Lastly, start the development server:

```bash
bun run dev
```

## API

Blade provides the following programmatic APIs that can be imported from your app:

### React Hooks

#### `useLocation` (Universal)

Mimics [document.location](https://developer.mozilla.org/en-US/docs/Web/API/Document/location) and thereby exposes a `URL` object containing the URL of the current page.

Unlike in `document.location`, however, the URL is not populated, so dynamic path segments of pages will not be populated with their respective value.

```tsx
import { useLocation } from '@ronin/blade/universal/hooks';

const location = useLocation();
```

#### `useParams` (Universal)

Exposes the keys and values of all parameters (dynamic path segments) present in the URL.

For example, if the URL being accessed is `/elaine` and the page is named `[handle].tsx`, the returned object would be `{ handle: 'elaine' }`.

```tsx
import { useParams } from '@ronin/blade/universal/hooks';

const params = useParams();
```

#### `useRedirect` (Universal)

Used to transition to a different page.

```tsx
import { useRedirect } from '@ronin/blade/universal/hooks';

const redirect = useRedirect();

redirect('/pathname');
```

The following options are available:

```tsx
redirect('/pathname', {
    // If the pathname provided to `redirect()` contains dynamic segments, such as
    // `/[handle]`, you can provide a value for those segments here.
    extraParams: { handle: 'elaine' },

    // If a part of your app relies on React state that is also reflected in the URL
    // (e.g. this often happens with `?search` text), you can avoid keeping React state
    // by using this option and simply reading the output of `useLocation()`.
    //
    // However note that this option is only available on the client.
    immediatelyUpdateQueryParams: true
});
```

#### `usePopulatePathname` (Universal)

As mentioned in the docs for `useLocation()`, dynamic path segments (such as `/[handle]`) are not populated in the `URL` object exposed by the hook.

To populate them, you can pass the pathname to the `usePopulatePathname()` hook.

```tsx
import { usePopulatePathname } from '@ronin/blade/universal/hooks';

const populatePathname = usePopulatePathname();

// Assuming that the URL being accessed is `/elaine` and the page is called
// `[handle].tsx`, this would output `/elaine`.
populatePathname('/[handle]');
```

The following options are available:

```tsx
populatePathname('/[handle]', {
    // May be used to provide values for params that are present in the pathname that was
    // provided to `populatePathname()`, but are not present in the current URL. This is
    // essentially a clean way of using `populatePathname(`/${params.handle}`)`.
    extraParams: { handle: 'elaine' }
});
```

#### `useNavigator` (Universal)

Mimics [window.navigator](https://developer.mozilla.org/en-US/docs/Web/API/Window/navigator) and thereby exposes an object containing details about the current user agent.

```tsx
import { useNavigator } from '@ronin/blade/universal/hooks';

const navigator = useNavigator();

navigator.userAgent; // See MDN docs
navigator.languages; // See MDN docs
navigator.geoLocation; // See MDN docs (currently under construction)
```

#### `useMutation` (Client)

Allows for performing data mutations and updates all `use` queries accordingly.

The function exposes all [write query types](https://ronin.co/docs/queries/types) available on RONIN, but any other data source may be used instead as well.

```tsx
import { useMutation } from '@ronin/blade/client/hooks';

const { set, add, remove, batch } = useMutation();

await set.account({
    with: { handle: 'elaine' },
    to: { handle: 'mia' }
});

await add.account.with.handle('elaine');
await remove.account.with.handle('elaine');

// If you need to run multiple mutation queries serially, use a single transaction to
// avoid unnecessary hops to the database.
await batch(() => [
    set.account({
        with: { handle: 'elaine' },
        to: { handle: 'mia' }
    }),
    add.account.with.handle('elaine'),
    remove.account.with.handle('elaine')
]);
```

When a mutation happens, its queries are combined with any potential read queries that might be necessary to update the `use` hooks on the current path and sent to the database as a single transaction.

The following options are available for all query types:

```tsx
await add.account.with.handle('elaine', {
    // Render a different page after the mutation has been completed.
    redirect: '/accounts/elaine',

    // For the above, you may also decide to access the result of the mutation, such that
    // the pathname of the destination page depends on the mutation result.
    //
    // The curly braces represent a segment that will be replaced with the result of the
    // mutation query. The number (0) indicates the item in the list of results (when
    // using `batch`, you might have multiple queries) and the string ("handle")
    // indicates the slug of the field that should be used.
    redirect: '/accounts/{0.handle}'
});
```

#### `usePagination` (Client)

Allows for paginating a read query and thereby modifies the result of the respective `use` hook associated with that read query.

For example, you might use the following read query in your page (on the server):

```tsx
import { use } from '@ronin/blade/server/hooks';
import SomeComponent from './components/test.client';

const Page = () => {
    const accounts = use.accounts();

    return <SomeComponent records={accounts} recordsNextPage={accounts.nextPage}>;
}
```

Within `SomeComponent` (which must be a client component, identified through `.client` in its name), you could then paginate the list of records you've retrieved like this:

```tsx
import { usePagination } from '@ronin/blade/client/hooks';

export const SomeComponent = ({ records, recordsNextPage }) => {
    const { paginate, resetPagination } = usePagination(recordsNextPage);

    return (
        <div>
            <button onClick={() => paginate()}>Show next page</button>
            <button onClick={() => resetPagination()}>Show initial page</button>
        </div>;
    );
};
```

The following options are available:

```tsx
usePagination(nextPage, {
    // By default, a `?page` parameter will be added to the URL, which allows for sharing
    // the current pagination status of the page with other people. Setting this argument
    // to `false` will avoid that.
    //
    // For example, if you're paginating a large list of records in the middle of your
    // page, you should likely use the default value, such that users can share a link
    // to a particular page of records with other people.
    //
    // If you're paginating a list of records within an overlay, however, for example,
    // you should set this to `false`, since people don't need to be able to link to a
    // specific page of records within an overlay that's nested deeply into your UI.
    updateAddressBar: true
});
```

#### `usePaginationBuffer` (Client)

Concatenates arrays based on pagination. Whenever the current paginated page changes, the
provided items will be concatenated with the previously provided list of items.

When implementing pagination in an application, one of the key considerations is how to efficiently manage the complete array of records, since your backend should only ever return a single page at once, and never the full list, as the latter would degrade performance and affect memory usage.

When displaying a list of records, `usePaginationBuffer` automates this for you. You simply provide it with the result of a read query, and it intelligently concatenates the result of the query for you, allowing you to operate on the full list of records if needed.

For example, you might use the following read query in your page (on the server):

```tsx
import { use } from '@ronin/blade/server/hooks';
import SomeComponent from './components/test.client';

const Page = () => {
    const accounts = use.accounts();

    return (
        <SomeComponent previousPage={accounts.previousPage} nextPage={accounts.nextPage}>
            {accounts.map(account => <Row record={account} />)}
        </SomeComponent>;
    );
}
```

Within `SomeComponent` (which must be a client component, identified through `.client` in its name), you could then concatenate the list of records like so:

```tsx
import { usePagination, usePaginationBuffer } from '@ronin/blade/client/hooks';

export const SomeComponent = ({ children: defaultChildren, nextPage, previousPage }) => {
    const { paginate, resetPagination } = usePagination(nextPage);
    const [children] = usePaginationBuffer(defaultChildren, { previousPage });

    return <div>{children}</div>;
};
```

This allows for shipping the least amount of code to the client, because the entire layout (including `Row`, with the only exception being `SomeComponent`) will be rendered only on the server, so no unnecessary code will leave the server.

The following options are available:

```tsx
usePaginationBuffer(list, {
    // The pagination cursor for the previous page of your record list. Must be provided.
    previousPage: '...',

    // By default, any changes to `list` will be reflected in the concatenated list
    // returned by `usePaginationBuffer()`. This default is useful because that means
    // automatically revalidated read queries will see their results reflected.
    //
    // However, if you want to force a list to untouched by revalidation, you can set
    // this option to `false`, which will result in the returned list staying static,
    // even if the provided `list` is modified.
    //
    // For example, if you are paginating a list of records within an overlay, you might
    // want the list of records within the overlay to never automatically update.
    allowUpdates: true
});
```

You may also decide to pass a TypeScript generic with the type of provided array item:

```tsx
usePaginationBuffer<ReactElement>();
```

#### `useLinkOnClick` (Client)

In the majority of cases, you should use Blade's `<Link>` component to display links that should automatically result in a page transition (links pointing to external pages should just use anchor elements).

In the rare scenario that you need to capture the `onClick` event of a link element yourself for other purposes, however, you can use `useLinkOnClick` to trigger the same `onClick` behavior that would normally be triggered for a `<Link>` component instance.

For example, if a drag-and-drop system is used, it might want to overwrite the click handler and then choose to fire the user-provided one whenever it deems it to be a good idea, instead of the browser immediately firing it after `onMouseUp`.

```tsx
import { useLinkOnClick } from '@ronin/blade/client/hooks';

const onClick = useLinkOnClick('/pathname');

<button onClick={event => onClick(event)}>I am a link</button>
```

#### `use` (Server)

Usually, in React, the [use](https://react.dev/reference/react/use) hook is used to consume a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) or [context](https://react.dev/learn/passing-data-deeply-with-context).

In Blade, however, since Blade purposefully does not support Suspense and also does not support asynchronous components, the hook is used to load data instead.

Specifically, the hook reflects the full capabilities of the [RONIN query syntax](https://ronin.co/docs/queries) (which is as powerful as SQL) and thereby allows for easily querying records on your database.

By default, if you provide a `BLADE_APP_TOKEN` environment variable that contains a RONIN app token, these queries will simply target your RONIN database. However, if the environment variable is not provided, any other data source can be defined using data hooks instead (documentation for those will follow).

```tsx
import { use } from '@ronin/blade/server/hooks';

const Page = () => {
    // "accounts" would be the name of your model.
    const records = use.accounts();

    return <>{records.map(record => <span>{record.name}</span>)}</>;
};
```

The queries you provide can be as complex as you would like them to be (see the [query syntax docs](https://ronin.co/docs/queries) for more details on what you can do):

```tsx
import { use } from '@ronin/blade/server/hooks';

const records = use.members({
    with: {
        team: { notBeing: null },
        email: { endingWith: '@site.co' }
    },
    orderedBy: {
        descending: ['joinedAt']
    }
});
```

Note that, in order to avoid data waterfalls, data can only be read in server components. On the client, data can only be [modified](#usemutation-client).

The queries of your page and its surrounding layouts are executed as a single database transaction, in order to ensure instant page renders.

To run multiple queries within a single layout or page, the `useBatch` hook can be used:

```tsx
import { useBatch } from '@ronin/blade/server/hooks';

const [accounts, posts] = useBatch(() => [
    use.accounts(),
    use.posts()
]);
```

To count records, the `useCountOf` hook can be used with the same syntax as the `use` hook.

#### `useCookie` (Server)

Allows for reading and writing cookies on the server. The cookies are attached to the headers of the resulting HTTP request before the JSX stream of React elements begins.

```tsx
import { useCookie } from '@ronin/blade/server/hooks';

const Page = () => {
    const [tokenCookie, setTokenCookie] = useCookie('token');

    if (!tokenCookie) setTokenCooke('a-value');

    return <div>I am a page</div>;
};
```

The following options are available:

```tsx
setCookie('a-value', {
    // By default, cookies are set as HTTP-only. To let JavaScript access them in the
    // browser, you can set this option to `true`.
    client: false,

    // By default, cookies receive a path value of "/". You can customize it using this
    // option if needed.
    path: '/'
});
```

The max age of cookies currently defaults to 365 days, which is not yet customizable.

#### `useMetadata` (Server)

#### `useMutationResult` (Server)

#### `useJWT` (Server)

### Revalidation (Stale-While-Revalidate, SWR)

Blade intelligently keeps your data up-to-date for you, so no extra state management is needed for the output of your read queries. The data is refreshed:

- When a [mutation](#usemutation-client) happens (in the same DB transaction as the mutation).
- Every 5 seconds while the window is in focus.
- When the window gains focus.
- When the device was offline and goes back online.

Even the application itself is revalidated. Whenever you deploy a new version of your web app, Blade will detect the drift and synchronize itself between server and client, resolving the new client assets in the browser and replacing the UI with the updated code. This currently happens immediately, but will soon be limited to when the browser window is inactive.

Lastly, even React iself is revalidated. If you upgrade React, Blade will unmount the old React on the client, mount the new React, and then re-mount your application.

## Contributing

To start contributing code, first make sure you have [Bun](https://bun.sh) installed, which is a JavaScript runtime.

Next, [clone the repo](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) and install its dependencies:

```bash
bun install
```

Once that's done, link the package to make it available to all of your local projects:

```bash
bun link
```

Inside your project, you can then run the following command, which is similar to `bun add @ronin/blade` or `npm install @ronin/blade`, except that it doesn't install `@ronin/blade` from npm, but instead uses your local clone of the package:

```bash
bun link @ronin/blade
```

If your project is not yet compatible with [Bun](https://bun.sh), feel free to replace all of the occurrences of the word `bun` in the commands above with `npm` instead.

You will just need to make sure that, once you [create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request#creating-the-pull-request) on the current repo, it will not contain a `package-lock.json` file, which is usually generated by npm. Instead, we're using the `bun.lockb` file for this purpose (locking sub dependencies to a certain version).

### Running Tests

Before you create a pull request on the `blade` repo, it is advised to run its tests in order to ensure everything works as expected:

```bash
# Run all tests
bun run test

# Alternatively, run a single test
bun run test -- -t 'your test name'
```
