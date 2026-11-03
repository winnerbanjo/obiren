# Obiren — Women's Health & Safety Platform

Obiren is a monorepo for a women's health, pregnancy, and personal-safety
platform serving Nigeria, Ghana, the UK, and the US. It consists of a NestJS
API, three Next.js frontends (user app, admin/marketing app and doctor portal),
and shared packages for domain logic.

This repository was production-hardened from a prototype state: the frontend
now talks to the real API, authentication is genuine (HTTP-only refresh
cookies, rotation + replay detection), the Safety PIN is cryptographically
verified, Health Vault files use real Cloudinary signed delivery, and the
waitlist is durable. 165 end-to-end integration tests cover the core flows,
including the full Doctor Portal booking lifecycle.

## Architecture

```
obiren/
├── apps/
│   ├── api/       NestJS 11 API (MongoDB/Mongoose, JWT auth, Zod validation)
│   ├── web/       Next.js 16 user application (cycle, pregnancy, safety, vault)
│   ├── admin/     Next.js 16 marketing site + admin control centre
│   └── doctor/    Next.js 16 Doctor Portal (appointments, availability, profile)
└── packages/
    ├── api-client/      Shared typed API client (used by web + admin + doctor)
    ├── types/           Domain types
    ├── health-engine/   Cycle prediction engine (weighted average, outliers)
    ├── localization/    Country configs + verified emergency directory data
    ├── permissions/     RBAC permission matrix
    ├── validation/      Zod form schemas (frontend)
    └── ui/              Shared UI primitives
```

## Applications

### `apps/api` — NestJS API
- **Port:** 3000 · **Prefix:** `/api/v1`
- **Modules:** auth, users, cycles (incl. daily logs), pregnancy, safety,
  health-vault, directory, notifications (Twilio), admin, waitlist, health.
- **Auth:** 15-minute access JWT + 30-day opaque refresh token stored as a
  SHA-256 hash. Refresh tokens rotate on every use; reuse of a rotated token
  revokes the entire session family (replay detection). The refresh token is
  delivered as an `HttpOnly` cookie (`obiren_refresh`, scoped to
  `/api/v1/auth`) for browser clients, and also returned in the JSON body for
  native clients.
- **Authorization:** every authenticated request re-reads the user's status
  and roles from MongoDB — a demoted or suspended account loses access on its
  next request, not when the token expires.
- **Validation:** every body, query, and route parameter is validated with Zod
  (`ZodValidationPipe` + `apps/api/src/common/validation/api-schemas.ts`);
  unknown fields are rejected.
- **Rate limiting:** `ThrottlerGuard` is registered globally via `APP_GUARD`.
  The default limit is 120 req/min/IP (`THROTTLE_LIMIT`), backed by Redis when
  `REDIS_URL` is set and by an in-process counter otherwise. Credential and
  abuse-sensitive POSTs (`login`, `register`, `forgot-password`,
  `reset-password`, `resend-verification`, `refresh`, guardian invites/resend
  and SOS) get the stricter `THROTTLE_AUTH_LIMIT` (default 10 per 15 minutes),
  additive to the global limit. The public waitlist signup is limited to 10
  req/min. Blocked requests return `429` with `error.code = RATE_LIMITED` and
  a `Retry-After` header.

### `apps/web` — Public site
Professional landing page for the Obiren product. The web surface is
**doctor-only**: there is no patient sign-up or patient sign-in, and every
"Log in" affordance sends doctors to the Doctor Portal. Women are directed to
the mobile app instead (`NEXT_PUBLIC_IOS_APP_URL` / `NEXT_PUBLIC_ANDROID_APP_URL`,
with a launch-notify fallback while the apps are unpublished). `/home`, the
former patient landing page, permanently redirects to `/`.

The patient product itself (cycle tracking, daily logs, pregnancy, safety SOS,
health vault, NDPR export/deletion) lives in the mobile app and talks to the
same API.

### `apps/admin` — Admin console (internal)
The console has no public surface: `/` redirects to `/user`, the app is
`noindex`, and its address is shared with the Obiren team rather than linked
from the site. The public landing page and waitlist live only in `apps/web`.

The console signs in through the real API and requires an
administrative role in the database. There is no demo account, no fake 2FA,
and no auto-created super admin. Modules without backend functionality show an
honest "coming soon" state instead of simulated data. Its **Doctors** section
adds and manages doctor accounts and records audited verification decisions.

### `apps/doctor` — Doctor Portal
A dedicated portal for approved doctors, using the same API, booking records
and auth as the user app. Doctors sign in with their own password (set from a
single-use invitation), see only their own appointments, confirm/reject/
reschedule/cancel/complete/no-show, publish recurring availability and time
off, edit their public profile and read booking notifications. Access requires
the `clinician` role and a linked doctor profile; every route is authorised
server-side. See [`docs/DOCTOR_PORTAL.md`](docs/DOCTOR_PORTAL.md).

## Local development

```bash
# from the repo root (npm workspaces)
npm install

# API (needs MongoDB — see apps/api/.env.example)
cp apps/api/.env.example apps/api/.env   # then edit values
npm run api:dev                          # http://localhost:3000/api/v1

# Web app (proxies /api/v1 to the API)
npm run dev                              # http://localhost:3001*

# Admin app (console route is /user, not /admin)
npm run admin:dev                        # http://localhost:3002/user

# Doctor portal
npm run doctor:dev                       # http://localhost:3003
```

\* The web app rewrites `/api/v1/*` to `API_PROXY_TARGET` (default
`http://localhost:3000`) so cookies work same-origin.

## Environment variables

See [`apps/api/.env.example`](apps/api/.env.example) for the full annotated
list. Highlights:

| Variable | Required in production | Notes |
| --- | --- | --- |
| `MONGODB_URI` | ✅ | MongoDB Atlas or self-hosted |
| `JWT_ACCESS_SECRET` | ✅ | ≥32 chars, must differ from refresh secret |
| `JWT_REFRESH_SECRET` | ✅ | ≥32 chars |
| `CORS_ORIGINS` | ✅ | Comma-separated allow-list |
| `REDIS_URL` | ✅ | Distributed rate limiting (in-memory fallback only when unset) |
| `CRON_SECRET` | ✅ | Protects `/api/v1/internal/cron/*` (denied when unset) |
| `HEALTH_DATA_ENCRYPTION_KEY` | ✅ | 32-byte AES-256-GCM key for private health notes |
| `RESEND_API_KEY` | ✅ | Verification and password-reset email delivery |
| `EMAIL_FROM` | ✅ | Verified Resend sender address |
| `CLOUDINARY_*` | recommended | Health Vault upload/download (503 without it) |
| `TWILIO_*` | recommended | WhatsApp dispatch and webhook signature checks (never faked) |
| `PAYSTACK_SECRET_KEY` | when payments enabled | Payments stay disabled without an approved policy version |

**Fail-fast rule:** in production the API refuses to start if any ✅ variable
is missing or malformed. There are no secret fallbacks in any environment.

## Database

MongoDB. Schemas live in `apps/api/src/database/schemas/`. Notable guarantees
are enforced **at the database level**, not just in code:

- `cycles`: partial unique index — at most one **active** cycle per user.
- `pregnancies`: partial unique index — at most one **active** pregnancy per user.
- `daily_logs`: compound unique index `(userId, date)`.
- `sessions`: unique `refreshTokenHash` + TTL index on `expiresAt`.
- `safety_pins`: unique per user; stores **only** an argon2id hash.
- `emergency_resource_reviews`: unique per published resource; records staff
  verification state, last check and next review date (freshness is never implied).
- `mfa_credentials`: unique per user; the TOTP secret is stored **encrypted** and
  recovery codes as SHA-256 hashes.
- `support_tickets`, `articles`, `health_briefs`, `promo_codes`: unique reference,
  slug, and code indexes where duplicates would be ambiguous.
- `waitlist_entries`: unique `normalizedEmail`.

`apps/api/src/database/migrations/database-migrations.ts` is a versioned
migration runner (checksums + distributed lock) that creates all indexes; it
is idempotent and safe to re-run.

## Authentication architecture

```
register ──► pending_verification ──► verify-email (single-use hashed token)
                                              │
                                              ▼
login ──► access JWT (15m, in memory)  +  refresh cookie (HttpOnly, 30d)
              │                                   │
   Authorization: Bearer             POST /auth/refresh (rotates token;
              │                      reuse ⇒ family-wide revocation)
              ▼
DB re-check on every request (status + roles)
```

- **Email verification:** single-use token, SHA-256-hashed at rest, 24 h
  expiry, replay-proof (consumed on use), resend endpoint with generic
  anti-enumeration responses.
- **Password reset:** single-use hashed token, 1 h expiry, generic response
  regardless of account existence, revokes all sessions on success.
- **Google sign-in:** `POST /auth/google` verifies a Google ID token
  server-side (signature, issuer, expiry, audience allow-list from
  `GOOGLE_CLIENT_ID`) and never trusts client-supplied profile claims. A
  verified Google email creates an active account; an existing account is
  linked only if its email is already verified (pre-hijack guard), and MFA is
  still required. Optional: unset `GOOGLE_CLIENT_ID` returns 503 and leaves
  password sign-in untouched. See `docs/DECISIONS.md`.

## API surface (summary)

Base path `/api/v1`:

- `auth/*` — register, login, google, refresh, logout, me, sessions,
  verify-email, resend-verification, forgot-password, reset-password,
  activate-doctor (single-use invitation)
- `users/me` — profile get/update, export (NDPR), request/cancel deletion
- `cycles/*` — current, history, start-period, end-period
- `daily-logs/:date` — get/upsert (validated `YYYY-MM-DD`)
- `pregnancies` — create (one-active rule), current, `:id/end`, `:id/logs/:date`
- `safety/*` — resources (public verified emergency directory with freshness),
  pin (create/change/status), sos/trigger, sos/cancel (PIN), incidents,
  `sos-events/:id`, guardian resend/scopes
- `auth/mfa/*` — status, enrol, verify, disable, challenge (opt-in TOTP)
- `support/*` — public FAQs, owner-scoped tickets and replies
- `articles` — published, medically approved health education only
- `privacy-settings` — consent purposes + non-legal preferences
- `briefs` — deterministic health briefs for a verified clinician
- `subscriptions/me`, `promo-codes/validate`, `consultations/:id/attachments`
- `internal/cron/run-retention` — expired operational records only (secret-guarded)
- `health-vault/*` — upload-intent, documents CRUD, signed download (5-min)
- `directory/*` — search (text + filters + pagination), nearby (2dsphere `$near`), service by id
- `notifications/*` — Twilio inbound/status webhooks (signature-validated), internal cron
- `waitlist` — public signup (rate-limited, anti-enumeration), stats; admin listing
- `admin/doctors` — add/edit/activate/deactivate/suspend doctors, reissue
  single-use invitations, audited verification decisions (role-guarded)
- `clinician/*` — doctor dashboard, own profile, owner-scoped appointments and
  status actions, weekly schedule + slot preview, time off, notifications
  (including the cron-generated 24-hour appointment reminder)
- `health` — liveness probe

Regenerate `apps/api/openapi.json` via `npm --prefix apps/api run generate:openapi`.

Sanitized role fixtures for local/staging checks (never production):

```bash
cd apps/api
MONGODB_URI=<non-production uri> npx ts-node --transpile-only scripts/seed-demo.ts
```

## Testing

```bash
cd apps/api
npm test          # 165 end-to-end tests, real Nest app + in-memory MongoDB
```

Tests boot the actual application (same security config as production) against
`mongodb-memory-server` and exercise: registration, login, wrong-password,
refresh rotation, replay detection, logout, password reset, email
verification, RBAC (user blocked from admin endpoints), validation failures,
cycle idempotency + one-active constraint, daily-log upserts, pregnancy
one-active constraint, high-risk symptom escalation, Safety PIN
create/verify/lockout, vault ownership (IDOR denied + audit-logged), and
waitlist persistence/dedup/anti-enumeration.

## Deployment

### Vercel
- `apps/web`, `apps/admin` and `apps/doctor` deploy as standard Next.js apps.
  Set `API_PROXY_TARGET` to the API deployment URL so `/api/v1/*` proxies
  same-origin (refresh cookies require this). Set
  `NEXT_PUBLIC_DOCTOR_PORTAL_URL` on Admin so activation links point at the
  portal.
- `apps/api` deploys as a serverless function (`api/index.ts`) with the crons
  declared in `apps/api/vercel.json`. The serverless entry uses the **same**
  bootstrap/security configuration as `src/main.ts` (helmet, CORS allow-list,
  cookies, validation, filters) — there is no separate insecure path.

### GitHub Actions (staging server + PM2)
Pushes to `main` run `.github/workflows/ci.yml`, which uses `dorny/paths-filter`
to test **only the apps that changed** (shared `packages/**`, lockfile or
root tsconfig changes invalidate all four). The `deploy` job then builds,
restarts and health-checks **only those apps**, and rolls the checkout back to
the previous revision if a health probe fails. See
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the secrets, host prerequisites
and rollback semantics.

### Required production configuration
Set every `✅` variable from the table above. The API will fail startup
loudly rather than run with known-default secrets.

## Cron jobs (`apps/api/vercel.json`)

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/v1/internal/cron/process-notifications` | every 10 min | Outbox claim worker (atomic claims, retries, caps) |
| `/api/v1/internal/cron/appointment-reminders` | hourly | One deduplicated in-app reminder per confirmed appointment in the next 24 h |
| `/api/v1/internal/cron/run-retention?dryRun=false` | daily 04:00 | NDPR retention of expired operational records (account health records are never purged) |

Both routes accept `X-Cron-Secret: <CRON_SECRET>` or the
`Authorization: Bearer <CRON_SECRET>` header that Vercel Cron sends, and are
denied when `CRON_SECRET` is unset. Retention previews by default; deletion also
requires `RETENTION_EXECUTION_ENABLED=true`.

## Security assumptions

- Access tokens are short-lived and held in memory only; the browser never
  stores refresh tokens (HTTP-only cookie) or passwords.
- Role claims are never trusted from the JWT alone — the DB is authoritative.
- SOS cancellation requires a real argon2id-verified PIN with attempt
  throttling (5 failures ⇒ 15-minute lockout).
- Health Vault downloads are owner-only and use short-lived signed URLs; the
  Cloudinary secret never reaches the browser. Denied access attempts are
  audit-logged.
- Twilio webhooks are rejected without a valid `X-Twilio-Signature`.
- Password-reset and verification flows return generic responses to prevent
  account enumeration; waitlist duplicates are handled without revealing
  existing signups.
- Mongo duplicate-key errors map to HTTP 409; unexpected errors never leak
  stack traces to clients.
