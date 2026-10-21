export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  providerMessageId?: string;
}

/**
 * Provider-agnostic email boundary. Swapping providers (Resend, SES, ...)
 * must not touch auth or safety code.
 */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
