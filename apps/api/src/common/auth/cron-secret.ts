import { UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * Internal-cron authentication.
 *
 * Three transports are accepted so any scheduler can call these routes without
 * a bespoke adapter:
 *   - `X-Cron-Secret: <CRON_SECRET>` (operator scripts, docs)
 *   - `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends automatically
 *     when CRON_SECRET is configured on the project)
 *   - `?cronSecret=<CRON_SECRET>` (legacy; discouraged because URLs are logged)
 *
 * Denied whenever CRON_SECRET is unset, in every environment. There is no
 * fallback value.
 */
export interface CronCredential {
  headerSecret?: string;
  querySecret?: string;
  authorization?: string;
}

export function assertCronSecret(credential: CronCredential): void {
  const expected = process.env.CRON_SECRET;
  const bearer = /^Bearer\s+(.+)$/i.exec(credential.authorization ?? '')?.[1]?.trim();
  const provided = credential.headerSecret || credential.querySecret || bearer;

  if (!expected || !provided) {
    throw new UnauthorizedException('Invalid or missing cron credential');
  }

  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');
  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    throw new UnauthorizedException('Invalid or missing cron credential');
  }
}
