# Obiren — credentials and keys checklist

Everything the API and web apps read from the environment, why it is needed,
and what stays switched off while it is missing. Values belong in
`apps/api/.env` for local development and in the Vercel project environment
(Production / Preview / Development) for deployments. Never commit real values;
`apps/api/.env.example` is the template.

Production rule: with `NODE_ENV=production` the API refuses to start and lists
every missing required variable. There are no secret fallbacks.

## 1. Must have before launch (API will not start in production without these)

| Variable | What it is | Where to get it | If missing |
| --- | --- | --- | --- |
| `MONGODB_URI` | MongoDB connection string (`mongodb+srv://...`) | MongoDB Atlas → Database → Connect → Drivers; create a dedicated DB user and restrict network access | Production start fails |
| `JWT_ACCESS_SECRET` | Access-token signing secret, ≥32 chars, must differ from refresh | Generate: `openssl rand -base64 48` | Production start fails |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret, ≥32 chars | Generate separately: `openssl rand -base64 48` | Production start fails |
| `HEALTH_DATA_ENCRYPTION_KEY` | AES-256-GCM key for private notes and messages; exactly 32 bytes | Generate: `openssl rand -hex 32`. Store in the secret manager and back it up — losing it makes existing ciphertext unreadable | Production start fails; note/message writes return 503 |
| `HEALTH_DATA_ENCRYPTION_KEY_ID` | Label for the active key (rotation/audit) | Choose a name, e.g. `prod-2026-10` | Defaults to `default` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins | Your deployed web/admin domains, e.g. `https://app.obiren.com,https://admin.obiren.com` | Production start fails; no cross-origin browser access |
| `REDIS_URL` | Redis for distributed rate limits and job queues | Upstash Redis or Redis Cloud; use the TLS `rediss://` URL | Production start fails; throttling falls back to in-process only |
| `CRON_SECRET` | Shared secret for `X-Cron-Secret` on internal cron routes | Generate: `openssl rand -hex 32`; configure the same value in the scheduler | Production start fails; cron routes are denied |
| `RESEND_API_KEY` | Transactional email (verification, password reset) | Resend → API Keys (create a sending-only key) | Production start fails; dev/test use an in-process capture provider |
| `EMAIL_FROM` | Verified sender address, e.g. `no-reply@obiren.com` | Resend → Domains; add SPF/DKIM DNS records, then verify | Production start fails; mail is rejected/unverified |
| `EMAIL_FROM_NAME` | Display name on outgoing mail | Product decision, e.g. `Obiren` | Defaults to `Obiren` |
| `WEB_APP_URL` | Public web origin used to build verification/reset links | Deployed web URL, e.g. `https://app.obiren.com` | Defaults to `http://localhost:3001`; emails would link to the wrong host |

## 2. Required only when the feature is switched on

### Payments (Paystack)

Payments are disabled unless **all** of the following are true. While disabled,
checkout and the webhook return 503 and no booking state changes.

| Variable | Value / source |
| --- | --- |
| `PAYMENT_ENABLED` | `true` to enable checkout (leave `false` until the refund/pricing policy is signed off) |
| `PAYMENT_POLICY_VERSION` | `approved:<version>` — the API refuses to enable payments for any other format |
| `PAYSTACK_SECRET_KEY` | Paystack Dashboard → Settings → API Keys & Webhooks → Secret key (`sk_test_...` for staging, `sk_live_...` for production) |
| `PAYSTACK_PUBLIC_KEY` | Same screen; public key, safe for client-side checkout (`pk_test_...` / `pk_live_...`) |
| `PAYSTACK_API_BASE` | `https://api.paystack.co` (change only for a sandbox/proxy) |
| `PAYSTACK_CURRENCY` | ISO-4217, e.g. `NGN`. Must match what the business is approved to charge |
| `PAYSTACK_CALLBACK_URL` | URL the customer returns to after checkout, e.g. `https://app.obiren.com/care/checkout/complete` |

Also required operationally: add the webhook URL
`https://<api-host>/api/v1/webhooks/paystack` in the Paystack dashboard and
enable the `charge.success` event. Signature verification uses the secret key,
so no separate webhook secret is needed.

### WhatsApp notifications (Twilio)

| Variable | Value / source |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info (`AC...`) |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |
| `TWILIO_WHATSAPP_FROM` | Approved WhatsApp sender, e.g. `whatsapp:+14155238886` (sandbox sender works for staging only) |

Without these, outbox rows are marked `failed` / `provider_not_configured` and
nothing is reported as sent. Configure the inbound and status webhook URLs in
Twilio:

- `POST https://<api-host>/api/v1/webhooks/twilio/whatsapp/inbound`
- `POST https://<api-host>/api/v1/webhooks/twilio/whatsapp/status`

### Google sign-in (optional)

| Variable | Value / source |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials, one OAuth client ID per platform. Comma-separated when the web, iOS and Android clients are all accepted, e.g. `123-web.apps.googleusercontent.com,456-ios.apps.googleusercontent.com` |

This is the audience allow-list for `POST /auth/google`; a token minted for a
client ID that is not listed is rejected. Set up the OAuth consent screen first
and add the deployed web origin under *Authorised JavaScript origins*. When the
variable is unset the endpoint returns 503 and email + password sign-in is
unaffected. Linking rules and the remaining product decisions are in
`docs/DECISIONS.md`.

### Health Vault document storage (Cloudinary)

| Variable | Value / source |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Console → Product Environment → Cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary Console → API Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary Console → API Keys (server only — never shipped to clients) |

Without these, upload-intent, download and delete return 503. The client never
sees the API secret: the API signs each upload intent.

### Retention job execution

| Variable | Value |
| --- | --- |
| `RETENTION_EXECUTION_ENABLED` | `true` only when you intend the scheduled job to delete expired operational rows. Leave unset/`false` for preview-only |

The route always requires the `X-Cron-Secret` header. While the flag is unset,
the same route returns a preview with `executed: false`. Account health records
are never deleted by this job.

## 3. Client-side configuration

| Variable | App | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | web, admin | Optional. Defaults to same-origin `/api/v1` (the Next rewrite proxies to the API). Set only when calling the API on another origin |
| `API_PROXY_TARGET` | web, admin | Dev/proxy target for the `/api/v1` rewrite, e.g. `http://localhost:3000` |
| `WAITLIST_LIST_PASSWORD` | web | Password for the restricted waitlist list view (`x-waitlist-password`). The view reports "not configured" when unset |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | web | The **web** OAuth client ID from the same Google project. `GoogleSignInButton` renders only when set; the value must also appear in the API's `GOOGLE_CLIENT_ID` allow-list |

Vercel supplies `VERCEL`, `VERCEL_URL`, `VERCEL_ENV` and `VERCEL_BRANCH_URL`
automatically; do not set them by hand.

## 4. Generated operational values (not third-party signups)

- `CRON_SECRET` — generate once with `openssl rand -hex 32`, store in the
  scheduler and the API environment.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — generate independently; rotating
  them invalidates all sessions (expected on rotation).
- `HEALTH_DATA_ENCRYPTION_KEY` — generate once and back it up; plan key rotation
  via `HEALTH_DATA_ENCRYPTION_KEY_ID` before changing it.
- `WAITLIST_LIST_PASSWORD` — a long random passphrase, shared only with the
  people who need the waitlist view.

## 5. Infra and accounts (no secret value, but needed to deploy)

- **MongoDB Atlas** project, cluster, database user, IP allow-list, backups
  enabled. Run migrations (`npm run migrate`) and the index migration before
  the first deploy.
- **Redis** instance (Upstash/Redis Cloud) with TLS.
- **Vercel** projects for `apps/api`, `apps/web`, `apps/admin`, with the env
  vars above set per environment.
- **DNS/domain**: production domains for web, admin and API; Resend domain
  verification (SPF/DKIM) on the sending domain.
- **Paystack business account** with settlement bank details and an approved
  pricing/refund policy (a business prerequisite, not an API key).
- **Twilio** account with an approved WhatsApp sender/template, if WhatsApp is
  in launch scope.

## 6. Not required yet (no integration exists)

These are often assumed but are **not** wired into the codebase today, so do not
spend time collecting them for launch:

- Push notifications (FCM/APNs/Web Push) — devices are registered and stored,
  but nothing sends push; outbox rows for push are marked failed.
- SMS provider — no SMS provider is integrated; SMS rows fail closed.
- Product analytics / crash reporting vendor — `apps/web/lib/analytics.ts` only
  buffers events and mirrors to `window.dataLayer`.
- Apple social sign-in — not implemented. Google sign-in **is** implemented
  (`POST /auth/google`, see `docs/DECISIONS.md`); this section only covers
  credentials that no code reads.
- Object storage (S3/R2) — Cloudinary is the current vault provider.

## 7. Verification after configuring

A runnable harness covers the two flows that cannot be verified in CI:

```bash
cd apps/api
npm run verify:sandbox -- --dry-run   # shows what would run, no calls
npm run verify:sandbox                # provider checks, then API checks if configured
```

Provider checks use `CLOUDINARY_*` (signed upload, read-back and delete) and
`PAYSTACK_SECRET_KEY` (a 100-minor-unit initialize + server-side verify; it
refuses to run with a non-`sk_test_` key). For the end-to-end API checks set:

- `SANDBOX_API_URL` — e.g. `https://api.staging.obiren.com/api/v1`
- `SANDBOX_EMAIL` + `SANDBOX_PASSWORD` (or `SANDBOX_ACCESS_TOKEN`)
- `SANDBOX_BOOKING_ID` — a held booking for the payment-intent check

```bash
# API up and dependencies connected
curl -i https://<api-host>/api/v1/health

# Contract served (should list the current routes)
curl -s https://<api-host>/api/v1/docs-json | head -c 200

# Email: register a test account and confirm the message arrives from EMAIL_FROM
# Vault: POST /health-vault/upload-intent with a bearer token returns a signature
# Payments (staging only): PAYMENT_ENABLED=true + test keys, hold a slot, run
#   a test checkout, confirm the booking flips to confirmed only after webhook
# WhatsApp: queue a notification, run the cron endpoint, check the outbox row
#   is `sent` with a Twilio SID (not `failed`)
# Retention: POST /internal/cron/run-retention with dryRun=true returns a
#   preview and changes nothing
```

If a provider is intentionally left unconfigured, confirm the fail-closed
behaviour instead: vault returns 503, payment-intent returns 503, and outbox
rows are `failed` / `provider_not_configured` — never silently "sent".
