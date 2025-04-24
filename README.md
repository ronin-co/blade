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

```typescript
const location = useLocation();
```

#### `useParams` (Universal)

Exposes the keys and values of all parameters (dynamic path segments) present in the URL.

For example, if the URL being accessed is `/elaine` and the page is named `[handle].tsx`, the returned object would be `{ handle: 'elaine' }`.

```typescript
const params = useParams();
```

#### `useRedirect` (Universal)

Used to transition to a different page.

```typescript
const redirect = useRedirect();

redirect('/pathname');
```

The following options are available:

```typescript
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

```typescript
const populatePathname = usePopulatePathname();

// Assuming that the URL being accessed is `/elaine` and the page is called
// `[handle].tsx`, this would output `/elaine`.
populatePathname('/[handle]');
```

The following options are available:

```typescript
populatePathname('/[handle]', {
    // May be used to provide values for params that are present in the pathname that was
    // provided to `populatePathname()`, but are not present in the current URL. This is
    // essentially a clean way of using `populatePathname(`/${params.handle}`)`.
    extraParams: { handle: 'elaine' }
});
```

### `useNavigator` (Universal)

Mimics [window.navigator](https://developer.mozilla.org/en-US/docs/Web/API/Window/navigator) and thereby exposes an object containing details about the current user agent.

```typescript
const navigator = useNavigator();

navigator.userAgent; // See MDN docs
navigator.languages; // See MDN docs
navigator.geoLocation; // See MDN docs (currently under construction)
```

### `useMutation` (Client)

Allows for performing data mutations and updates all `use` queries accordingly.

The function exposes all [write query types](https://ronin.co/docs/queries/types) available on RONIN, but any other data source may be used instead as well.

```typescript
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

```typescript
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

### `usePaginationBuffer` (Client)

### `useLinkOnClick` (Client)

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