# RONIN Client

[![tests](https://img.shields.io/github/actions/workflow/status/ronin-co/client/validate.yml?label=tests)](https://github.com/ronin-co/client/actions/workflows/validate.yml)
[![code coverage](https://img.shields.io/codecov/c/github/ronin-co/client)](https://codecov.io/github/ronin-co/client)
[![install size](https://packagephobia.com/badge?p=blade-client)](https://packagephobia.com/result?p=blade-client)

This package allows for querying data from [RONIN](https://ronin.co) with ease.

## Setup

First, install the [package](https://www.npmjs.com/package/blade-client) with a package manager of your choice:

```bash
# Bun
bun add blade-client

# npm
npm install blade-client
```

Next, create a new app token on the [RONIN dashboard](http://ronin.co) (under "Apps" in the sidebar), and add it as a environment variable named `RONIN_TOKEN` to your project.

Afterward, you can start invoking RONIN from anywhere in your code:

```typescript
import { get } from 'blade-client';

const posts = await get.posts();
```

That's it! 🎉

You can now start inserting records with the [RONIN query syntax](https://ronin.co/docs/queries), or add them on the [RONIN dashboard](http://ronin.co). Everything you can do with the RONIN client, you can also do on the dashboard (creating records, retrieving them, filtering them, updating them, etc).

## Contributing

We would be excited to welcome your suggestions for the RONIN client!

To start contributing code, first make sure you have [Bun](https://bun.sh) installed, which is a JavaScript runtime.

Next, [clone the repo](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) and install its dependencies:

```bash
bun install
```

Once that's done, link the package to make it available to all of your local projects:

```bash
bun link
```

Inside your project, you can then run the following command, which is similar to `bun add blade-client` or `npm install blade-client`, except that it doesn't install `blade-client` from npm, but instead uses your local clone of the package:

```bash
bun link blade-client
```

If your project is not yet compatible with [Bun](https://bun.sh), feel free to replace all of the occurances of the word `bun` in the commands above with `npm` instead.

You will just need to make sure that, once you [create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request#creating-the-pull-request) on the current repo, it will not contain a `package-lock.json` file, which is usually generated by npm. Instead, we're using the `bun.lock` file for this purpose (locking sub dependencies to a certain version).

### Developing

In order to be compatible with a wide range of projects, the source code of the `client` repo needs to be compiled (transpiled) whenever you make changes to it. To automate this, you can keep this command running in your terminal:

```bash
bun run dev
```

Whenever you make a change to the source code, it will then automatically be transpiled again.

### Running Tests

The RONIN client has 100% test coverage, which means that every single line of code is tested automatically, to ensure that any change to the source code doesn't cause a regression.

Before you create a pull request on the `client` repo, it is therefore advised to run those tests in order to ensure everything works as expected:

```bash
# Run all tests
bun test

# Alternatively, run a single test
bun test -t 'your test name'
```
