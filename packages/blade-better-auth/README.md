# Better Auth + RONIN

[![tests](https://img.shields.io/github/actions/workflow/status/ronin-co/better-auth/validate.yml?label=tests)](https://github.com/ronin-co/better-auth/actions/workflows/validate.yml)
[![code coverage](https://img.shields.io/codecov/c/github/ronin-co/better-auth)](https://codecov.io/github/ronin-co/better-auth)
[![install size](https://packagephobia.com/badge?p=blade-better-auth)](https://packagephobia.com/result?p=blade-better-auth)

A [Better Auth adapter](https://www.better-auth.com/docs/concepts/database#adapters) for storing session data in [RONIN](https://ronin.co/) with ease.

## Usage

```typescript
import { betterAuth } from 'better-auth';
import { ronin } from "blade-better-auth";

const auth = betterAuth({
  database: ronin(),
  // ...
});
```

Or if you want to use a custom client instance:

```typescript
import { betterAuth } from 'better-auth';
import { ronin } from "blade-better-auth";
import { createSyntaxFactory } from 'blade-client';

const client = createSyntaxFactory({
  token: process.env.RONIN_TOKEN,
});

const auth = betterAuth({
  database: ronin(client),
  // ...
});
```

## Schema

Better Auth requires a number of schema models / tables to be created in your database. This is referred to in the Better Auth documentation as the "core schema".

To help get started, here is that "core schema" translated to a RONIN database schema:

```ts
// schema/index.ts

import { blob, boolean, date, link, model, string } from 'blade/schema';

export const User = model({
  slug: 'user',
  fields: {
    email: string({ required: true, unique: true }),
    emailVerified: boolean({ required: true }),
    image: blob(),
    name: string({ required: true }),
  },
});

export const Session = model({
  slug: 'session',
  fields: {
    expiresAt: date({ required: true }),
    ipAddress: string(),
    token: string({ required: true, unique: true }),
    userId: link({ required: true, target: 'user' }),
    userAgent: string(),
  },
});

export const Account = model({
  slug: 'account',
  pluralSlug: 'accounts',
  fields: {
    accessToken: string(),
    accessTokenExpiresAt: date(),
    accountId: string({ required: true }),
    idToken: string(),
    password: string(),
    providerId: string({ required: true }),
    refreshToken: string(),
    refreshTokenExpiresAt: date(),
    scope: string(),
    userId: link({ required: true, target: 'user' }),
  },
});

export const Verification = model({
  slug: 'verification',
  pluralSlug: 'verifications',
  fields: {
    expiresAt: date({ required: true }),
    identifier: string({ required: true }),
    value: string({ required: true }),
  },
});
```

## Testing

Use the following command to run the test suite:

```
bun test
```
