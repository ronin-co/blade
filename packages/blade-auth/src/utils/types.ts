import type { Account } from 'blade/types';

type EmailType = 'ACCOUNT_CREATION' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION_RESEND';
type EmailOptions = { account: Account; type: EmailType; token: string };

export interface AuthConfig {
  sendEmail?: (options: EmailOptions) => Promise<void>;
}
