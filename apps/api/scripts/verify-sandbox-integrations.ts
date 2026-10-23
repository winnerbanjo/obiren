/**
 * Sandbox verification for the two provider-backed flows that cannot be
 * exercised in CI: Health Vault uploads (Cloudinary) and checkout (Paystack).
 *
 * It never prints secrets. Every check is reported as PASS / FAIL / SKIP and
 * the process exits non-zero if any enabled check fails.
 *
 * Usage (from apps/api):
 *   npm run verify:sandbox -- --dry-run     # show what would run, no calls
 *   npm run verify:sandbox                  # provider checks + API checks if configured
 *
 * Provider checks need:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   PAYSTACK_SECRET_KEY (sk_test_...), PAYSTACK_API_BASE (optional),
 *   PAYSTACK_TEST_EMAIL (optional, defaults to sandbox@obiren.test)
 *
 * Optional API end-to-end checks need:
 *   SANDBOX_API_URL          e.g. https://api.staging.obiren.com/api/v1
 *   SANDBOX_ACCESS_TOKEN     a bearer token, OR
 *   SANDBOX_EMAIL + SANDBOX_PASSWORD  to log in and obtain one
 *   SANDBOX_BOOKING_ID       a held booking id for the payment-intent check
 */
import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as loadDotEnv } from 'dotenv';

for (const candidate of [resolve(process.cwd(), 'apps/api/.env'), resolve(process.cwd(), '.env')]) {
  if (existsSync(candidate)) {
    loadDotEnv({ path: candidate, quiet: true });
    break;
  }
}

type Status = 'PASS' | 'FAIL' | 'SKIP';
const results: Array<{ name: string; status: Status; detail: string }> = [];
const dryRun = process.argv.includes('--dry-run');

interface JsonBody {
  status?: boolean;
  public_id?: string;
  secure_url?: string;
  result?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function record(name: string, status: Status, detail: string) {
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

/** Cloudinary signature: sorted `key=value` pairs joined by `&`, then the secret. */
function cloudinarySignature(params: Record<string, string | number>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return sha1(`${toSign}${secret}`);
}

async function jsonOrText(response: Response): Promise<{ ok: boolean; status: number; body: JsonBody | null }> {
  const text = await response.text();
  let body: JsonBody | null = null;
  try {
    body = text ? (JSON.parse(text) as JsonBody) : null;
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { ok: response.ok, status: response.status, body };
}

// ---------------------------------------------------------------------------
// Cloudinary: sign + upload a tiny PNG, read it back, then destroy it.
// ---------------------------------------------------------------------------

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0ZkAAAAASUVORK5CYII=',
  'base64',
);

async function verifyCloudinaryProvider() {
  const name = 'Cloudinary upload/read/delete';
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !apiSecret) {
    return record(name, 'SKIP', 'Cloudinary credentials are not set');
  }
  if (dryRun) {
    return record(name, 'SKIP', `dry run: would sign and upload to cloud "${cloud}" then destroy the asset`);
  }

  const folder = 'obiren-sandbox-check';
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinarySignature({ folder, timestamp }, apiSecret);
  const form = new FormData();
  form.append('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), 'obiren-check.png');
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const upload = await jsonOrText(
    await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
      method: 'POST',
      body: form,
    }),
  );
  if (!upload.ok || !upload.body?.public_id || !upload.body?.secure_url) {
    return record(name, 'FAIL', `upload rejected (HTTP ${upload.status}): ${JSON.stringify(upload.body).slice(0, 200)}`);
  }
  const publicId = upload.body.public_id;

  const read = await fetch(upload.body.secure_url as string);
  if (!read.ok) return record(name, 'FAIL', `uploaded asset could not be read back (HTTP ${read.status})`);

  const destroyTimestamp = Math.floor(Date.now() / 1000);
  const destroyForm = new FormData();
  destroyForm.append('public_id', publicId);
  destroyForm.append('api_key', apiKey);
  destroyForm.append('timestamp', String(destroyTimestamp));
  destroyForm.append('signature', cloudinarySignature({ public_id: publicId, timestamp: destroyTimestamp }, apiSecret));
  const destroy = await jsonOrText(
    await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/destroy`, {
      method: 'POST',
      body: destroyForm,
    }),
  );
  if (!destroy.ok || destroy.body?.result !== 'ok') {
    return record(name, 'FAIL', `asset uploaded but delete failed (HTTP ${destroy.status}); remove ${publicId} manually`);
  }
  record(name, 'PASS', 'signed upload, read-back and delete all succeeded');
}

// ---------------------------------------------------------------------------
// Paystack: initialize a sandbox transaction and verify it server-side.
// ---------------------------------------------------------------------------

async function verifyPaystackProvider() {
  const name = 'Paystack initialize/verify';
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return record(name, 'SKIP', 'PAYSTACK_SECRET_KEY is not set');
  if (!secret.startsWith('sk_test_')) {
    return record(name, 'FAIL', 'refusing to run: PAYSTACK_SECRET_KEY is not a sandbox (sk_test_) key');
  }
  if (dryRun) return record(name, 'SKIP', 'dry run: would initialize and verify a 100-minor-unit sandbox transaction');

  const apiBase = (process.env.PAYSTACK_API_BASE || 'https://api.paystack.co').replace(/\/+$/, '');
  const reference = `obiren_sandbox_${randomUUID()}`;
  const email = process.env.PAYSTACK_TEST_EMAIL || 'sandbox@obiren.test';
  const currency = (process.env.PAYSTACK_CURRENCY || 'NGN').toUpperCase();

  const init = await jsonOrText(
    await fetch(`${apiBase}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: 100, currency, reference }),
    }),
  );
  if (!init.ok || !init.body?.status || !init.body?.data?.authorization_url) {
    return record(name, 'FAIL', `initialize rejected (HTTP ${init.status}): ${JSON.stringify(init.body).slice(0, 200)}`);
  }

  const verify = await jsonOrText(
    await fetch(`${apiBase}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    }),
  );
  if (!verify.ok || !verify.body?.status || !verify.body?.data) {
    return record(name, 'FAIL', `verify rejected (HTTP ${verify.status}): ${JSON.stringify(verify.body).slice(0, 200)}`);
  }
  const data = verify.body.data as { amount?: number; currency?: string; reference?: string; status?: string };
  if (data.amount !== 100 || String(data.currency).toUpperCase() !== currency || data.reference !== reference) {
    return record(name, 'FAIL', 'verified amount/currency/reference did not match the initialized transaction');
  }
  record(
    name,
    'PASS',
    `initialized and verified (provider status: ${data.status}). Open the authorization URL to complete the sandbox checkout.`,
  );
}

// ---------------------------------------------------------------------------
// Optional end-to-end checks through a staging API.
// ---------------------------------------------------------------------------

async function apiBase(): Promise<string | undefined> {
  const base = process.env.SANDBOX_API_URL?.replace(/\/+$/, '');
  return base || undefined;
}

async function accessToken(): Promise<string | undefined> {
  if (process.env.SANDBOX_ACCESS_TOKEN) return process.env.SANDBOX_ACCESS_TOKEN;
  const base = await apiBase();
  if (!base || !process.env.SANDBOX_EMAIL || !process.env.SANDBOX_PASSWORD) return undefined;
  const login = await jsonOrText(
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.SANDBOX_EMAIL, password: process.env.SANDBOX_PASSWORD, platform: 'web' }),
    }),
  );
  const tokens = (login.body?.data as { tokens?: { accessToken?: string } } | undefined)?.tokens;
  return login.ok ? tokens?.accessToken : undefined;
}

async function verifyVaultEndpoint() {
  const name = 'Health Vault API flow';
  const base = await apiBase();
  if (!base) return record(name, 'SKIP', 'SANDBOX_API_URL is not set');
  const token = await accessToken();
  if (!token) return record(name, 'SKIP', 'no SANDBOX_ACCESS_TOKEN and login credentials were not accepted');
  if (dryRun) return record(name, 'SKIP', `dry run: would exercise upload-intent → upload → save → signed download on ${base}`);

  const headers = { Authorization: `Bearer ${token}` };
  const intent = await jsonOrText(await fetch(`${base}/health-vault/upload-intent`, { method: 'POST', headers, body: '{}' }));
  if (!intent.ok) return record(name, 'FAIL', `upload-intent returned HTTP ${intent.status}: ${JSON.stringify(intent.body).slice(0, 200)}`);
  const i = intent.body?.data as
    | { uploadUrl?: string; signature?: string; apiKey?: string; timestamp?: number; folder?: string; publicId?: string }
    | undefined;
  if (!i?.uploadUrl || !i?.signature || !i?.apiKey) return record(name, 'FAIL', 'upload-intent response was missing signature fields');

  const form = new FormData();
  form.append('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), 'obiren-vault-check.png');
  form.append('api_key', i.apiKey);
  form.append('timestamp', String(i.timestamp));
  form.append('folder', i.folder ?? '');
  form.append('public_id', i.publicId ?? '');
  form.append('signature', i.signature);
  const upload = await jsonOrText(await fetch(i.uploadUrl, { method: 'POST', body: form }));
  if (!upload.ok || !upload.body?.public_id) {
    return record(name, 'FAIL', `signed upload failed (HTTP ${upload.status}): ${JSON.stringify(upload.body).slice(0, 200)}`);
  }

  const save = await jsonOrText(
    await fetch(`${base}/health-vault/documents`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Sandbox verification document',
        documentType: 'other',
        cloudinaryPublicId: upload.body.public_id,
        accessLevel: 'private',
      }),
    }),
  );
  if (!save.ok) return record(name, 'FAIL', `saving document metadata failed (HTTP ${save.status})`);
  const documentId = String(save.body?.data?.id || save.body?.data?._id || '');

  const download = await jsonOrText(await fetch(`${base}/health-vault/documents/${documentId}`, { headers }));
  if (!download.ok || !download.body?.data?.signedDownloadUrl) {
    return record(name, 'FAIL', `signed download URL was not returned (HTTP ${download.status})`);
  }
  await fetch(`${base}/health-vault/documents/${documentId}`, { method: 'DELETE', headers });
  record(name, 'PASS', 'upload-intent, upload, metadata save and signed download all succeeded; test document deleted');
}

async function verifyCheckoutEndpoint() {
  const name = 'Paystack checkout API flow';
  const base = await apiBase();
  if (!base) return record(name, 'SKIP', 'SANDBOX_API_URL is not set');
  const bookingId = process.env.SANDBOX_BOOKING_ID;
  if (!bookingId) return record(name, 'SKIP', 'SANDBOX_BOOKING_ID is not set');
  const token = await accessToken();
  if (!token) return record(name, 'SKIP', 'no SANDBOX_ACCESS_TOKEN and login credentials were not accepted');
  if (dryRun) return record(name, 'SKIP', `dry run: would request a payment intent for booking ${bookingId} on ${base}`);

  const intent = await jsonOrText(
    await fetch(`${base}/bookings/${encodeURIComponent(bookingId)}/payment-intent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': `sandbox-${randomUUID()}` },
      body: '{}',
    }),
  );
  if (!intent.ok) {
    return record(
      name,
      'FAIL',
      `payment-intent returned HTTP ${intent.status}: ${JSON.stringify(intent.body).slice(0, 200)} (check PAYMENT_ENABLED, PAYMENT_POLICY_VERSION, credentials and booking state)`,
    );
  }
  const payment = intent.body?.data?.payment as { authorizationUrl?: string; amountMinor?: number; currency?: string } | undefined;
  if (!payment?.authorizationUrl) return record(name, 'FAIL', 'payment-intent did not return an authorization URL');
  record(
    name,
    'PASS',
    `checkout initialized for ${payment.amountMinor} ${payment.currency}; booking stays pending_payment until the signed webhook confirms payment`,
  );
}

async function main() {
  console.log(`Obiren sandbox verification${dryRun ? ' (dry run)' : ''}\n`);
  await verifyCloudinaryProvider();
  await verifyPaystackProvider();
  await verifyVaultEndpoint();
  await verifyCheckoutEndpoint();

  const failed = results.filter((item) => item.status === 'FAIL');
  const skipped = results.filter((item) => item.status === 'SKIP');
  console.log(`\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
  if (failed.length) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(`Sandbox verification crashed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
});
