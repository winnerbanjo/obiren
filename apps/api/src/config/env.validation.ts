import * as crypto from 'crypto';
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
 *
 * STAGING ESCAPE HATCH: when `ALLOW_DEGRADED_STARTUP=true`, a production-like
 * deployment boots even with required variables missing. Every gap is recorded
 * in `configIssues`, printed as a startup warning, and exposed by `GET /health`
 * so a client developer can see exactly what is unavailable. Nothing is
 * silently enabled: encryption, payments, storage and providers keep failing
 * closed, and JWT secrets are generated randomly per process (never a known
 * constant) so sessions die on restart instead of being forgeable.
 */

const DEV_DEFAULT_MONGO = 'mongodb://127.0.0.1:27017/obiren_development';

function isProd(scope: Record<string, string | undefined> = process.env): boolean {
  return scope.NODE_ENV === 'production';
}

/** One missing or invalid setting, described for humans. Never holds values. */
export interface ConfigIssue {
  variable: string;
  feature: string;
  impact: string;
  /** true = the API would refuse to start without ALLOW_DEGRADED_STARTUP. */
  required: boolean;
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
  paystack: { secretKey?: string; apiBase: string; currency: string; publicKey?: string; callbackUrl?: string };
  cloudinary: { cloudName?: string; apiKey?: string; apiSecret?: string };
  google: { clientIds: string[] };
  twilio: { accountSid?: string; authToken?: string; whatsappFrom?: string };
  email: { resendApiKey?: string; fromEmail: string; fromName: string };
  webAppUrl: string;
  throttle: { ttlMs: number; limit: number; authTtlMs: number; authLimit: number };
  idempotencyTtlSeconds: number;
  logLevel: string;
  /** True when the API started despite missing required configuration. */
  degraded: boolean;
  /** Everything missing or invalid, in readable form. Exposed by GET /health. */
  configIssues: ConfigIssue[];
}

const productionErrors: string[] = [];
const warnings: string[] = [];
const configIssues: ConfigIssue[] = [];

function recordIssue(variable: string, feature: string, impact: string, required: boolean): void {
  if (configIssues.some((issue) => issue.variable === variable)) return;
  configIssues.push({ variable, feature, impact, required });
}

function requireInProd(
  value: string | undefined,
  name: string,
  minLen = 16,
  scope: Record<string, string | undefined> = process.env,
  impact = '',
): string | undefined {
  if (value && value.length >= minLen) return value;
  if (isProd(scope)) {
    productionErrors.push(`${name} is required in production (min length ${minLen})`);
    recordIssue(name, 'Authentication', impact || 'Sign-in cannot be trusted across restarts.', true);
    return undefined;
  }
  warnings.push(`${name} not set - using development fallback`);
  recordIssue(name, 'Authentication', 'Using the development-only fallback secret.', false);
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
  configIssues.length = 0;

  const nodeEnv = (env.NODE_ENV as ValidatedEnv['nodeEnv']) || 'development';
  const port = Number(env.PORT || 3000);
  // Explicit, opt-in escape hatch for staging. Never defaulted to true.
  const allowDegradedStartup = env.ALLOW_DEGRADED_STARTUP === 'true';

  // --- MongoDB ---
  // The one genuinely indispensable setting: without a database the API can
  // start but cannot serve a single useful request, so this stays fatal even in
  // degraded staging mode (with a message that says exactly what to set).
  let mongoUri = env.MONGODB_URI;
  if (!mongoUri) {
    if (isProd(env)) {
      productionErrors.push('MONGODB_URI is required in production');
      recordIssue('MONGODB_URI', 'Database', 'No database connection; the API cannot start or serve data.', true);
    } else {
      mongoUri = DEV_DEFAULT_MONGO;
    }
  }

  // --- JWT secrets (never a known fallback) ---
  const jwtAccessSecret = requireInProd(
    env.JWT_ACCESS_SECRET,
    'JWT_ACCESS_SECRET',
    32,
    env,
    'A random secret is generated for this process, so access tokens stop working after every restart and are not shared between instances.',
  );
  const jwtRefreshSecret = requireInProd(
    env.JWT_REFRESH_SECRET,
    'JWT_REFRESH_SECRET',
    32,
    env,
    'A random secret is generated for this process, so refresh sessions stop working after every restart and are not shared between instances.',
  );
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
    recordIssue('JWT_ACCESS_SECRET', 'Authentication', 'Access and refresh secrets are identical; set two different values.', true);
  }

  // --- CORS ---
  const corsRaw = env.CORS_ORIGINS || '';
  let corsOrigins = corsRaw.split(',').map((o) => o.trim()).filter(Boolean);
  if (isProd(env) && corsOrigins.length === 0) {
    productionErrors.push('CORS_ORIGINS is required in production (comma-separated list of allowed origins)');
    recordIssue('CORS_ORIGINS', 'Browser access', 'Browser clients are blocked; native mobile clients are unaffected.', true);
  }
  if (nodeEnv !== 'production' && corsOrigins.length === 0) {
    corsOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
  }

  // --- Redis (distributed rate limiting / queues) ---
  const redisUrl = env.REDIS_URL || undefined;
  if (isProd(env) && !redisUrl) {
    productionErrors.push('REDIS_URL is required in production for distributed rate limiting and job queues');
    recordIssue('REDIS_URL', 'Rate limiting', 'Rate limits are counted per process, so they do not hold across instances.', true);
  }

  // --- Internal jobs ---
  const cronSecret = env.CRON_SECRET || undefined;
  if (isProd(env) && !cronSecret) {
    productionErrors.push('CRON_SECRET is required in production for internal cron endpoints');
    recordIssue('CRON_SECRET', 'Scheduled jobs', 'Internal cron routes reject every call, so retention and notification processing never run.', true);
  }

  // --- Payments (optional, fail closed) ---
  const paymentEnabled = env.PAYMENT_ENABLED === 'true' && Boolean(env.PAYMENT_POLICY_VERSION) && env.PAYMENT_POLICY_VERSION!.startsWith('approved:');
  const paymentPolicyVersion = paymentEnabled ? env.PAYMENT_POLICY_VERSION : undefined;
  if (env.PAYMENT_ENABLED === 'true' && !paymentEnabled) {
    productionErrors.push('PAYMENT_ENABLED requires PAYMENT_POLICY_VERSION=approved:<version>');
    recordIssue('PAYMENT_POLICY_VERSION', 'Payments', 'Checkout stays disabled because no approved policy version is configured.', true);
  }
  if (paymentEnabled && !env.PAYSTACK_SECRET_KEY) {
    productionErrors.push('PAYSTACK_SECRET_KEY is required when payments are enabled');
    recordIssue('PAYSTACK_SECRET_KEY', 'Payments', 'Checkout stays disabled until a Paystack secret key is set.', true);
  }
  // The API base and currency are configurable so sandbox/staging runs can be
  // pointed at a Paystack sandbox or a local sandbox stub. Amounts are always
  // calculated server-side in the minor unit of this currency.
  const paystack = {
    secretKey: env.PAYSTACK_SECRET_KEY || undefined,
    apiBase: (env.PAYSTACK_API_BASE || 'https://api.paystack.co').replace(/\/+$/, ''),
    currency: (env.PAYSTACK_CURRENCY || 'NGN').toUpperCase(),
    publicKey: env.PAYSTACK_PUBLIC_KEY || undefined,
    callbackUrl: env.PAYSTACK_CALLBACK_URL || undefined,
  };

  // --- Health-data encryption ---
  const healthDataEncryptionKey = env.HEALTH_DATA_ENCRYPTION_KEY || undefined;
  if (healthDataEncryptionKey) {
    const keyBytes = /^[0-9a-f]{64}$/i.test(healthDataEncryptionKey)
      ? Buffer.from(healthDataEncryptionKey, 'hex')
      : Buffer.from(healthDataEncryptionKey, 'base64');
    if (keyBytes.length !== 32) {
      productionErrors.push('HEALTH_DATA_ENCRYPTION_KEY must encode exactly 32 bytes (64 hex or base64)');
      recordIssue('HEALTH_DATA_ENCRYPTION_KEY', 'Private health notes', 'The key is the wrong length, so note and message writes return 503.', true);
    }
  } else if (isProd(env)) {
    productionErrors.push('HEALTH_DATA_ENCRYPTION_KEY is required in production for private health notes');
    recordIssue('HEALTH_DATA_ENCRYPTION_KEY', 'Private health notes', 'Daily-log notes, pregnancy notes and consultation messages return 503 instead of being stored in plaintext.', true);
  }

  // --- Email (Resend) ---
  const resendApiKey = env.RESEND_API_KEY || undefined;
  const emailFrom = env.EMAIL_FROM || 'no-reply@obiren.local';
  if (isProd(env) && !resendApiKey) {
    productionErrors.push('RESEND_API_KEY is required in production so verification and password-reset emails can be delivered');
    recordIssue('RESEND_API_KEY', 'Email delivery', 'Verification and password-reset emails are captured in-process instead of delivered; accounts can still sign in without verifying.', true);
  } else if (!resendApiKey) {
    warnings.push('RESEND_API_KEY not set - outgoing email is captured by the development/test mock provider');
    recordIssue('RESEND_API_KEY', 'Email delivery', 'Outgoing email is captured in-process, never delivered.', false);
  }
  if (isProd(env) && !env.EMAIL_FROM) {
    productionErrors.push('EMAIL_FROM is required in production (verified sender domain)');
    recordIssue('EMAIL_FROM', 'Email delivery', 'Outgoing mail has no verified sender address.', true);
  }

  // --- Google sign-in (optional; endpoint fails closed when unset) ---
  // One or more OAuth client IDs (web, iOS, Android) whose ID tokens this API
  // accepts as its audience. Comma-separated; there is no wildcard audience.
  const googleClientIds = (env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (googleClientIds.length === 0) {
    warnings.push('GOOGLE_CLIENT_ID not set - POST /auth/google returns 503 (Google sign-in disabled)');
    recordIssue('GOOGLE_CLIENT_ID', 'Google sign-in', 'POST /auth/google returns 503; email + password sign-in keeps working.', false);
  }

  // --- Optional third-party providers ---
  const cloudinary = {
    cloudName: env.CLOUDINARY_CLOUD_NAME || undefined,
    apiKey: env.CLOUDINARY_API_KEY || undefined,
    apiSecret: env.CLOUDINARY_API_SECRET || undefined,
  };
  if (isProd(env) && (!cloudinary.cloudName || !cloudinary.apiKey || !cloudinary.apiSecret)) {
    warnings.push('Cloudinary credentials incomplete - Health Vault upload/download will be unavailable');
    recordIssue('CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET', 'Health Vault', 'Upload intents and downloads return 503; no document is stored.', false);
  }

  const twilio = {
    accountSid: env.TWILIO_ACCOUNT_SID || undefined,
    authToken: env.TWILIO_AUTH_TOKEN || undefined,
    whatsappFrom: env.TWILIO_WHATSAPP_FROM || undefined,
  };
  if (isProd(env) && (!twilio.accountSid || !twilio.authToken)) {
    warnings.push('Twilio credentials incomplete - WhatsApp notifications are marked failed, never sent');
    recordIssue('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN', 'WhatsApp notifications', 'Outbound WhatsApp is marked failed and webhook signatures cannot be verified.', false);
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

  // A database is the one thing a running API cannot do without: it would boot
  // and then fail every request. It stays fatal even with the escape hatch, and
  // the message names the single variable to set.
  const missingDatabase = productionErrors.some((entry) => entry.startsWith('MONGODB_URI'));

  if (productionErrors.length > 0 && (!allowDegradedStartup || missingDatabase)) {
    const detail = productionErrors.map((entry) => `   - ${entry}`).join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n🛑 Obiren API refusing to start - invalid production configuration:\n${detail}\n`);
    if (missingDatabase && allowDegradedStartup) {
      // eslint-disable-next-line no-console
      console.error(
        '   ALLOW_DEGRADED_STARTUP waives every other setting, but MONGODB_URI is required: the API has nothing to serve without a database.\n   See docs/DEPLOYMENT_ENV_STAGING.md.\n',
      );
    }
    throw new Error(`Invalid production environment configuration:\n- ${productionErrors.join('\n- ')}`);
  }

  const degraded = allowDegradedStartup && productionErrors.length > 0;

  if (degraded) {
    const requiredMissing = configIssues.filter((issue) => issue.required).length;
    // eslint-disable-next-line no-console
    console.warn(
      `\n⚠️  Obiren API starting in DEGRADED mode (ALLOW_DEGRADED_STARTUP=true): ${requiredMissing} required setting(s) missing.\n   GET /api/v1/health lists exactly what is unavailable; see docs/DEPLOYMENT_ENV_STAGING.md.\n`,
    );
  }

  if (warnings.length > 0 && !isProd(env) && nodeEnv !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(`⚠️  Obiren environment warnings:\n${warnings.map((w) => `   - ${w}`).join('\n')}`);
  }

  // Random, per-process secrets rather than a known constant, so a degraded
  // staging deployment cannot be forged with a public default. Sessions simply
  // do not survive a restart (reported through /health).
  const ephemeralSecret = () => crypto.randomBytes(48).toString('hex');

  return {
    nodeEnv,
    port,
    mongoUri: mongoUri as string,
    jwtAccessSecret: (jwtAccessSecret || (degraded ? ephemeralSecret() : `dev-only-access-secret-change-me-000000000000`)) as string,
    jwtRefreshSecret: (jwtRefreshSecret || (degraded ? ephemeralSecret() : `dev-only-refresh-secret-change-me-00000000000`)) as string,
    corsOrigins,
    cronSecret,
    redisUrl,
    healthDataEncryptionKey,
    healthDataEncryptionKeyId: env.HEALTH_DATA_ENCRYPTION_KEY_ID || 'default',
    paymentEnabled,
    paymentPolicyVersion,
    paystack,
    cloudinary,
    google: { clientIds: googleClientIds },
    twilio,
    email: { resendApiKey, fromEmail: emailFrom, fromName: env.EMAIL_FROM_NAME || 'Obiren' },
    webAppUrl: env.WEB_APP_URL || 'http://localhost:3001',
    throttle,
    idempotencyTtlSeconds,
    logLevel,
    degraded,
    configIssues: [...configIssues],
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
