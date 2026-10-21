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
 * Obiren centralized environment validation.
 *
 * Development/test safe defaults are allowed ONLY for non-security-critical
 * values. Security-critical values (JWT secrets, MongoDB URI, Cloudinary,
 * Twilio, cron secret) MUST be provided in production - the process exits
 * at startup otherwise. Never silently fall back to known defaults.
 */

const DEV_DEFAULT_MONGO = 'mongodb://127.0.0.1:27017/obiren_development';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export interface ValidatedEnv {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongoUri: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  corsOrigins: string[];
  cronSecret?: string;
  healthDataEncryptionKey?: string;
  healthDataEncryptionKeyId: string;
  paymentEnabled: boolean;
  paymentPolicyVersion?: string;
  cloudinary: { cloudName?: string; apiKey?: string; apiSecret?: string };
  twilio: { accountSid?: string; authToken?: string; whatsappFrom?: string };
  mail: { mailtrapToken?: string; fromEmail?: string; fromName?: string };
  logLevel: string;
}

const productionErrors: string[] = [];
const warnings: string[] = [];

function requireInProd(value: string | undefined, name: string, minLen = 16): string | undefined {
  if (value && value.length >= minLen) return value;
  if (isProd()) {
    productionErrors.push(`${name} is required in production (min length ${minLen})`);
    return undefined;
  }
  warnings.push(`${name} not set - using development fallback`);
  return undefined;
}

export function validateEnv(env: Record<string, string | undefined> = process.env): ValidatedEnv {
  const nodeEnv = (env.NODE_ENV as ValidatedEnv['nodeEnv']) || 'development';
  const port = Number(env.PORT || 3000);

  // --- MongoDB ---
  let mongoUri = env.MONGODB_URI;
  if (!mongoUri) {
    if (isProd()) productionErrors.push('MONGODB_URI is required in production');
    else mongoUri = DEV_DEFAULT_MONGO;
  }

  // --- JWT secrets (never a known fallback) ---
  const jwtAccessSecret = requireInProd(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', 32);
  const jwtRefreshSecret = requireInProd(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', 32);
  if (isProd() && env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET.length < 32) {
    productionErrors.push('JWT_ACCESS_SECRET must be at least 32 characters');
  }
  if (
    isProd() &&
    env.JWT_ACCESS_SECRET &&
    env.JWT_REFRESH_SECRET &&
    env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET
  ) {
    productionErrors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  // --- CORS ---
  const corsRaw = env.CORS_ORIGINS || '';
  let corsOrigins = corsRaw.split(',').map((o) => o.trim()).filter(Boolean);
  if (isProd() && corsOrigins.length === 0) {
    productionErrors.push('CORS_ORIGINS is required in production (comma-separated list of allowed origins)');
  }
  if (nodeEnv !== 'production' && corsOrigins.length === 0) {
    corsOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
  }

  // --- Optional integrations (warn, do not block, but never default to fake secrets) ---
  const cronSecret = env.CRON_SECRET || undefined;
  if (isProd() && !cronSecret) {
    productionErrors.push('CRON_SECRET is required in production for internal cron endpoints');
  }

  const paymentEnabled = env.PAYMENT_ENABLED === 'true' && Boolean(env.PAYMENT_POLICY_VERSION) && env.PAYMENT_POLICY_VERSION.startsWith('approved:');
  const paymentPolicyVersion = paymentEnabled ? env.PAYMENT_POLICY_VERSION : undefined;
  if (env.PAYMENT_ENABLED === 'true' && !paymentEnabled) productionErrors.push('PAYMENT_ENABLED requires PAYMENT_POLICY_VERSION=approved:<version>');
  if (paymentEnabled && !env.PAYSTACK_SECRET_KEY) productionErrors.push('PAYSTACK_SECRET_KEY is required when payments are enabled');

  const healthDataEncryptionKey = env.HEALTH_DATA_ENCRYPTION_KEY || undefined;
  if (healthDataEncryptionKey) {
    const keyBytes = /^[0-9a-f]{64}$/i.test(healthDataEncryptionKey)
      ? Buffer.from(healthDataEncryptionKey, 'hex')
      : Buffer.from(healthDataEncryptionKey, 'base64');
    if (keyBytes.length !== 32) productionErrors.push('HEALTH_DATA_ENCRYPTION_KEY must encode exactly 32 bytes (64 hex or base64)');
  } else if (isProd()) {
    productionErrors.push('HEALTH_DATA_ENCRYPTION_KEY is required in production for private health notes');
  }

  const cloudinary = {
    cloudName: env.CLOUDINARY_CLOUD_NAME || undefined,
    apiKey: env.CLOUDINARY_API_KEY || undefined,
    apiSecret: env.CLOUDINARY_API_SECRET || undefined,
  };
  if (isProd() && (!cloudinary.cloudName || !cloudinary.apiKey || !cloudinary.apiSecret)) {
    warnings.push('Cloudinary credentials incomplete - Health Vault upload/download will be unavailable');
  }

  const twilio = {
    accountSid: env.TWILIO_ACCOUNT_SID || undefined,
    authToken: env.TWILIO_AUTH_TOKEN || undefined,
    whatsappFrom: env.TWILIO_WHATSAPP_FROM || undefined,
  };
  if (isProd() && (!twilio.accountSid || !twilio.authToken)) {
    warnings.push('Twilio credentials incomplete - WhatsApp notifications will be simulated and marked as such');
  }

  const mail = {
    mailtrapToken: env.MAILTRAP_TOKEN || undefined,
    fromEmail: env.MAILTRAP_FROM_EMAIL || 'no-reply@obiren.local',
    fromName: env.MAILTRAP_FROM_NAME || 'Obiren',
  };

  const logLevel = env.LOG_LEVEL || (isProd() ? 'info' : 'debug');

  if (productionErrors.length > 0) {
    // Fail fast - do not boot an insecure production process.
    // eslint-disable-next-line no-console
    console.error(
      `\n🛑 Obiren API refusing to start - invalid production configuration:\n` +
        productionErrors.map((e) => `   - ${e}`).join('\n') +
        `\n`,
    );
    throw new Error(`Invalid production environment configuration:\n- ${productionErrors.join('\n- ')}`);
  }

  if (warnings.length > 0 && !isProd()) {
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
    healthDataEncryptionKey,
    healthDataEncryptionKeyId: env.HEALTH_DATA_ENCRYPTION_KEY_ID || 'default',
    paymentEnabled,
    paymentPolicyVersion,
    cloudinary,
    twilio,
    mail,
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
