import { verifyPassword } from 'better-auth/crypto';
import { InvalidFieldsError, MultipleWithInstructionsError } from 'blade/errors';
import { getRecordIdentifier, signJWT } from 'blade/server/utils';
import type { QueryType, Session, Trigger, TriggerType } from 'blade/types';

import { AUTH_SECRET, getSessionCookie } from '@/utils/index';
import type { AuthConfig } from '@/utils/types';
import { triggers } from 'blade/schema';

const primeId: Trigger<TriggerType, QueryType> = async ({
  query,
  cookies,
  multipleRecords,
}) => {
  if (query.with) return query;
  query.with = {};

  const { sessionId, accountId } = await getSessionCookie(cookies);

  if (multipleRecords) {
    query.with.account = accountId;
  } else {
    query.with.id = sessionId;
  }

  return query;
};

export default (_authConfig?: AuthConfig) => {
  return triggers<Session>({
    get: primeId,

    add: async ({
      query,
      navigator,
      client,
      parentTrigger,
      context,
      cookies,
      setCookie,
    }) => {
      const { userAgent } = navigator;
      const { get } = client;

      if (!query.with) throw new Error('A `with` instruction must be given.');

      if (Array.isArray(query.with)) throw new MultipleWithInstructionsError();

      // Prepare a new Session.
      query.with = {
        ...query.with,

        // We provide the ID here because we need to access it further down below.
        id: getRecordIdentifier('ses'),
        browser: userAgent?.browser || null,
        browserVersion: userAgent?.browserVersion || null,
        os: userAgent?.os || null,
        osVersion: userAgent?.osVersion || null,
        deviceType: userAgent?.deviceType || null,
      };

      // Unless being invoked from a parent trigger, which is the case when automatically
      // creating a new session for a fresh account, look up the account and compare the
      // provided password against the stored hash.
      if (!parentTrigger) {
        const providedAccount = query.with.account as
          | { email: string; password: string }
          | { emailVerificationToken: string };

        // Resolve the account.
        const account = await get.account.with(
          'password' in providedAccount
            ? { email: providedAccount.email }
            : { emailVerificationToken: providedAccount.emailVerificationToken },
        );

        const error = new InvalidFieldsError({
          fields: Object.keys(providedAccount).map((field) => `account.${field}`),
        });

        // If no matching account was found, throw an error.
        if (!account) throw error;

        // If a password was provided, check if it matches the password that was stored for
        // the account. If not, throw an error.
        if (
          'password' in providedAccount &&
          !(await verifyPassword({
            hash: account.password,
            password: providedAccount.password,
          }))
        ) {
          throw error;
        }

        // If an email verification token was provided, check if it matches the email
        // verification token that was stored for the account. If not, throw an error.
        if ('emailVerificationToken' in providedAccount) {
          if (account.emailVerificationToken === providedAccount.emailVerificationToken) {
            context.set('accountToVerify', account.id);
            context.set('emailVerificationToken', providedAccount.emailVerificationToken);
          } else {
            throw error;
          }
        }
        // Set the ID of the account.
        query.with.account = account.id;
      }

      // Create a new token for the session.
      const token = await signJWT(
        {
          iss: 'ronin',
          sub: query.with.id,
          aud: query.with.account,
          iat: Math.floor(Date.now() / 1000),
        },
        AUTH_SECRET,
      );

      // Add a new `session` cookie containing the session token.
      setCookie('session', token);

      // If an `account` cookie is available from the signup, remove it now.
      if (cookies.account) setCookie('account', null);

      return query;
    },

    afterAdd: ({ query, client, context }) => {
      if (!query.with) throw new Error('A `with` instruction must be given.');

      if (Array.isArray(query.with)) throw new MultipleWithInstructionsError();

      const { set } = client;
      const accountToVerify = context.get('accountToVerify');

      if (accountToVerify) {
        const emailVerificationToken = context.get('emailVerificationToken');

        return () => [
          set.account({
            with: {
              id: accountToVerify,
              emailVerified: false,
              emailVerificationToken,
            },
            to: {
              emailVerified: true,
            },
          }),
        ];
      }

      return [];
    },

    remove: async (options) => {
      const { query, setCookie } = options;
      await primeId(options);

      // Remove the `session` cookie that contains the session token.
      setCookie('session', null);

      return query;
    },
  });
};
