# Obiren API — end-to-end guide

This document explains how the Obiren API works from the HTTP request down to
the database, and then walks each module's flow. It is the companion to
`docs/IMPLEMENTATION.md` (what was built) and `docs/CREDENTIALS.md` (what must
be configured before launch). Route counts and the duplication audit at the end
are checked against the generated OpenAPI document (`apps/api/openapi.json`).

- API package: `apps/api` (NestJS 11 + Mongoose 8, TypeScript)
- Clients: `apps/web` (Next.js, port 3001), `apps/admin` (Next.js, port 3002)
- Shared client: `packages/api-client` — the only place that knows API paths
- Contract: `apps/api/openapi.json` and `apps/api/openapi.yaml`, served live at
  `GET /api/v1/docs` (Swagger UI) and `GET /api/v1/docs-json`

## 1. Runtime topology

```
Browser / mobile
   │  HTTPS, JSON, Bearer access token, HTTP-only refresh cookie
   ▼
Vercel rewrites (/api/v1 → apps/api)        local dev: :3000 (API), :3001 (web), :3002 (admin)
   ▼
Nest app (apps/api/src/app.module.ts)
   ├─ ThrottlingModule        rate limits (Redis when configured)
   ├─ MailModule              Resend provider (or in-process capture in dev/test)
   ├─ IdempotencyModule       Idempotency-Key replay store
   ├─ MongooseModule          MongoDB connection pool
   └─ feature modules         auth, users, cycles, pregnancy, home, directory,
                              safety, health-vault, care, communications,
                              notifications, support, articles, briefs,
                              admin, waitlist, retention, health
```

Both entrypoints compose the same configuration: `src/main.ts` for a long-lived
process and `api/index.ts` for the Vercel serverless handler. Both call
`configureApp()` in `src/common/bootstrap.ts`, so there is no second, weaker
bootstrap path.

`/api/v1` is the canonical prefix; `/v1/...` is rewritten to it before routing.
The OpenAPI document is generated from the running application, not hand-written.

## 2. Request lifecycle

Every request passes through the same pipeline:

1. **Request ID** — `requestIdMiddleware` accepts `X-Request-Id` or generates
   one, echoes it in the `X-Request-Id` header and in the response body.
2. **Prefix normalisation** — `/v1/*` → `/api/v1/*`.
3. **Helmet + CORS** — explicit origin allow-list (`CORS_ORIGINS`), credentials
   enabled, so a wildcard origin is never combined with cookies.
4. **Cookie parsing** — the refresh token is read from `obiren_refresh`.
5. **Throttling** — global limit plus stricter limits on credential, guardian
   invite and SOS routes (`THROTTLE_*`); Redis-backed when `REDIS_URL` is set.
6. **Guards** — `JwtAuthGuard` verifies the bearer token and loads the account
   (active status required); `RolesGuard` enforces `@Roles(...)` using the
   normalised role list. Ownership is never inferred from a body parameter:
   services receive `req.user.sub` and scope every query by it.
7. **Validation** — each route declares a Zod schema through `ZodValidationPipe`.
   Unknown fields are rejected, not stripped silently. `ValidationPipe` is also
   configured with `whitelist` + `forbidNonWhitelisted`.
8. **Idempotency** — routes marked `@Idempotent()` require an `Idempotency-Key`
   header. The interceptor stores the response for the key (default 24 h) and
   replays it for an identical request; a different payload for the same key is
   a conflict.
9. **Handler → service** — controllers only translate HTTP to a service call.
   Business rules, ownership checks and state machines live in the service.
10. **Envelope** — `ApiEnvelopeInterceptor` wraps successful payloads as
    `{ data, meta?, requestId }`.
11. **Errors** — `ApiExceptionFilter` produces
    `{ error: { code, message, details? }, requestId }`. Status → code mapping:
    400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`,
    404 `NOT_FOUND`, 409 `CONFLICT`, 422 `INVALID_STATE`,
    429 `RATE_LIMITED`, 503 `PROVIDER_UNAVAILABLE`, 5xx
    `INTERNAL_SERVER_ERROR`. Mongo duplicate-key errors become 409. 5xx logs
    contain method/path/status only — never bodies or health data.

**Auth tokens**

- Access token: 15 minutes, sent as `Authorization: Bearer`.
- Refresh token: rotated on every refresh, 30 days. Browser clients receive it
  in the HTTP-only `obiren_refresh` cookie; native clients receive it in the
  login response body and send it in the refresh request body.
- Sessions are stored server-side so they can be listed (`GET /auth/sessions`)
  and revoked (`POST /auth/logout`).
- Staff accounts can enrol TOTP MFA (`/auth/mfa/*`); when MFA is enabled the
  password step returns a challenge token that only `/auth/mfa/challenge` can
  exchange for a session.

## 3. Data, crypto and background work

- **MongoDB** is the only store. Migrations are versioned
  (`src/database/migrations/database-migrations.ts`) and idempotent; indexes are
  applied separately by `runIndexMigration`.
- **Health free text** (daily-log notes, pregnancy notes, consultation
  messages, clinical briefs' source notes) is encrypted with AES-256-GCM using
  `HEALTH_DATA_ENCRYPTION_KEY` and a key id. If the key is missing, those write
  paths return 503 rather than storing plaintext.
- **Audit log** records privileged and safety-relevant actions
  (`audit_logs`), with actor, action, module and opaque details.
- **Notifications** are written to an outbox and claimed atomically by
  `GET /internal/cron/process-notifications`. WhatsApp is the only outbound
  channel wired to a provider (Twilio); email/SMS/push rows are marked
  `failed` with `provider_not_configured` instead of being reported as sent.
- **Retention** (`POST /internal/cron/run-retention`) previews by default and
  only deletes expired *operational* rows when
  `RETENTION_EXECUTION_ENABLED=true`; it reports `executed: true/false` in the
  response. Account health records are never purged by this job.
- **Internal cron** endpoints accept `X-Cron-Secret`, `Authorization: Bearer
  <CRON_SECRET>` (what Vercel Cron sends) or the legacy query secret, and are
  denied when `CRON_SECRET` is unset, in every environment.

## 4. End-to-end journeys

### 4.1 New account → usable app

1. `POST /auth/register` creates the account (unverified), hashes the password,
   issues a single-use email-verification token and queues the email. The
   response never includes the raw token in production.
2. `POST /auth/verify-email` marks the address verified.
3. `POST /auth/login` returns the user, access token and refresh token (browser
   clients also get the cookie).
4. `GET /users/onboarding` returns a resumable draft (steps 1–8).
   `PATCH /users/onboarding` saves progress. `POST /users/onboarding/complete`
   refuses to complete until the required steps and tracking objective are
   saved, then sets `onboardingStatus` server-side.
5. `GET /home` returns the first dashboard payload (cycle, pregnancy, recent
   logs, today's log, insights/cards, disclaimer). `GET /home?date=` returns the
   same view for a local calendar date.

### 4.2 Daily tracking

1. `POST /cycles/start-period` (or `POST /periods`) records a period start.
   Repeating the same start date is idempotent; a retroactive start before the
   latest recorded period is rejected instead of rewriting history.
2. `GET /cycles/current` returns cycle day, timezone and a prediction
   (estimate only, explicitly not contraception advice).
3. `PUT /daily-logs/:date` upserts the full log; `PATCH /daily-logs/:date`
   applies a partial update against a version and returns 409 on a stale
   version; `DELETE /daily-logs/:date?version=` deletes conditionally.
   Notes are encrypted at rest.
4. `GET /daily-logs?from&to` returns the calendar range used by the tracker.

### 4.3 Pregnancy

1. `POST /pregnancies` creates the profile from LMP or EDD; only one active
   pregnancy per account.
2. `GET /pregnancies/current` returns gestational age, trimester, days to due
   date, milestone and dating confidence.
3. `PUT /pregnancy-logs/:date` writes a check-in for the active pregnancy
   without the client sending an id. `PUT /pregnancies/:id/logs/:date` is the
   id-addressed equivalent used by the current web client.
4. Selected symptom labels (for example reduced fetal movement) return an
   urgent safety notice with the saved log; the API never claims to be an
   emergency service.
5. `PATCH /pregnancies/:id` updates dating with provenance; `GET
   /pregnancies/:id/timeline` returns recorded events; kick sessions are only
   accepted from 28 weeks; `PATCH /pregnancies/:id/wellness/:date` updates only
   water/vitamins; `POST /pregnancies/:id/end` closes the profile with a reason.

### 4.4 Finding care and booking

1. `GET /specialists` lists only active, verified clinicians with priced
   session types (cursor pagination). `GET /specialists/:id/slots` returns that
   specialist's bookable slots.
2. `POST /bookings/hold` atomically reserves one slot for 10 minutes and
   records a `held` booking with the price calculated **server-side**. If the
   session type has no approved price, the request returns 503 *before* the
   slot is touched.
3. `POST /bookings/:id/payment-intent` re-reads the price and initialises
   Paystack. The booking becomes `pending_payment`; it never becomes
   `confirmed` from this call.
4. `POST /webhooks/paystack` verifies the HMAC-SHA512 over the raw body,
   de-duplicates event ids, re-verifies the transaction with Paystack and
   compares amount and currency before confirming the booking. Replays and
   mismatches change nothing.
5. `GET /bookings`, `GET /bookings/:id`, `GET /payments/:id` and
   `GET /receipts/:bookingId` read the result. `POST /bookings/:id/cancel`
   releases the slot; a paid booking becomes `pending_policy` rather than
   pretending a refund happened.
6. `GET /clinician/bookings` and `POST /clinician/bookings/:id/complete` are the
   clinician-side views, scoped to the caller's own clinician profile.

### 4.5 Consultation and sharing

1. An admin records a care relationship (`POST /admin/consultations`) for a
   usable patient and an active, verified clinician. It confirms no booking,
   payment or appointment; messaging is membership-scoped.
2. Participants read it with `GET /consultations` and exchange messages with
   `GET/POST /consultations/:id/messages`. Non-participants receive 404.
   Message bodies are encrypted at rest.
3. `POST /consultations/:id/attachments` stores metadata; the download route
   stays closed until the attachment passes scanning, and
   `GET /attachments/:id/download` refuses unscanned files.
4. Health sharing is explicit: `POST /health-shares` creates an expiring,
   scoped grant; `GET /health-shares/received` shows what a recipient may read;
   `DELETE /health-shares/:id` revokes it.
5. `POST /briefs/generate` builds a deterministic, hashed summary for a
   verified clinician. It requires current health-sharing consent, excludes
   free-text notes entirely and records the generator version and record counts.

### 4.6 Safety

1. Set a Safety PIN (`POST /safety/pin`), then register guardians
   (`POST /safety/guardians`) with explicit scopes. The invite is delivered
   through the notification outbox; acceptance is
   `POST /safety/guardians/accept`.
2. `POST /safety/sos/trigger` creates an incident immediately (idempotent for
   an active incident in the last hour), records every guardian attempt honestly
   as `skipped`/`simulated` and reports `deliveryConfirmed: false`. No channel
   is marked sent without provider evidence.
3. `GET /safety/sos-events/:id` returns the incident plus attempts;
   `GET /safety/sos/:id/deliveries` is a deprecated compatibility view of the
   same data. `POST /safety/sos/cancel` requires the PIN.
4. `GET /safety/resources` returns country emergency numbers and directory
   records with a verification state and review freshness; `dispatchSupported`
   is always `false`. Admins refresh review state with
   `PUT /admin/safety/resources/:recordId/review`.
5. Location sessions and quiet check-ins are owner-scoped and expire; revoking
   is explicit.

### 4.7 Documents, content and support

- **Health vault**: `POST /health-vault/upload-intent` returns a short-lived
  Cloudinary signature (the API secret never reaches the client);
  `POST /health-vault/documents` stores metadata; `GET
  /health-vault/documents/:id` returns a signed download URL;
  `DELETE /health-vault/documents/:id` removes the owner's record. All three
  return 503 when Cloudinary is not configured.
- **Articles**: public `GET /articles` and `/articles/:slug` serve only
  published *and medically approved* content. Admin lifecycle is
  draft → `PUT /admin/articles/:id/review` (approval requires an evidence
  reference) → `POST /admin/articles/:id/publish`; any edit resets the review.
- **Support**: public FAQs (`GET /support/faqs`), owner-scoped tickets
  (`POST/GET/PATCH /support/tickets*`), and a role-gated admin queue
  (`/admin/support/tickets`).

### 4.8 Account data lifecycle

`GET /users/me` and `PATCH /users/me` handle the profile. `GET
/users/me/export` assembles the owner's data. `POST /users/me/request-deletion`
schedules deletion and records a privacy job; `GET /users/me/privacy-jobs`
lists jobs; `POST /users/me/cancel-deletion` cancels while the grace period is
open. `GET/PATCH /privacy-settings` and `GET/POST /consents` record purpose-level
consent with policy versions. The retention cron only removes expired
operational rows, never the account's health history.

## 5. Module reference

| Module | Location | Routes | Stores | Key rules |
| --- | --- | --- | --- | --- |
| Auth | `modules/auth` | `/auth/*` (15) | `users`, `sessions`, MFA state | Verified email required for login paths that need it; tokens rotated; per-session revocation; staff MFA |
| Users | `modules/users` | `/users/*`, `/me`, `/onboarding*`, `/config/options`, `/consents`, `/privacy-settings` | `users`, `user_profiles`, privacy jobs, consents | Server-controlled status/roles; onboarding gated until complete; export/deletion owner-scoped |
| Cycles | `modules/cycles` | `/cycles/*` (7) | `cycles`, `daily_logs` | One active cycle; overlap/order validation; versioned logs; predictions are estimates |
| Periods | `modules/cycles` | `/periods` (3) | `cycles` | Contract view over the same records; idempotent repeated start; end cannot overlap next cycle |
| Pregnancy | `modules/pregnancy` | `/pregnancies/*`, `/pregnancy-logs/:date` | `pregnancies`, pregnancy logs | One active pregnancy; encrypted notes; kick counting only after 28 weeks; urgent symptom notice |
| Home | `modules/home` | `/home`, `/daily-logs?from&to` | reads cycles/logs/pregnancy | Composition only; no new health claims; timezone-aware "today" |
| Directory | `modules/directory` | `/directory/*` | `directory_records` | Seeded verified records; public; 2dsphere nearby search; no user data |
| Safety | `modules/safety` | `/safety/*` (19) | incidents, guardians, invites, location sessions, PIN | PIN hashed and throttled; SOS never claims dispatch; owner scoping; audit trail |
| Safety resources | `modules/safety` | `/safety/resources`, `/admin/safety/resources*` | `emergency_resources` | Source verification + review freshness; `dispatchSupported: false` |
| Health vault | `modules/health-vault` | `/health-vault/*` (5) | `health_vault_documents` | Signed upload/download; owner scoped; 503 when storage is unconfigured |
| Care catalog | `modules/care` | `/specialists*`, `/care/availability` (deprecated) | `clinicians`, `availability_slots` | Only verified + active clinicians; server-side pricing |
| Clinician availability | `modules/care` | `/clinician/slots` (GET/POST), `/clinician/slots/:id` (PATCH/DELETE) | `availability_slots` | Scoped to the caller’s own verified clinician profile; held/booked slots cannot be changed (409); delete is hard so the start time can be republished |
| Bookings | `modules/care` | `/bookings/*`, `/payments/:id`, `/receipts/:bookingId`, `/clinician/bookings*` | `bookings`, `payments`, webhook events | 10-minute atomic holds; price never trusted from client; confirm only via signed webhook |
| Promotions / entitlements | `modules/care` | `/promo-codes/validate`, `/subscriptions/me` | promo codes, bookings, payments | Validation only — a discount is never applied; entitlements come from verified payments |
| Communications | `modules/communications` | `/notifications*`, `/notification-preferences`, `/consultations*`, `/attachments/:id/download`, `/devices*` | notifications, consultations, messages, attachments, devices, shares | Participant-only consultations; encrypted bodies; device tokens hashed; scanned-only downloads |
| Notifications / webhooks | `modules/notifications` | `/webhooks/twilio/*`, `/internal/cron/process-notifications` | notification outbox | Twilio signature verification; atomic outbox claim; unconfigured providers fail, never "sent" |
| Mail | `modules/mail` | — (used by auth) | none | Resend in production, capture provider in dev/test; never includes health data |
| Support | `modules/support` | `/support/*`, `/admin/support/tickets*` | support tickets | Owner-scoped threads; admin reply/status with server timestamps |
| Articles | `modules/articles` | `/articles*`, `/admin/articles*` | articles | Publish requires approved medical review with evidence; edits reset review |
| Briefs | `modules/briefs` | `/briefs/*`, `/specialists/me/shared-briefs` | clinical briefs, consents | Consent + verified clinician recipient + no free text; deterministic SHA-256 snapshot |
| Admin | `modules/admin` | `/admin/*` | users, clinicians, directory, audit | Every action role-checked and audited; clinician verification needs evidence |
| Waitlist | `modules/waitlist` | `/waitlist*` | waitlist entries | Public join/stats; list view requires `WAITLIST_LIST_PASSWORD` header |
| Retention | `modules/retention` | `GET|POST /internal/cron/run-retention` | operational collections | Preview by default; deletion needs `?dryRun=false` and the env flag; schedulers use GET, operators POST; never purges account health records |
| Health | `health` | `/health` | none | Liveness only, no dependency detail |

## 6. Duplication audit

The route table is generated from the running Nest app. Current state:

- **168 operations** across 141 paths, **no duplicate `METHOD + path` pair**.
  Nest would refuse to register a second handler for the same method and path,
  and the OpenAPI document has one entry per operation.
- Every operation has exactly one owning controller. No two controllers register
  the same path prefix and method.

There are, however, deliberate path **aliases** for the PRD contract. They call
the same service method, so behaviour and authorization cannot drift, but they
do appear twice in the surface. These are the only overlaps, and each has a
canonical route:

The PRD path is canonical in every pair; the earlier form is kept and marked
`deprecated` so generated clients steer to one route:

| Canonical (PRD) route | Deprecated compatibility route | Notes |
| --- | --- | --- |
| `GET/PATCH /me` | `GET/PATCH /users/me` | Same `UsersService` methods |
| `GET/PATCH /onboarding`, `POST /onboarding/complete` | `/users/onboarding*` | Same service methods |
| `GET /pregnancies/active` | `GET /pregnancies/current` | Same service method |
| `GET /pregnancy-logs/:date` | `GET /pregnancies/logs/:date` | Same service method |
| `GET /specialists/:id/slots` | `GET /care/availability` | The cross-specialist view is retained for the web client |
| `GET /safety/sos-events/:id` | `GET /safety/sos/:id/deliveries` | Same implementation; the delivery list is a view of the event |

The duplicate hold surface (`GET|POST /care/holds`, `DELETE /care/holds/:id`) was
**removed**. It exposed a second hold resource with a different shape than
`POST /bookings/hold`, which is the PRD operation and the only hold path now.
Its three e2e assertions moved to `/bookings/hold` + `GET /bookings?status=held`.

Related but **not** duplicates (different resource or authorization):

- `/periods` and `/cycles/start-period` / `/cycles/end-period` operate on the
  same cycle records but are different contracts: `/periods` accepts a start,
  end and note and is the PRD CRUD view; the `/cycles/*` routes are the
  original app flow and return a prediction. Both now share the same
  period-end validation (`assertPeriodEndAllowed`) and the same
  `createPeriod → startPeriod` / `updatePeriod → updateCycle` code path, so
  rules such as overlap and date ordering cannot diverge.
- `/articles` (public) vs `/admin/articles` (role-gated, includes drafts) —
  different visibility, no shared handler.
- `/support/tickets` (owner) vs `/admin/support/tickets` (staff queue) —
  different authorization and payloads.
- `/payments/:id` vs `/receipts/:bookingId` — different resources (payment
  record vs derived receipt).
- `/consultations/:id/attachments` vs `/attachments/:id/download` — metadata
  listing vs scan-gated download.
- `/daily-logs/:date` supports both `PUT` (replace) and `PATCH` (versioned
  partial update); these are distinct semantics, not a duplicate update.

Client-side duplication was also removed: `pregnancyApi.getActive` (an alias of
`getCurrent`) and the unused `careApi` helpers that pointed only at deprecated
routes are gone, so `packages/api-client` advertises canonical routes. Any
future route should be added once, with an alias only if a published contract
requires it, and the alias must be marked `deprecated` with a pointer to the
canonical path.

## 7. Verification

```bash
# Type-check everything
npx tsc --noEmit -p apps/api/tsconfig.json

# Full API e2e suite (boots an in-memory MongoDB)
cd apps/api && npm test -- --runInBand

# Regenerate the OpenAPI artifacts from the running code
cd apps/api && npm run generate:openapi   # writes openapi.json / openapi.yaml

# Local development API (in-memory Mongo, no local mongod needed)
npm run dev:memory

# Sandbox provider checks (Cloudinary vault + Paystack checkout)
cd apps/api && npm run verify:sandbox -- --dry-run
```

The e2e suite covers auth, onboarding, cycles/periods, pregnancy, home,
consents/config, safety resources, vault/waitlist, care/communications/privacy,
bookings/payments, consultations/devices/SOS, cross-user access, notifications
security, rate limiting, env validation and the HTTP contract.

## 8. Known limitations

- Payments, email/SMS/push, WhatsApp, Cloudinary storage and Redis throttling
  all fail closed when their credentials are absent. See
  `docs/CREDENTIALS.md`.
- Promo codes validate but are never applied; refunds are never executed and
  paid cancellations remain `pending_policy`.
- Attachment downloads are blocked until a scanner marks them clean; no scanner
  is integrated yet.
- SOS records incidents and honest delivery attempts but performs no emergency
  dispatch and no guardian delivery.
- Clinical, privacy and legal sign-off is still required before launch; see
  `docs/COMPLIANCE_READINESS.md`.
