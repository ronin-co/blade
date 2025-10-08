import { boolean, date, link, model, string } from 'blade/schema';

export const Account = model({
  slug: 'account',
  fields: {
    email: string({ unique: true }),
    emailVerified: boolean(),
    emailVerificationToken: string(),
    emailVerificationSentAt: date(),
    password: string(),
  },
});

export const Session = model({
  slug: 'session',
  fields: {
    account: link({
      target: 'account',
      actions: {
        onDelete: 'CASCADE',
      },
    }),
    browser: string(),
    browserVersion: string(),
    os: string(),
    osVersion: string(),
    deviceType: string(),
  },
});
