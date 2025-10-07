import type { Account } from 'blade/types';

type AppendArg<F, A> = F extends (this: infer T, ...args: infer P) => infer R
  ? (this: T, ...args: [...P, A]) => R
  : never;

type EmailType = 'PASSWORD_RESET' | 'EMAIL_VERIFICATION';
type EmailOptions = { account: Account; type: EmailType; token: string };

interface AuthOptions {
  sendEmail?: (options: EmailOptions) => Promise<void>;
}

export type WithAuthOptions<Trigger> = AppendArg<Trigger, AuthOptions>;
