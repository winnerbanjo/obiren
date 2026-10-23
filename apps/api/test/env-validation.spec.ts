import { validateEnv } from '../src/config/env.validation';
import { configurationSummary } from '../src/common/config/configuration-report';
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

describe('Degraded staging startup', () => {
  const stagingMinimum = {
    NODE_ENV: 'production',
    ALLOW_DEGRADED_STARTUP: 'true',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/obiren_staging',
  };

  it('still refuses to start without the explicit flag', () => {
    expect(() => validateEnv({ ...stagingMinimum, ALLOW_DEGRADED_STARTUP: 'false' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('keeps MONGODB_URI mandatory because nothing can be served without it', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', ALLOW_DEGRADED_STARTUP: 'true' })).toThrow(/MONGODB_URI/);
  });

  it('boots and records every missing setting in readable form', () => {
    const config = validateEnv(stagingMinimum);

    expect(config.degraded).toBe(true);
    expect(config.mongoUri).toBe(stagingMinimum.MONGODB_URI);

    const requiredMissing = config.configIssues.filter((issue) => issue.required).map((issue) => issue.variable);
    for (const name of [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'CORS_ORIGINS',
      'REDIS_URL',
      'CRON_SECRET',
      'HEALTH_DATA_ENCRYPTION_KEY',
      'RESEND_API_KEY',
      'EMAIL_FROM',
    ]) {
      expect(requiredMissing).toContain(name);
    }
    // Every entry explains the consequence, not just the name.
    for (const issue of config.configIssues) {
      expect(issue.feature.length).toBeGreaterThan(0);
      expect(issue.impact.length).toBeGreaterThan(10);
    }
  });

  it('generates distinct random JWT secrets instead of a known fallback', () => {
    const first = validateEnv(stagingMinimum);
    const second = validateEnv(stagingMinimum);

    expect(first.jwtAccessSecret.length).toBeGreaterThanOrEqual(32);
    expect(first.jwtRefreshSecret.length).toBeGreaterThanOrEqual(32);
    expect(first.jwtAccessSecret).not.toBe(first.jwtRefreshSecret);
    // Per-process, not a constant a third party could forge tokens with.
    expect(first.jwtAccessSecret).not.toBe(second.jwtAccessSecret);
    expect(first.jwtAccessSecret).not.toContain('change-me');
  });

  it('keeps gated features disabled rather than pretending they work', () => {
    const config = validateEnv({ ...stagingMinimum, PAYMENT_ENABLED: 'true', PAYSTACK_SECRET_KEY: 'sk_test_stub' });

    expect(config.paymentEnabled).toBe(false);
    expect(config.configIssues.some((issue) => issue.variable === 'PAYMENT_POLICY_VERSION')).toBe(true);
    expect(config.cloudinary.cloudName).toBeUndefined();
    expect(config.google.clientIds).toEqual([]);
  });

  it('reports a complete production configuration as not degraded', () => {
    const config = validateEnv(completeProduction);
    expect(config.degraded).toBe(false);
    expect(config.configIssues.filter((issue) => issue.required)).toHaveLength(0);
  });
});

describe('Configuration summary (startup log and GET /health)', () => {
  it('lists names and impacts only, never secret values', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      ALLOW_DEGRADED_STARTUP: 'true',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/obiren_staging',
      HEALTH_DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });

    const summary = configurationSummary(config);
    const serialised = JSON.stringify(summary);

    expect(summary.degraded).toBe(true);
    expect(summary.requiredMissing).toBeGreaterThan(0);
    expect(summary.docs).toBe('docs/DEPLOYMENT_ENV_STAGING.md');
    expect(summary.missing[0].required).toBe(true);
    expect(serialised).not.toContain(config.jwtAccessSecret);
    expect(serialised).not.toContain(config.jwtRefreshSecret);
    expect(serialised).not.toContain('0123456789abcdef');
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
