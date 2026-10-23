import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { env } from '../../config/env.validation';
import { missingConfigurationDetails } from '../../common/config/configuration-report';

/** Identity claims accepted from a verified Google ID token. */
export interface GoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
}

/**
 * Verifies Google-issued ID tokens on the server.
 *
 * `verifyIdToken` checks the RS256 signature against Google's published
 * certificates, the issuer (`accounts.google.com` / `https://accounts.google.com`),
 * the expiry, and that `aud` is one of the configured client IDs. Nothing in
 * the request body is trusted before this succeeds, and the client is never
 * allowed to choose its own audience.
 */
@Injectable()
export class GoogleTokenVerifier {
  private readonly logger = new Logger(GoogleTokenVerifier.name);
  // One client so Google's certificate cache is reused across requests.
  private readonly client = new OAuth2Client();

  async verify(idToken: string): Promise<GoogleIdentity> {
    const audiences = env().google.clientIds;
    if (audiences.length === 0) {
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message:
            'Google sign-in is not configured for this environment. Email and password sign-in still works.',
          details: missingConfigurationDetails(['GOOGLE_CLIENT_ID'], 'Google sign-in'),
        },
      });
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: audiences });
      payload = ticket.getPayload();
    } catch (error) {
      // The library's message can contain the raw token fragments, so log only
      // the reason class and never the credential itself.
      this.logger.warn(`Google ID token rejected (${(error as Error)?.name ?? 'unknown error'})`);
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'AUTH_GOOGLE_TOKEN_INVALID',
          message: 'The Google credential could not be verified. Sign in again.',
        },
      });
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'AUTH_GOOGLE_TOKEN_INVALID',
          message: 'The Google credential did not include a usable account identity.',
        },
      });
    }

    return {
      subject: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: payload.email_verified === true,
      firstName: payload.given_name || undefined,
      lastName: payload.family_name || undefined,
    };
  }
}
