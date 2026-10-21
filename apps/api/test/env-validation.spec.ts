import { validateEnv } from '../src/config/env.validation';
import { shouldExposeDevTokens } from '../src/common/auth/token-exposure';

const completeProduction = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/obiren_prod_like',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  CORS_ORIGINS: 'https://app.example.test',
  REDIS_URL: 'redis://127.0.0.1:6379',
  CRON_SECRET: 'cron-secret-value',
  HEALTH_DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM: 'no-reply@example.test',
};

describe('Startup environment validation', () => {
  it('fails fast and lists every missing production variable', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(/MONGODB_URI/);
    try {
      validateEnv({ NODE_ENV: 'production' });
    } catch (error: unknown) {
      const message = String(error instanceof Error ? error.message : error);
      for (const name of [
        'MONGODB_URI',
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'CORS_ORIGINS',
        'REDIS_URL',
        'CRON_SECRET',
        'HEALTH_DATA_ENCRYPTION_KEY',
        'RESEND_API_KEY',
        'EMAIL_FROM',
      ]) {
        expect(message).toContain(name);
      }
    }
  });

  it('accepts a complete production configuration', () => {
    const config = validateEnv(completeProduction);
    expect(config.nodeEnv).toBe('production');
    expect(config.redisUrl).toBe(completeProduction.REDIS_URL);
    expect(config.email.resendApiKey).toBe(completeProduction.RESEND_API_KEY);
  });

  it('rejects non-numeric or non-positive throttle settings', () => {
    expect(() => validateEnv({ ...completeProduction, THROTTLE_LIMIT: '0' })).toThrow(/THROTTLE_LIMIT/);
    expect(() => validateEnv({ ...completeProduction, THROTTLE_AUTH_LIMIT: 'many' })).toThrow(/THROTTLE_AUTH_LIMIT/);
  });

  it('requires payment approval metadata whenever payments are enabled', () => {
    expect(() => validateEnv({ ...completeProduction, PAYMENT_ENABLED: 'true' })).toThrow(/PAYMENT_POLICY_VERSION/);
    expect(() =>
      validateEnv({
        ...completeProduction,
        PAYMENT_ENABLED: 'true',
        PAYMENT_POLICY_VERSION: 'approved:2026-10',
      }),
    ).toThrow(/PAYSTACK_SECRET_KEY/);
  });
});

describe('Dev-only token exposure', () => {
  it('is impossible outside development and test', () => {
    expect(shouldExposeDevTokens('production')).toBe(false);
    expect(shouldExposeDevTokens('staging')).toBe(false);
    expect(shouldExposeDevTokens('PRODUCTION')).toBe(false);
    expect(shouldExposeDevTokens('')).toBe(false);
    expect(shouldExposeDevTokens('development')).toBe(true);
    expect(shouldExposeDevTokens('test')).toBe(true);
  });
});
