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

  /**
   * Doctor invitation / activation link. The token is single-use and expiring;
   * no password is ever created or shared by an administrator.
   */
  async sendDoctorInvitationEmail(to: string, token: string, displayName: string): Promise<void> {
    const base = (process.env.DOCTOR_PORTAL_URL || 'http://localhost:3003').replace(/\/$/, '');
    const link = `${base}/doctor/activate?token=${encodeURIComponent(token)}`;
    await this.provider.send({
      to,
      subject: 'Your Obiren Doctor Portal invitation',
      text: [
        `Hello ${displayName},`,
        '',
        'An Obiren account has been created for you as a doctor.',
        'Set your password and open your Doctor Portal here:',
        link,
        '',
        'This link expires in 7 days and can be used once.',
        'Obiren staff will never ask you for your password.',
      ].join('\n'),
      html: `<p>Hello ${displayName},</p><p>An Obiren account has been created for you as a doctor.</p><p><a href="${link}">Set your password and open your Doctor Portal</a></p><p>This link expires in 7 days and can be used once. Obiren staff will never ask you for your password.</p>`,
    });
  }

  /**
   * Appointment notice. Deliberately free of clinical detail so it is safe on a
   * locked screen and in a shared inbox.
   */
  async sendAppointmentEmail(to: string, title: string, body: string, deepLink?: string): Promise<void> {
    const base = (process.env.DOCTOR_PORTAL_URL || 'http://localhost:3003').replace(/\/$/, '');
    const link = deepLink ? `${base}${deepLink}` : base;
    await this.provider.send({
      to,
      subject: `Obiren: ${title}`,
      text: [body, '', 'Open Obiren:', link, '', 'This message contains no clinical detail. Sign in to see the appointment.'].join('\n'),
      html: `<p>${body}</p><p><a href="${link}">Open Obiren</a></p><p>This message contains no clinical detail. Sign in to see the appointment.</p>`,
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
