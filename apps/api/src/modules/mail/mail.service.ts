import { Inject, Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env.validation';
import { EMAIL_PROVIDER, EmailProvider } from './email.provider';

/**
 * Composes transactional auth emails. Bodies contain only the single-use link
 * and generic account language - never health information.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}

  get providerName(): string {
    return this.provider.name;
  }

  private webUrl(): string {
    return (env().webAppUrl || 'http://localhost:3001').replace(/\/$/, '');
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.webUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    await this.provider.send({
      to,
      subject: 'Verify your Obiren email',
      text: [
        'Welcome to Obiren.',
        '',
        'Confirm your email address to finish creating your account:',
        link,
        '',
        'This link expires in 24 hours. If you did not create an account, ignore this email.',
      ].join('\n'),
      html: `<p>Welcome to Obiren.</p><p>Confirm your email address to finish creating your account:</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours. If you did not create an account, ignore this email.</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.webUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await this.provider.send({
      to,
      subject: 'Reset your Obiren password',
      text: [
        'A password reset was requested for your Obiren account.',
        '',
        'Choose a new password here:',
        link,
        '',
        'This link expires in one hour and can be used once.',
        'If you did not request a reset, you can safely ignore this email.',
      ].join('\n'),
      html: `<p>A password reset was requested for your Obiren account.</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in one hour and can be used once. If you did not request a reset, you can safely ignore this email.</p>`,
    });
  }

  /** Fire-and-forget wrapper: an email outage must not fail registration. */
  async trySend(label: string, send: () => Promise<void>): Promise<boolean> {
    try {
      await send();
      return true;
    } catch (error: unknown) {
      this.logger.warn(`${label} email could not be sent (${error instanceof Error ? error.name : 'unknown_error'})`);
      return false;
    }
  }
}
