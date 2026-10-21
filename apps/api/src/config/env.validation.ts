import * as fs from 'fs';
import * as path from 'path';
import { config as loadDotEnv } from 'dotenv';

// Load the API-local development environment before any configuration is read.
// Resolve correctly from either the monorepo root or apps/api, in source and
// compiled deployments. Existing process/deployment variables take precedence.
const localEnvPath = [
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
].find((candidate) => fs.existsSync(candidate));
if (localEnvPath) loadDotEnv({ path: localEnvPath, quiet: true });

/**
 * Obiren centralised environment validation.
 *
 * Development/test safe defaults are allowed ONLY for non-security-critical
 * values. In production the process refuses to start and lists every missing
 * or invalid variable. There are never fallback secrets.
 */

const DEV_DEFAULT_MONGO = 'mongodb://127.0.0.1:27017/obiren_development';

function isProd(scope: Record<string, string | undefined> = process.env): boolean {
  return scope.NODE_ENV === 'production';
}

export interface ValidatedEnv {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongoUri: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  corsOrigins: string[];
  cronSecret?: string;
  redisUrl?: string;
  healthDataEncryptionKey?: string;
  healthDataEncryptionKeyId: string;
  paymentEnabled: boolean;
  paymentPolicyVersion?: string;
  cloudinary: { cloudName?: string; apiKey?: string; apiSecret?: string };
  twilio: { accountSid?: string; authToken?: string; whatsappFrom?: string };
  email: { resendApiKey?: string; fromEmail: string; fromName: string };
  webAppUrl: string;
  throttle: { ttlMs: number; limit: number; authTtlMs: number; authLimit: number };
  idempotencyTtlSeconds: number;
  logLevel: string;
}

const productionErrors: string[] = [];
const warnings: string[] = [];

function requireInProd(value: string | undefined, name: string, minLen = 16, scope: Record<string, string | undefined> = process.env): string | undefined {
  if (value && value.length >= minLen) return value;
  if (isProd(scope)) {
    productionErrors.push(`${name} is required in production (min length ${minLen})`);
    return undefined;
  }
  warnings.push(`${name} not set - using development fallback`);
  return undefined;
}

function positiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    productionErrors.push(`${name} must be a positive number`);
    return fallback;
  }
  return Math.floor(parsed);
}

export function validateEnv(env: Record<string, string | undefined> = process.env): ValidatedEnv {
  productionErrors.length = 0;
  warnings.length = 0;

  const nodeEnv = (env.NODE_ENV as ValidatedEnv['nodeEnv']) || 'development';
  const port = Number(env.PORT || 3000);

  // --- MongoDB ---
  let mongoUri = env.MONGODB_URI;
  if (!mongoUri) {
    if (isProd(env)) productionErrors.push('MONGODB_URI is required in production');
    else mongoUri = DEV_DEFAULT_MONGO;
  }

  // --- JWT secrets (never a known fallback) ---
  const jwtAccessSecret = requireInProd(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', 32, env);
  const jwtRefreshSecret = requireInProd(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', 32, env);
  if (isProd(env) && env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET.length < 32) {
    productionErrors.push('JWT_ACCESS_SECRET must be at least 32 characters');
  }
  if (
    isProd(env) &&
    env.JWT_ACCESS_SECRET &&
    env.JWT_REFRESH_SECRET &&
    env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET
  ) {
    productionErrors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  // --- CORS ---
  const corsRaw = env.CORS_ORIGINS || '';
  let corsOrigins = corsRaw.split(',').map((o) => o.trim()).filter(Boolean);
  if (isProd(env) && corsOrigins.length === 0) {
    productionErrors.push('CORS_ORIGINS is required in production (comma-separated list of allowed origins)');
  }
  if (nodeEnv !== 'production' && corsOrigins.length === 0) {
    corsOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
  }

  // --- Redis (distributed rate limiting / queues) ---
  const redisUrl = env.REDIS_URL || undefined;
  if (isProd(env) && !redisUrl) {
    productionErrors.push('REDIS_URL is required in production for distributed rate limiting and job queues');
  }

  // --- Internal jobs ---
  const cronSecret = env.CRON_SECRET || undefined;
  if (isProd(env) && !cronSecret) {
    productionErrors.push('CRON_SECRET is required in production for internal cron endpoints');
  }

  // --- Payments (optional, fail closed) ---
  const paymentEnabled = env.PAYMENT_ENABLED === 'true' && Boolean(env.PAYMENT_POLICY_VERSION) && env.PAYMENT_POLICY_VERSION!.startsWith('approved:');
  const paymentPolicyVersion = paymentEnabled ? env.PAYMENT_POLICY_VERSION : undefined;
  if (env.PAYMENT_ENABLED === 'true' && !paymentEnabled) {
    productionErrors.push('PAYMENT_ENABLED requires PAYMENT_POLICY_VERSION=approved:<version>');
  }
  if (paymentEnabled && !env.PAYSTACK_SECRET_KEY) {
    productionErrors.push('PAYSTACK_SECRET_KEY is required when payments are enabled');
  }

  // --- Health-data encryption ---
  const healthDataEncryptionKey = env.HEALTH_DATA_ENCRYPTION_KEY || undefined;
  if (healthDataEncryptionKey) {
    const keyBytes = /^[0-9a-f]{64}$/i.test(healthDataEncryptionKey)
      ? Buffer.from(healthDataEncryptionKey, 'hex')
      : Buffer.from(healthDataEncryptionKey, 'base64');
    if (keyBytes.length !== 32) {
      productionErrors.push('HEALTH_DATA_ENCRYPTION_KEY must encode exactly 32 bytes (64 hex or base64)');
    }
  } else if (isProd(env)) {
    productionErrors.push('HEALTH_DATA_ENCRYPTION_KEY is required in production for private health notes');
  }

  // --- Email (Resend) ---
  const resendApiKey = env.RESEND_API_KEY || undefined;
  const emailFrom = env.EMAIL_FROM || 'no-reply@obiren.local';
  if (isProd(env) && !resendApiKey) {
    productionErrors.push('RESEND_API_KEY is required in production so verification and password-reset emails can be delivered');
  } else if (!resendApiKey) {
    warnings.push('RESEND_API_KEY not set - outgoing email is captured by the development/test mock provider');
  }
  if (isProd(env) && !env.EMAIL_FROM) {
    productionErrors.push('EMAIL_FROM is required in production (verified sender domain)');
  }

  // --- Optional third-party providers ---
  const cloudinary = {
    cloudName: env.CLOUDINARY_CLOUD_NAME || undefined,
    apiKey: env.CLOUDINARY_API_KEY || undefined,
    apiSecret: env.CLOUDINARY_API_SECRET || undefined,
  };
  if (isProd(env) && (!cloudinary.cloudName || !cloudinary.apiKey || !cloudinary.apiSecret)) {
    warnings.push('Cloudinary credentials incomplete - Health Vault upload/download will be unavailable');
  }

  const twilio = {
    accountSid: env.TWILIO_ACCOUNT_SID || undefined,
    authToken: env.TWILIO_AUTH_TOKEN || undefined,
    whatsappFrom: env.TWILIO_WHATSAPP_FROM || undefined,
  };
  if (isProd(env) && (!twilio.accountSid || !twilio.authToken)) {
    warnings.push('Twilio credentials incomplete - WhatsApp notifications are marked failed, never sent');
  }

  // --- Throttling / idempotency ---
  const throttle = {
    ttlMs: positiveInt(env.THROTTLE_TTL_MS, 60_000, 'THROTTLE_TTL_MS'),
    limit: positiveInt(env.THROTTLE_LIMIT, 120, 'THROTTLE_LIMIT'),
    authTtlMs: positiveInt(env.THROTTLE_AUTH_TTL_MS, 15 * 60_000, 'THROTTLE_AUTH_TTL_MS'),
    authLimit: positiveInt(env.THROTTLE_AUTH_LIMIT, 10, 'THROTTLE_AUTH_LIMIT'),
  };
  const idempotencyTtlSeconds = positiveInt(env.IDEMPOTENCY_TTL_SECONDS, 86_400, 'IDEMPOTENCY_TTL_SECONDS');

  const logLevel = env.LOG_LEVEL || (isProd(env) ? 'info' : 'debug');

  if (productionErrors.length > 0) {
    const detail = productionErrors.map((entry) => `   - ${entry}`).join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n🛑 Obiren API refusing to start - invalid production configuration:\n${detail}\n`);
    throw new Error(`Invalid production environment configuration:\n- ${productionErrors.join('\n- ')}`);
  }

  if (warnings.length > 0 && !isProd(env) && nodeEnv !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(`⚠️  Obiren environment warnings:\n${warnings.map((w) => `   - ${w}`).join('\n')}`);
  }

  return {
    nodeEnv,
    port,
    mongoUri: mongoUri as string,
    jwtAccessSecret: (jwtAccessSecret || `dev-only-access-secret-change-me-000000000000`) as string,
    jwtRefreshSecret: (jwtRefreshSecret || `dev-only-refresh-secret-change-me-00000000000`) as string,
    corsOrigins,
    cronSecret,
    redisUrl,
    healthDataEncryptionKey,
    healthDataEncryptionKeyId: env.HEALTH_DATA_ENCRYPTION_KEY_ID || 'default',
    paymentEnabled,
    paymentPolicyVersion,
    cloudinary,
    twilio,
    email: { resendApiKey, fromEmail: emailFrom, fromName: env.EMAIL_FROM_NAME || 'Obiren' },
    webAppUrl: env.WEB_APP_URL || 'http://localhost:3001',
    throttle,
    idempotencyTtlSeconds,
    logLevel,
  };
}

let cached: ValidatedEnv | null = null;
export function env(): ValidatedEnv {
  if (!cached) cached = validateEnv();
  return cached;
}

/** Test-only: clear the memoized config so validateEnv can run again. */
export function resetEnvCache(): void {
  cached = null;
}
