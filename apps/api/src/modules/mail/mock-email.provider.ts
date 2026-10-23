import { randomUUID } from 'crypto';
import { EmailMessage, EmailProvider, EmailSendResult } from './email.provider';

export interface CapturedEmail extends EmailMessage {
  id: string;
  capturedAt: string;
}

/**
 * In-process capture used by tests and by development when no Resend key is
 * configured. Nothing is transmitted; callers must not report a delivery.
 */
export const emailOutbox: CapturedEmail[] = [];

export function resetEmailOutbox(): void {
  emailOutbox.length = 0;
}

export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const id = `mock_${randomUUID()}`;
    emailOutbox.push({ ...message, id, capturedAt: new Date().toISOString() });
    return { providerMessageId: id };
  }
}
