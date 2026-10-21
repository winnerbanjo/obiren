import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailMessage, EmailProvider, EmailSendResult } from './email.provider';

/**
 * Real Resend integration. Credentials only come from the environment; the
 * API key never leaves the server.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const { data, error } = await this.client.emails.send({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });

    if (error) {
      // Provider error type only - never log the recipient or body.
      this.logger.error(`Resend delivery failed (${error.name})`);
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'EMAIL_PROVIDER_UNAVAILABLE',
          message: 'The email provider could not accept the message. Please retry later.',
        },
      });
    }

    return { providerMessageId: data?.id };
  }
}
