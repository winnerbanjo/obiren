import { Global, Module } from '@nestjs/common';
import { env } from '../../config/env.validation';
import { EMAIL_PROVIDER, EmailProvider } from './email.provider';
import { MailService } from './mail.service';
import { MockEmailProvider } from './mock-email.provider';
import { ResendEmailProvider } from './resend-email.provider';

/**
 * Tests always capture email in-process, even if a developer has a Resend key
 * in their local .env. Development without a key also uses the capture
 * provider; production validates that the key and sender are present.
 */
export function selectEmailProvider(config = env()): EmailProvider {
  if (config.nodeEnv === 'test' || !config.email.resendApiKey) {
    return new MockEmailProvider();
  }
  return new ResendEmailProvider(config.email.resendApiKey, config.email.fromEmail, config.email.fromName);
}

@Global()
@Module({
  providers: [
    { provide: EMAIL_PROVIDER, useFactory: () => selectEmailProvider() },
    MailService,
  ],
  exports: [MailService, EMAIL_PROVIDER],
})
export class MailModule {}
