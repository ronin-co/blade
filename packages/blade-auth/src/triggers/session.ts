import { verifyPassword } from 'better-auth/crypto';
import { InvalidFieldsError, MultipleWithInstructionsError } from 'blade/server/errors';
import { getRecordIdentifier, signJWT } from 'blade/server/utils';
import type { AddTrigger, GetTrigger, RemoveTrigger, SetTrigger } from 'blade/types';

import { parseSessionCookie } from '@/utils/index';

const primeId: GetTrigger = async (query, multiple, options) => {
  const { sessionId, accountId } = await parseSessionCookie(options);

  if (!query.with) query.with = {};

  if (multiple) {
    // @ts-expect-error Query types will be fixed in the future.
    query.with.accountId = accountId;
  } else {
    // @ts-expect-error Query types will be fixed in the future.
    query.with.id = sessionId;
  }

  return query;
};

export const get: GetTrigger = (query, multiple, options) => {
  return primeId(query, multiple, options);
};

export const add: AddTrigger = async (query, _multiple, options) => {
  const { userAgent } = options.navigator;
  const { get } = options.client;

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
  if (!options.parentTrigger) {
    const providedAccount = query.with.account as { email: string; password: string };

    // Resolve the account.
    const account = await get.account.with({ email: providedAccount.email });

    // If no account was found or its password doesn't match, throw an error.
    //
    // For security reasons, we mark both fields as invalid to avoid disclosing the
    // existance of certain email addresses.
    if (
      !(
        account &&
        (await verifyPassword({
          hash: account.password,
          password: providedAccount.password,
        }))
      )
    ) {
      throw new InvalidFieldsError({
        fields: ['account.email', 'account.password'],
      });
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
    import.meta.env.BLADE_SESSION_JWT_SECRET as string,
  );

  // Persist the Token in a cookie.
  options.setCookie('token', token);

  return query;
};

export const remove: RemoveTrigger = (query, multiple, options) => {
  return primeId(query, multiple, options);
};

export const set: SetTrigger = async (query) => query;
