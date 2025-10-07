import { boolean, date, model, string } from 'blade/schema';

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
