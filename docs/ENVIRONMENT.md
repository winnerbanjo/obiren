# Environment configuration

Everything Obiren reads from the environment, what each value does, what breaks when
it is missing, and how to generate it. If you are setting up the server for launch,
work top to bottom through [Launch checklist](#launch-checklist).

## Where the files live

| App | File | Notes |
| --- | --- | --- |
| API (`api.obiren.co`) | `apps/api/.env` | Read at boot by `apps/api/src/config/env.validation.ts`. Real process variables win over the file. |
| Patient web (`obiren.co`) | `apps/web/.env.local` | Next.js reads `.env.local` / `.env.production`. Only the variables listed under [Frontend apps](#frontend-apps) matter. |
| Admin portal (`admin.obiren.co`) | `apps/admin/.env.local` | Same as web. |
| Doctor portal (`doctors.obiren.co`) | `apps/doctor/.env.local` | Same as web. |

- Never commit these files — `.env`, `.env.local` and `.env.production` are gitignored.
- `apps/api/.env.example` is the commented template; `cp apps/api/.env.example apps/api/.env`.
- A variable that is not set is *not* defaulted to something insecure. Features either
  work, or they fail closed with a `503` and a readable `details.missingConfiguration`
  list.

## The startup rule

With `NODE_ENV=production` the API **refuses to boot** and prints every missing required
variable. This is deliberate: a half-configured production API is worse than one that
will not start.

The only exception is `ALLOW_DEGRADED_STARTUP=true`, which boots anyway, prints what is
missing, and reports it field-by-field at `GET /api/v1/health`. `MONGODB_URI` is still
fatal. Never set this flag for a public launch.

---

## Required in production

These nine must be present or the API will not start when `NODE_ENV=production`.

| Variable | What it does | How to set it |
| --- | --- | --- |
| `MONGODB_URI` | The database. Nothing works without it. | MongoDB Atlas connection string, e.g. `mongodb+srv://user:pass@cluster.mongodb.net/obiren_production?retryWrites=true&w=majority`. **Use a production database name** — `obiren_staging` is the docs default and mixing the two on launch day is unrecoverable. |
| `JWT_ACCESS_SECRET` | Signs 15-minute access tokens. | `openssl rand -base64 48` (min 32 chars) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens / sessions. | `openssl rand -base64 48` — **must differ** from the access secret |
| `CORS_ORIGINS` | Browser origin allow-list. No wildcard is used with credentials. | `https://obiren.co,https://www.obiren.co,https://admin.obiren.co,https://doctors.obiren.co` |
| `REDIS_URL` | Distributed rate-limit counters (and job queues). | Upstash/ElastiCache/`redis://127.0.0.1:6379`. Without it limits are counted per process, so they do not hold across instances. |
| `CRON_SECRET` | Authorises `POST/GET /api/v1/internal/cron/*` via the `X-Cron-Secret` header. | `openssl rand -hex 32`. Unset in **any** environment means every cron call is denied, so retention and notification processing never run. |
| `HEALTH_DATA_ENCRYPTION_KEY` | AES-256-GCM key for daily-log private notes, pregnancy notes and consultation messages. | `openssl rand -hex 32` (exactly 32 bytes: 64 hex or base64). Without it those writes return `503` rather than storing plaintext. |
| `RESEND_API_KEY` | Verification and password-reset email. | Resend dashboard → API key, after verifying the sending domain |
| `EMAIL_FROM` | The verified sender address. | `no-reply@obiren.co` (domain must be verified in Resend) |

Optional but strongly recommended at launch: `REDIS_URL`-backed throttling means the
600/min per-IP budget is shared correctly; `HEALTH_DATA_ENCRYPTION_KEY` and
`RESEND_API_KEY` are in the required list above for a reason.

---

## API reference

### Core

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production`. Drives every "required in production" rule below. |
| `PORT` | `3000` | HTTP listen port. The droplet runs the API on `3020` behind Caddy. |
| `LOG_LEVEL` | `debug` (dev), `info` (prod) | Log verbosity. |
| `WEB_APP_URL` | `http://localhost:3001` | Base URL used in email links and redirects. Set to `https://obiren.co` in production. |
| `DOCTOR_PORTAL_URL` | `http://localhost:3003` | Base URL for doctor activation links in outgoing email. **Set it to `https://doctors.obiren.co` in production**, or activation emails link to localhost. |
| `ALLOW_DEGRADED_STARTUP` | `false` | Staging-only escape hatch described above. Never `true` for a public launch. |

### Database and migrations

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | See above. Run `npm --prefix apps/api run migrate` once against a fresh database. |

### Rate limiting and idempotency

Defaults are production-appropriate; override only with a reason.

| Variable | Default | Purpose |
| --- | --- | --- |
| `THROTTLE_TTL_MS` | `60000` | Global rate-limit window (ms). |
| `THROTTLE_LIMIT` | `120` prod / `600` dev | Requests per IP per window. The droplet currently sets `600`. |
| `THROTTLE_AUTH_TTL_MS` | `900000` | Window for credential, guardian-invite and SOS POSTs. |
| `THROTTLE_AUTH_LIMIT` | `10` prod / `50` dev | Attempts per window on those routes. Raise it if a launch event puts many users behind one NAT. |
| `IDEMPOTENCY_TTL_SECONDS` | `86400` | Lifetime of stored `Idempotency-Key` responses. |

Rate limiting is per client IP. Behind the reverse proxy the API trusts only the
loopback hop, so a forged `X-Forwarded-For` from the internet is ignored.

### Email

| Variable | Default | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | — | Required in production. Unset elsewhere means email is captured in-process and never delivered. |
| `EMAIL_FROM` | `no-reply@obiren.local` | Required in production. Must be on a verified domain. |
| `EMAIL_FROM_NAME` | `Obiren` | Display name on outgoing mail. |

### Google sign-in (optional)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | One or more OAuth client IDs (web, iOS, Android), comma-separated. ID tokens are verified against Google's keys, issuer **and** this audience list. Unset → `POST /auth/google` returns `503`; email + password sign-in is unaffected. |
| `GOOGLE_CLIENT_IDS` | Accepted alias for the same list. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Browser (web app) client ID; the Google button renders only when this is set. Must also appear in the API's list. |

### Payments (Paystack, optional and fail-closed)

Checkout stays disabled unless `PAYMENT_ENABLED=true` **and** `PAYMENT_POLICY_VERSION`
starts with `approved:`.

| Variable | Purpose |
| --- | --- |
| `PAYMENT_ENABLED` | `true` to enable checkout at all. |
| `PAYMENT_POLICY_VERSION` | `approved:<version>` — the approved pricing/policy version. Anything else leaves checkout off. |
| `PAYSTACK_SECRET_KEY` | Required when payments are enabled. Server-side only. |
| `PAYSTACK_PUBLIC_KEY` | Client checkout key. |
| `PAYSTACK_API_BASE` | Defaults to `https://api.paystack.co`; point at a sandbox for staging. |
| `PAYSTACK_CURRENCY` | ISO-4217, default `NGN`. Amounts are calculated server-side in minor units. |
| `PAYSTACK_CALLBACK_URL` | Where Paystack returns the user after checkout. |

**Turning checkout on, in order**

1. Create the integration in the Paystack dashboard and copy the secret and public
   keys (`sk_live_…` / `pk_live_…`; use `sk_test_…` / `pk_test_…` for staging).
2. Set `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYMENT_ENABLED=true` and
   `PAYMENT_POLICY_VERSION=approved:<version>` on the API, then restart. The API
   refuses to boot in production when `PAYMENT_ENABLED=true` without an
   `approved:` policy version, and checkout returns `503` with the missing names
   while the key is absent.
3. In Paystack → Settings → API Keys & Webhooks, set the webhook URL to
   `https://api.obiren.co/api/v1/webhooks/paystack`. Every delivery is checked
   against the `x-paystack-signature` HMAC-SHA512 header; unsigned or mis-signed
   deliveries get `401` and change nothing.
4. Point `PAYSTACK_CALLBACK_URL` at the patient app's return screen. On return the
   app calls `POST /bookings/:id/payment/verify`, which asks Paystack directly, so
   a delayed or missing webhook can never strand a paid booking.
5. Verify with `npm --prefix apps/api run verify:sandbox` against the deployed API
   (see the sandbox row above) and a real test-mode card.

**Payment lifecycle.** `POST /bookings/hold` reserves a slot for 10 minutes as
`held`. `POST /bookings/:id/payment-intent` re-reads the approved price and returns
the Paystack `authorizationUrl`. The booking moves on only when a server-verified
`charge.success` matches the quoted amount and currency: it becomes `pending` if
the doctor requires approval, otherwise `confirmed`, the slot is marked `booked`
and the doctor is notified. That transition is what unlocks the doctor's
**Consultation link** card — a `held` or `pending_payment` booking accepts no link,
so a doctor cannot attach a call link until the patient has paid.

**Testing without money.** Either point `PAYSTACK_API_BASE` at a local stub (the API
test suite does exactly this) or use test keys with Paystack's documented test
cards; the signature and verification path is identical.

### Health Vault storage (Cloudinary, optional)

| Variable | Purpose |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloud name. |
| `CLOUDINARY_API_KEY` | API key. |
| `CLOUDINARY_API_SECRET` | API secret. |

With any of the three credentials missing, upload intents and downloads return `503`
and nothing is stored — the vault never silently accepts a document it cannot keep.

### WhatsApp notifications (Twilio, optional)

| Variable | Purpose |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Account SID. |
| `TWILIO_AUTH_TOKEN` | Auth token; also used to verify inbound webhook signatures. |
| `TWILIO_WHATSAPP_FROM` | Sender, e.g. `whatsapp:+14155238886`. |

Unconfigured means outbound WhatsApp is marked failed rather than sent, and inbound
webhooks cannot be verified.

### Internal jobs and retention

| Variable | Purpose |
| --- | --- |
| `CRON_SECRET` | Required in production (see above). |
| `RETENTION_EXECUTION_ENABLED` | `true` lets the retention job actually delete expired operational records (sessions, invitations, location sessions, shares, idempotency rows, old webhook audit rows). Anything else is preview-only. Account health records are never purged by this job. |

### Waitlist operator view (non-PRD, additive)

| Variable | Purpose |
| --- | --- |
| `WAITLIST_LIST_PASSWORD` | Unlocks the restricted waitlist list at `/waitlist/list`. Unset in production → the page is `404` for everyone. |

### Scripts only (not read by the server)

| Variable | Used by |
| --- | --- |
| `SEED_PASSWORD` | `npm --prefix apps/api run seed:accounts` — password for the seeded demo accounts. Changing it after seeding does not change existing users. |
| `SANDBOX_API_URL`, `SANDBOX_EMAIL`, `SANDBOX_PASSWORD`, `SANDBOX_ACCESS_TOKEN`, `SANDBOX_BOOKING_ID`, `PAYSTACK_TEST_EMAIL` | `npm --prefix apps/api run verify:sandbox` — black-box integration check against a deployed API. |

---

## Frontend apps

The three Next apps proxy `/api/v1/*` to the API, so browsers talk to the same origin
they loaded from and no CORS is involved for the portals.

| Variable | Applies to | Default | Purpose |
| --- | --- | --- | --- |
| `API_PROXY_TARGET` | web, admin, doctor | `http://127.0.0.1:3020` in a production build, `http://localhost:3000` in dev | Upstream API origin for the `/api/v1/:path*` rewrite. **Set it explicitly on the droplet.** |
| `WAITLIST_LIST_PASSWORD` | web | — | Server-side gate for `/waitlist/list`; also required by its data route. |
| `NEXT_PUBLIC_DOCTOR_PORTAL_URL` | web, admin | web: `https://doctors.obiren.co/doctor/login` in production | Doctor-portal link on the landing page and the base of admin activation links. **Set it explicitly for the admin app**, where the otherwise-used fallback is the admin's own origin. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | web | — | Enables the "Continue with Google" button; must match the API's `GOOGLE_CLIENT_ID`. |
| `NEXT_PUBLIC_IOS_APP_URL` / `NEXT_PUBLIC_ANDROID_APP_URL` | web | — | App-store links on the landing page. Omitted when unset. |
| `ADMIN_APP_URL` | web | `https://admin.obiren.co` in production | Admin-portal URL used when the landing page redirects `/admin` traffic. |

`NEXT_PUBLIC_*` values are baked into the client bundle at build time — change them and
rebuild, restarting alone is not enough.

---

## Feature → variable matrix

| Feature | Needs | When unset |
| --- | --- | --- |
| Everything (server starts) | `MONGODB_URI` | Fatal in every environment |
| Sign-in, sessions | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Fatal in production; dev falls back to a labelled dev secret |
| Browser clients | `CORS_ORIGINS` | Fatal in production; native mobile unaffected |
| Rate limits across instances | `REDIS_URL` | In-memory fallback, per process |
| Private health notes, consultation messages | `HEALTH_DATA_ENCRYPTION_KEY` | `503` on those writes |
| Verification / reset email | `RESEND_API_KEY`, `EMAIL_FROM` | Captured in-process (dev) / fatal in production |
| Google sign-in | `GOOGLE_CLIENT_ID` (+ `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for the button) | `503`, password sign-in still works |
| Checkout | `PAYMENT_ENABLED=true`, `PAYMENT_POLICY_VERSION=approved:*`, `PAYSTACK_SECRET_KEY` | Checkout disabled, prices still visible |
| Health Vault documents | `CLOUDINARY_*` | `503`, nothing stored |
| WhatsApp notifications | `TWILIO_*` | Marked failed, never sent |
| Cron / retention | `CRON_SECRET` (+ `RETENTION_EXECUTION_ENABLED` to delete) | Requests denied; retention previews only |
| Waitlist operator list | `WAITLIST_LIST_PASSWORD` | `404` |

Check what a running deployment is missing at any time:

```bash
curl -s https://api.obiren.co/api/v1/health | jq '{status, environment, configuration}'
```

The response lists variable **names** only, never values.

---

## Local development

```bash
cp apps/api/.env.example apps/api/.env      # fill in MONGODB_URI at minimum
npm install
npm --prefix apps/api run dev:memory        # in-memory MongoDB + API on :3000
npm --prefix apps/web run dev -- -p 3100    # patient app on :3100
npm --prefix apps/admin run dev             # admin on :3002
npm --prefix apps/doctor run dev            # doctor portal on :3003
```

`dev:memory` needs no local `mongod`. Without `RESEND_API_KEY`, verification and
reset emails are captured in-process, so development flows still complete.

## Launch checklist

1. `MONGODB_URI` points at the **production** database, and `npm --prefix apps/api run migrate` has run against it.
2. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are two different 32+ character random values.
3. `HEALTH_DATA_ENCRYPTION_KEY` is 64 hex characters, backed up somewhere safe — losing it makes existing private notes unreadable.
4. `CORS_ORIGINS` lists the real public origins (including `www` if it redirects).
5. `REDIS_URL` set, so limit counters are shared.
6. `RESEND_API_KEY` + a verified `EMAIL_FROM` domain; send one real verification email.
7. `CRON_SECRET` set and the host's cron actually calls `/api/v1/internal/cron/*` with it.
8. `API_PROXY_TARGET=http://127.0.0.1:3020` on all three portals, then rebuild them.
9. `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` if the Google button should work.
10. `CLOUDINARY_*` only if Health Vault uploads are in scope for launch.
11. `GET /api/v1/health` returns `"status": "ok"` — not `"degraded"`.
12. Demo/seed accounts are deleted or re-passworded (`seed-accounts.ts` prints a warning for exactly this reason).
