import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env.validation';

export interface PaymentInitializationInput {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  metadata: Record<string, unknown>;
}

export interface PaymentInitialization {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaymentVerification {
  status: 'success' | 'failed' | 'pending' | 'abandoned' | 'unknown';
  amountMinor: number | null;
  currency: string | null;
  reference: string;
  gatewayTransactionId?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Paystack adapter.
 *
 * Only this class knows the provider protocol. Checkout is enabled only when
 * `PAYMENT_ENABLED` and an approved `PAYMENT_POLICY_VERSION` exist *and* a
 * secret key is configured; otherwise every call fails closed and no booking
 * state changes. Amounts are always supplied by the server.
 */
@Injectable()
export class PaystackProvider {
  private readonly logger = new Logger(PaystackProvider.name);

  /** True only when payments are approved AND credentials are present. */
  isEnabled(): boolean {
    return Boolean(env().paymentEnabled && env().paystack.secretKey);
  }

  /** The secret used for webhook signatures; clients never receive it. */
  webhookSecret(): string | undefined {
    return env().paystack.secretKey;
  }

  /**
   * Constant-time verification of the `x-paystack-signature` header, which is
   * an HMAC-SHA512 of the raw request body keyed with the secret key.
   */
  verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
    const secret = this.webhookSecret();
    if (!secret || !rawBody || !signature) return false;
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const provided = Buffer.from(signature, 'utf8');
    const expectedBytes = Buffer.from(expected, 'utf8');
    if (provided.length !== expectedBytes.length) return false;
    return timingSafeEqual(provided, expectedBytes);
  }

  /** Stable hash of a webhook payload, stored for replay/audit evidence. */
  payloadHash(rawBody: Buffer): string {
    return createHash('sha256').update(rawBody).digest('hex');
  }

  async initialize(input: PaymentInitializationInput): Promise<PaymentInitialization> {
    const data = await this.request<{
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    }>('/transaction/initialize', 'POST', {
      email: input.email,
      amount: input.amountMinor,
      currency: input.currency,
      reference: input.reference,
      metadata: input.metadata,
      ...(env().paystack.callbackUrl ? { callback_url: env().paystack.callbackUrl } : {}),
    });

    if (!data?.authorization_url || !data?.access_code) {
      throw new ServiceUnavailableException('The payment provider did not return a checkout URL. No payment was taken.');
    }
    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference || input.reference,
    };
  }

  /** Server-side truth for a transaction; never trust webhook amounts alone. */
  async verify(reference: string): Promise<PaymentVerification> {
    const data = await this.request<{
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
      id?: number | string;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, 'GET');

    const status = data?.status;
    return {
      status:
        status === 'success' || status === 'failed' || status === 'pending' || status === 'abandoned'
          ? status
          : 'unknown',
      amountMinor: typeof data?.amount === 'number' ? data.amount : null,
      currency: typeof data?.currency === 'string' ? data.currency.toUpperCase() : null,
      reference: data?.reference || reference,
      gatewayTransactionId: data?.id !== undefined ? String(data.id) : undefined,
    };
  }

  private async request<T>(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<T | null> {
    const secret = env().paystack.secretKey;
    if (!secret) throw new ServiceUnavailableException('Payment credentials are not configured. No payment was attempted.');

    let response: Response;
    try {
      response = await fetch(`${env().paystack.apiBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Network failure or timeout: never report success, never mutate state.
      this.logger.error(`Payment provider request failed (${method} ${path}): ${(error as Error)?.name || 'Error'}`);
      throw new ServiceUnavailableException('The payment provider is unreachable. No payment was taken.');
    }

    const payload = (await response.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: T }
      | null;

    if (!response.ok || !payload?.status) {
      this.logger.error(`Payment provider rejected ${method} ${path}: HTTP ${response.status}`);
      throw new ServiceUnavailableException('The payment provider rejected the request. No payment was taken.');
    }
    return (payload.data ?? null) as T | null;
  }
}
