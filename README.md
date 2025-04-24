# RONIN Blade

This package renders [React](https://react.dev) at the edge.

## Setup

To get started with Blade, run the following command:

```bash
npx @ronin/blade init
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

### `usePopulatePathname` (Universal)

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

### `useNavigator` (Universal)

Mimics [window.navigator](https://developer.mozilla.org/en-US/docs/Web/API/Window/navigator) and thereby exposes an object containing details about the current user agent.

```tsx
import { useNavigator } from '@ronin/blade/universal/hooks';

const navigator = useNavigator();

navigator.userAgent; // See MDN docs
navigator.languages; // See MDN docs
navigator.geoLocation; // See MDN docs (currently under construction)
```

### `useMutation` (Client)

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
    // using `batch`, you might have multiple queries) and the string ("handle") indicates
    // the slug of the field that should be used.
    redirect: '/accounts/{0.handle}'
});
```

### `usePagination` (Client)

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

### `usePaginationBuffer` (Client)

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
    const [children] = usePaginationBuffer<ReactElement>(defaultChildren, { previousPage });

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

### `useLinkOnClick` (Client)

In the majority of cases, you should use Blade's `<Link>` component to display links that should automatically result in a page transition (links pointing to external pages should just use anchor elements).

In the rare scenario that you need to capture the `onClick` event of a link element yourself for other purposes, however, you can use `useLinkOnClick` to trigger the same `onClick` behavior that would normally be triggered for a `<Link>` component instance.

For example, if a drag-and-drop system is used, it might want to overwrite the click handler and then choose to fire the user-provided one whenever it deems it to be a good idea, instead of the browser immediately firing it after `onMouseUp`.

```tsx
import { useLinkOnClick } from '@ronin/blade/client/hooks';

const onClick = useLinkOnClick('/pathname');

<button onClick={event => onClick(event)}>I am a link</button>
```

### `use` (Server)

### `useCookie` (Server)

### `useMetadata` (Server)

### `useMutationResult` (Server)

### `useJWT` (Server)

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