# Obiren — Women's Health & Safety Platform

Obiren is a monorepo for a women's health, pregnancy, and personal-safety
platform serving Nigeria, Ghana, the UK, and the US. It consists of a NestJS
API, two Next.js frontends (user app and admin/marketing app), and shared
packages for domain logic.

This repository was production-hardened from a prototype state: the frontend
now talks to the real API, authentication is genuine (HTTP-only refresh
cookies, rotation + replay detection), the Safety PIN is cryptographically
verified, Health Vault files use real Cloudinary signed delivery, and the
waitlist is durable. 32 end-to-end integration tests cover the core flows.

## Architecture

```
obiren/
├── apps/
│   ├── api/       NestJS 11 API (MongoDB/Mongoose, JWT auth, Zod validation)
│   ├── web/       Next.js 16 user application (cycle, pregnancy, safety, vault)
│   └── admin/     Next.js 16 marketing site + admin control centre
└── packages/
    ├── api-client/      Shared typed API client (used by web + admin)
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
- **Rate limiting:** global 30 req/min/IP via `@nestjs/throttler`; the public
  waitlist endpoint is limited to 10 req/min.

### `apps/web` — User application
Marketing landing page + authenticated app shell. Authentication is real:
registration triggers email verification; sign-in sets the refresh cookie;
sessions are restored via `/auth/refresh` on load — `localStorage` is never
the session authority. Cycle tracking, daily logs, pregnancy, safety SOS
(PIN-verified cancellation), health vault (direct-to-Cloudinary uploads with
server-issued signatures), and NDPR data export/deletion all use the API.

### `apps/admin` — Admin & marketing
The admin control centre signs in through the real API and requires an
administrative role in the database. There is no demo account, no fake 2FA,
and no auto-created super admin. Modules without backend functionality show an
honest "coming soon" state instead of simulated data.

## Local development

```bash
# from the repo root (npm workspaces)
npm install

# API (needs MongoDB — see apps/api/.env.example)
cp apps/api/.env.example apps/api/.env   # then edit values
npm run api:dev                          # http://localhost:3000/api/v1

# Web app (proxies /api/v1 to the API)
npm run dev                              # http://localhost:3001*

# Admin app
npm run admin:dev                        # http://localhost:3002
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
| `CRON_SECRET` | ✅ | Protects `/api/v1/internal/cron/*` |
| `CLOUDINARY_*` | recommended | Health Vault upload/download (503 without it) |
| `TWILIO_*` | recommended | WhatsApp/SMS dispatch (simulated without it) |
| `MAILTRAP_TOKEN` | recommended | Verification/reset email delivery |

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

## API surface (summary)

Base path `/api/v1`:

- `auth/*` — register, login, refresh, logout, me, sessions, verify-email,
  resend-verification, forgot-password, reset-password
- `users/me` — profile get/update, export (NDPR), request/cancel deletion
- `cycles/*` — current, history, start-period, end-period
- `daily-logs/:date` — get/upsert (validated `YYYY-MM-DD`)
- `pregnancies` — create (one-active rule), current, `:id/end`, `:id/logs/:date`
- `safety/*` — pin (create/change/status), sos/trigger, sos/cancel (PIN), incidents
- `health-vault/*` — upload-intent, documents CRUD, signed download (5-min)
- `directory/*` — search (text + filters + pagination), nearby (2dsphere `$near`), service by id
- `notifications/*` — Twilio inbound/status webhooks (signature-validated), internal cron
- `waitlist` — public signup (rate-limited, anti-enumeration), stats; admin listing
- `admin/*` — metrics, users list/status, directory upsert, audit logs (role-guarded)
- `health` — liveness probe

Regenerate `apps/api/openapi.json` via `npm run api:build` artifacts script
(`apps/api/scripts/generate-artifacts.ts`).

## Testing

```bash
cd apps/api
npm test          # 32 end-to-end tests, real Nest app + in-memory MongoDB
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
- `apps/web` and `apps/admin` deploy as standard Next.js apps.
  Set `API_PROXY_TARGET` to the API deployment URL so `/api/v1/*` proxies
  same-origin (refresh cookies require this).
- `apps/api` deploys as a serverless function (`api/index.ts`) with the crons
  declared in `apps/api/vercel.json`. The serverless entry uses the **same**
  bootstrap/security configuration as `src/main.ts` (helmet, CORS allow-list,
  cookies, validation, filters) — there is no separate insecure path.

### Required production configuration
Set every `✅` variable from the table above. The API will fail startup
loudly rather than run with known-default secrets.

## Cron jobs (`apps/api/vercel.json`)

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/v1/internal/cron/process-notifications` | every 10 min | Outbox claim worker (atomic claims, retries, caps) |
| `/api/v1/internal/cron/recalculate-predictions` | hourly | Cycle prediction recalculation |
| `/api/v1/internal/cron/directory-reverification` | daily 03:00 | Emergency-resource reverification |
| `/api/v1/internal/cron/data-retention` | daily 04:00 | NDPR retention enforcement |

All internal cron endpoints require `CRON_SECRET` (query or `x-cron-secret`
header); without it they are denied in every environment.

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
