# RONIN CLI

[![tests](https://img.shields.io/github/actions/workflow/status/ronin-co/cli/validate.yml?label=tests)](https://github.com/ronin-co/cli/actions/workflows/validate.yml)
[![code coverage](https://img.shields.io/codecov/c/github/ronin-co/cli)](https://codecov.io/github/ronin-co/cli)
[![install size](https://packagephobia.com/badge?p=@ronin/cli)](https://packagephobia.com/result?p=@ronin/cli)

This package exposes the `ronin` command, which you can run from your terminal to interact with [RONIN](https://ronin.co).

## Setup

You don't need to install this package explicitly, as it is already included in the [RONIN client](https://github.com/ronin-co/client).

However, we would be excited to welcome your feature suggestions or bug fixes for the RONIN CLI. Read on to learn more about how to suggest changes.

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

Inside the [@ronin/client](https://github.com/ronin-co/client) repo (which imports `@ronin/cli` and registers it as an executable), you can then run the following command, which is similar to `bun add @ronin/cli` or `npm install @ronin/cli`, except that it doesn't install `@ronin/cli` from npm, but instead uses your local clone of the package:

```bash
bun link @ronin/cli
```

### Transpilation

In order to be compatible with a wide range of projects, the source code of the `cli` repo needs to be compiled (transpiled) whenever you make changes to it. To automate this, you can keep this command running in your terminal:

```bash
bun run dev
```

Whenever you make a change to the source code, it will then automatically be transpiled again.

### Running Tests

The RONIN CLI has 100% test coverage, which means that every single line of code is tested automatically, to ensure that any change to the source code doesn't cause a regression.

Before you create a pull request on the `cli` repo, it is therefore advised to run those tests in order to ensure everything works as expected:

```bash
# Run all tests
bun test

# Alternatively, run a single test
bun test -t 'your test name'
```
