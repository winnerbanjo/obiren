# Òbìrèn — PRD v1.0 Backend Audit Report (Phase 1)

**Date:** 21 October 2026
**Scope:** Read-only audit of this repository against Òbìrèn Backend PRD & Mobile API Contract v1.0
**Status:** Phase 1 complete — **no files were modified during the audit** (this report is the first artefact added)
**Next step:** awaiting `go` plus the decisions in §8 before Phase 2 implementation

> **Note (October 2026):** this report describes the repository as audited on 21 October 2026 and is kept unchanged as a historical record. Phase 2 has since closed most findings — for the current state read `docs/IMPLEMENTATION.md`; for open decisions, including Google sign-in (now implemented), read `docs/DECISIONS.md`.

Commands used were reads only (`ls`, `find`, `grep`, `cat`, `git log`, `git status`). No database, provider, or test process was touched.

---

## 1. Stack, tooling, CI

| Area | Finding |
|---|---|
| Framework | **NestJS 11 + TypeScript**, Express adapter — `apps/api/src/app.module.ts`, `apps/api/src/main.ts`. Matches PRD. |
| Database | **MongoDB + Mongoose 8** — `apps/api/src/database/schemas/*`. Matches PRD. |
| Package manager | **npm workspaces**, single `package-lock.json` (no pnpm/yarn). Node 24 / npm 11 locally; CI pins Node 22. |
| Monorepo | `apps/api`, `apps/web` (Next 16), `apps/admin` (Next 16), `packages/{api-client,types,health-engine,localization,permissions,validation,ui}`. |
| Scripts | root `package.json`: `build`, `dev`, `api:dev`, `api:build`, `lint`. API: `dev`, `build`, `start`, `test`, `test:cov`, `lint`, `generate:openapi`. No `seed`, no `migrate`, no `docker:*`. |
| Docker | **not found** (no `docker-compose.yml`, no `Dockerfile`). |
| CI | `.github/workflows/ci.yml` — API typecheck/lint/jest/build; web and admin typecheck/build. **No OpenAPI drift check**, no Redis, no provider sandbox tests. |
| Validation library | **Zod** (`apps/api/src/common/pipes/zod-validation.pipe.ts`, `common/validation/api-schemas.ts`) — `class-validator`/`class-transformer` are installed but **0 imports**. Conflicts with hard rule 1. |
| Redis / queues | **Missing** — no `ioredis`, `bullmq`, `@nestjs/bullmq`; no cache. |
| Storage | **Cloudinary** signed uploads (`apps/api/src/modules/health-vault/health-vault.service.ts`) — not S3-compatible presigned. Conflicts with hard rule 1. |
| Auth | Argon2id, 15-min access JWT, opaque rotating refresh tokens, replay detection, session revocation — `apps/api/src/modules/auth/auth.service.ts:59,161-184`. |
| Rate limiting | `ThrottlerModule.forRoot` registered in `apps/api/src/app.module.ts`, but **no `ThrottlerGuard`/`APP_GUARD` anywhere** → **not enforced**. `@Throttle` on waitlist (`apps/api/src/modules/waitlist/waitlist.controller.ts:23`) is inert. README claims otherwise (see §7). |
| Google OIDC / MFA | **Missing** (no `google` references in `apps/api/src`). |
| Payments | **No real integration.** `apps/api/src/modules/care/care.service.ts:79-90` throws 503; no Paystack controller, no bookings/payments collections. |
| Email / SMS / push | Email: **no sender** (`MAILTRAP_TOKEN` only read by `apps/api/src/config/env.validation.ts`, never used). SMS: none (Twilio used only for WhatsApp webhooks/outbox). Push: none (only token hashes stored). |
| Git state | HEAD `663a050`; **35 uncommitted paths** from the earlier Milestones 2–5 work → Phase 2 cannot honour "small commits" until a baseline commit is made. |

**Verdict vs hard rule 2:** the core stack is NestJS + TypeScript + MongoDB, so this is **not a different stack**; no migration stop was triggered. However two mandated components are currently substituted (Zod for class-validator, Cloudinary for S3) and are listed as **Conflicts** in §7 needing approval.

---

## 2. Existing modules, endpoints, guards, jobs, providers

- **Modules** (15): `auth`, `users` (profile/onboarding/consent/config), `cycles` (+ `daily-logs`), `pregnancy`, `home`, `care`, `communications`, `safety`, `notifications`, `directory`, `health-vault`, `admin`, `waitlist`, `health`, plus `common`.
- **Controllers**: 16 files (full route mapping in §6.4).
- **Guards/pipes/filters**: `apps/api/src/common/guards/jwt-auth.guard.ts` (re-reads status/roles from DB each request), `roles.guard.ts`, `pipes/zod-validation.pipe.ts`, `filters/mongo-exception.filter.ts`. Global `ValidationPipe` in `apps/api/src/common/bootstrap.ts`; global Mongo filter only in `apps/api/src/main.ts` (tests add it too).
- **Interceptors / middleware**: none (no request-ID, logging, idempotency, transform, timeout).
- **Jobs**: single in-DB notification outbox claimed by `GET /internal/cron/process-notifications` (`apps/api/src/modules/notifications/notifications.service.ts`). No BullMQ/Redis worker, no scheduler, no retry backoff beyond outbox counters.
- **Providers**: Twilio (WhatsApp webhooks + outbound messages), Cloudinary (vault), Mailtrap env only. No provider interfaces/abstractions.
- **Migrations**: `apps/api/src/database/migrations/database-migrations.ts` — `001..006` (indexes, locks). Run manually; no npm script.
- **Tests**: 9 suites / 68 tests (`apps/api/test/*.spec.ts`). Last full run earlier in this session (before this audit): 68/68 passed with `--forceExit`; a pre-existing open handle keeps Jest from exiting cleanly. Not re-run during this read-only phase.
- **Docs**: `README.md`, `docs/EXECUTION_PLAN.md`, `docs/IMPLEMENTATION.md`, `docs/PROJECT_AND_REPO_ARCHITECTURE.md`; `apps/api/openapi.json` + `apps/api/openapi.yaml` (3.1.0, 88 paths, generated by `apps/api/scripts/generate-openapi.ts`); `apps/api/postman_collection.json` (2 KB, covers only auth/cycles/pregnancy/directory/admin metrics).
- **No ERD file**, no seed script, no typed-client generator.

---

## 3. Environment variables

### 3.1 Read by code

`NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `CRON_SECRET`, `HEALTH_DATA_ENCRYPTION_KEY`, `HEALTH_DATA_ENCRYPTION_KEY_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `MAILTRAP_TOKEN`, `MAILTRAP_FROM_EMAIL`, `MAILTRAP_FROM_NAME`, `LOG_LEVEL`, `PAYMENT_ENABLED`, `PAYMENT_POLICY_VERSION`, `PAYSTACK_SECRET_KEY`, `WAITLIST_LIST_PASSWORD`.

`.env.example` location: **`apps/api/.env.example`** (tracked). Local `apps/api/.env` exists and is **untracked/git-ignored** (not read).

### 3.2 Gaps in `.env.example`

| Issue | Detail |
|---|---|
| Missing though read | `PAYMENT_ENABLED`, `PAYMENT_POLICY_VERSION`, `PAYSTACK_SECRET_KEY`, `WAITLIST_LIST_PASSWORD` |
| Present but never read | `API_BASE_URL`, `WEB_APP_URL`, `ADMIN_APP_URL`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CLOUDINARY_UPLOAD_FOLDER`, `TWILIO_STATUS_CALLBACK_URL`, `TWILIO_INBOUND_WEBHOOK_URL`, `SENTRY_DSN`, `APP_VERSION` |
| Missing entirely for PRD | Redis, Google OIDC client/audience, S3 buckets/keys/region, SMS provider, push credentials, Paystack public key/webhook secret, throttle settings, feature flags, admin seed |

Startup validation exists (`apps/api/src/config/env.validation.ts`) but only fails fast for a subset (Mongo, JWT, CORS, CRON, health key, payment-approved flag).

---

## 4. Completeness matrix

Legend: **Done** = satisfies the PRD item · **Partial** = exists but incomplete/different contract · **Missing** = not found · **Conflicts** = exists but contradicts a hard rule.

### 4.1 Section 4 — architecture / non-functional

| PRD item | Status | Evidence | What's needed |
|---|---|---|---|
| NestJS + TS + MongoDB/Mongoose | Done | `apps/api/src/app.module.ts`, `apps/api/package.json` | — |
| Redis for throttling/queues/cache | Missing | no `redis`/`bullmq`/`ioredis` in lockfile | Redis module, BullMQ, distributed throttler storage |
| Object storage (S3-compatible, presigned) | Conflicts | `apps/api/src/modules/health-vault/health-vault.service.ts` (Cloudinary SHA-1 signatures) | S3 client + presigner + migration decision |
| Async jobs | Partial | notification outbox + `internal/cron/process-notifications` | BullMQ worker, scheduler, retries |
| Provider abstraction (payments/SMS/email/push) | Missing | Twilio/Cloudinary imported directly | interfaces + implementations |
| Base URL `/v1` | Conflicts | `apps/api/src/common/bootstrap.ts` sets prefix `api/v1`; `vercel.json` | prefix decision (breaking) |
| dev/staging/prod separation | Partial | env-driven only; `vercel.json`; no staging config | staging env + separate credentials/webhooks |
| Argon2id | Done | `apps/api/src/modules/auth/auth.service.ts:59,333` | — |
| Short JWT + rotating refresh + revocation | Done | `auth.service.ts:161-209`; `session.schema.ts` TTL | — |
| Google OIDC | Missing | no `google` in `apps/api/src` | `google-auth-library`, audience/issuer checks |
| Optional MFA clinician/admin | Missing | not found | TOTP enrollment/verification |
| Indexes by userId/date | Partial | schemas + migrations `001..006`; gaps in §4.2 | add missing unique/compound indices |
| Retention by purpose | Missing | not found | retention config + purge jobs |
| Server-side DTO validation | Conflicts | Zod pipeline; `class-validator` 0 imports | migrate to DTO classes per hard rule |
| Owner/role authorization | Partial | `jwt-auth.guard.ts`, `roles.guard.ts`; owner filters in services | guardian role, clinician scoping, systematic per-entity checks |
| Rate limit login/expensive APIs | Missing (in effect) | no `ThrottlerGuard`; README claims 30/min | register guard, Redis storage, per-route limits |
| Idempotency keys | Partial | SOS dedupe only (`safety.service.ts:181`); notif `idempotencyKey` | `Idempotency-Key` interceptor + collection |
| Timezone-correct dates | Partial | `cycles.service.ts`, `pregnancy.service.ts` use profile tz; daily-log date is client string | server-verified local date; test cross-midnight |
| P95/SLO/alarms | Missing | no load tests, no metrics | load runs, metrics, alarms |
| TLS / encrypted DB/backups | Missing | app-level only | infra configuration |
| Sensitive free-text encryption | Partial | pregnancy notes + messages encrypted (`apps/api/src/common/crypto/health-data-crypto.ts`); **daily-log `notes` plaintext** (`cycles.service.ts:305-316`, `cycle.schema.ts`) | encrypt daily-log notes, key rotation |
| Secrets managed store | Partial | env only | secret manager integration |
| Admin audit + least privilege | Partial | `audit-log.schema.ts`; writes in safety/admin only | audit exports, deletion, consent, auth events |
| Clinical/privacy review | Missing | documented as pending | external review (not code) |

### 4.2 Section 5 — collections, constraints, indices

| Collection | Status | Evidence | What's needed |
|---|---|---|---|
| users | Partial | `database/schemas/user.schema.ts` — unique `emailNormalized`, status soft-delete | `googleSub`, phone, DOB/ageRange at account level |
| consents | Done | `consent.schema.ts` — immutable events, 7 purposes | optional `revokedAt` view (derived today) |
| onboarding | Done | `onboarding.schema.ts` — unique `userId`, step 1–8 | canonical step IDs |
| profiles/preferences | Partial | `UserProfile` in `user.schema.ts` | intent, pregnancyMode, notificationRules, privacySettings |
| cycles/periods | Partial | `cycle.schema.ts` — partial-unique *active* cycle only | `userId+startDate` unique, overlap policy, `editedAt` |
| daily_logs | Partial | `cycle.schema.ts:55-114` — unique `userId+date` | `mode`, flow/bloodColor, energy, cravings, sleep; notes encryption |
| pregnancies | Done | `pregnancy.schema.ts` — active-unique, EDD provenance/history, kicks | medically reviewed milestone content |
| pregnancy_logs | Partial | `pregnancy.schema.ts`; unique index only in migration `004` | declare index in schema; wellness fields |
| specialists | Partial | `care.schema.ts` (`clinicians`) — verification fields | `profession`, certifications, `feeByType`, bio, ratings/reviews |
| availability/slots | Partial | `care.schema.ts` — unique `clinicianId+startsAt`, hold expiry | capacity, type-scoped fees, specialist route |
| bookings | Missing | not found | schema + state machine |
| payments | Missing | not found | schema, unique `gateway+reference`, event dedupe |
| messages | Done | `communications.schema.ts` — AES-GCM fields, consultation index | attachments + scanning |
| briefs/shares | Partial | `health_shares` (scopes, range, expiry, revoke) | generated brief, `generationVersion`, traceability |
| guardians/invitations | Partial | `safety.schema.ts` — max 5, hashed token, scopes | relationship, `declined/expired`, resend, scope PATCH |
| sos_events | Partial | `safety_incidents` + `safety_delivery_attempts` (append-only attempts) | immutable event log, close semantics, retries |
| articles / notifications | Partial | notifications `notification.schema.ts`; articles **not found** | article/CMS collection + review workflow |
| audit / DSAR requests | Partial | `audit-log.schema.ts`, `privacy-job.schema.ts` | broader coverage, IP metadata, retention |

### 4.3 Section 6 — API conventions

| Item | Status | Evidence | What's needed |
|---|---|---|---|
| Prefix `/v1` | Conflicts | `/api/v1` (`bootstrap.ts`, `vercel.json`, `apps/web/next.config.ts`) | alias or breaking rename |
| JSON UTF-8, Bearer auth | Done | `bootstrap.ts`, `jwt-auth.guard.ts` | — |
| `{data, meta?, requestId}` success shape | Conflicts | services return `{success, data, meta:{requestId}}` | envelope decision/transform |
| `{error:{code,message,details}, requestId}` | Conflicts | `common/filters/mongo-exception.filter.ts` returns Nest default for HttpExceptions; mixed service payloads | global error filter + code catalog |
| HTTP code semantics | Partial | services use 400/401/403/404/409/422/429/503 inconsistently | centralized mapping |
| Cursor pagination (20/100) | Partial | cursor: cycles history, consultations, messages; offset: admin users; unbounded: safety incidents (100) | standard pagination DTO + caps |
| Request ID | Partial | per-service `req_${Date.now()}` strings | middleware, echo `X-Request-Id`, include in errors |
| `Idempotency-Key` | Missing | no header handling | interceptor + persistence |
| Rate limiting headers/429 | Missing | guard not registered | enable throttler |

### 4.4 Section 7 — endpoint inventory (one row each)

#### A. Auth, users, onboarding

| Endpoint | Status | Evidence | Needed |
|---|---|---|---|
| POST /auth/register | Partial | `modules/auth/auth.controller.ts:29`; schema requires firstName/lastName, no `termsVersion` | PRD DTO (`fullName`, `termsVersion`) |
| POST /auth/login | Done | `auth.controller.ts:39` | — |
| POST /auth/google | Missing | not found | OIDC endpoint |
| POST /auth/refresh | Done | `auth.controller.ts:60`, rotation + reuse detection | — |
| POST /auth/logout | Done | `auth.controller.ts:87` | — |
| POST /auth/forgot-password | Done | `auth.controller.ts:141` | delivery blocked (no email provider) |
| POST /auth/reset-password | Done | `auth.controller.ts:150` | same |
| GET/PATCH /me | Partial | `/users/me`, `/auth/me` (`users.controller.ts:15`, `auth.controller.ts:101`) | `/me` alias, field coverage |
| GET/PATCH /onboarding | Done (path differs) | `/users/onboarding` (`users.controller.ts:23,30`) | alias `/onboarding` |
| POST /onboarding/complete | Done (path differs) | `users.controller.ts:38` | alias |
| GET/POST /consents | Done | `users/consent.controller.ts` | — |
| GET /config/options | Done | `users/config.controller.ts`, `config-options.ts` | review enum approvals |

#### B. Home, cycles, menstrual check-ins

| Endpoint | Status | Evidence | Needed |
|---|---|---|---|
| GET /home?date= | Partial | `modules/home/home.controller.ts:31` (no `date`; returns cycle/pregnancy/recentLogs only) | pulse/cards/upcomingCare/insights, tz date |
| POST /periods; PATCH /periods/:id | Partial | `/cycles/start-period`, `/cycles/end-period`, `PATCH /cycles/:id` | `/periods` contract, overlap rule |
| GET /periods?from&to | Missing | not found (calendar uses daily logs) | period range endpoint |
| GET /cycles/current | Done | `cycles.controller.ts:25` | — |
| GET /cycles/history | Done | `cycles.controller.ts:32` | — |
| GET /cycles/history/:id | Done | `cycles.controller.ts:39` | — |
| GET /daily-logs?from&to | Done | `home.controller.ts:52` (notes omitted) | summaries/mode |
| GET/PUT /daily-logs/:date | Partial | `cycles.controller.ts:88,99`; schema lacks `mode`, `bloodColor`, `energy`, `cravings`, `sleep`; notes plaintext | DTO + encryption |
| PATCH /daily-logs/:date | Done | `cycles.controller.ts:112` (optimistic version) | extra fields |
| DELETE /daily-logs/:date | Done | `cycles.controller.ts:128` | audit event |

#### C. Pregnancy

| Endpoint | Status | Evidence | Needed |
|---|---|---|---|
| POST /pregnancies | Done | `pregnancy.controller.ts:47` | — |
| GET /pregnancies/active | Partial | `/pregnancies/current` (`:25`) — no trimester, content milestones | alias + trimester |
| PATCH /pregnancies/:id | Done | `:56` (provenance, never elevates to clinician-confirmed) | clinician-confirmed path (staff role) |
| GET /pregnancies/:id/timeline | Partial | `:67` — recorded events only | reviewed week content |
| GET/PUT /pregnancy-logs/:date | Partial | GET `/pregnancies/logs/:date`; PUT `/pregnancies/:id/logs/:date` | date-scoped alias |
| POST /pregnancies/:id/kicks | Done | `:76` (blocked <28 weeks) | clinical copy review |
| GET /pregnancies/:id/kicks | Done | `:86` | — |
| PATCH /pregnancies/:id/wellness | Done | `:94` | — |

#### D. Care, discovery, booking, payments

| Endpoint | Status | Evidence | Needed |
|---|---|---|---|
| GET /specialists | Partial | `/care/clinicians` (`care.controller.ts:15`) — no fee/cursor/detail | full catalog contract |
| GET /specialists/:id | Missing | not found (only `/directory/services/:serviceId`) | profile endpoint |
| GET /specialists/:id/slots | Partial | `/care/availability?from&to` (`:20`) — not specialist-scoped, no type filter | per-specialist slots |
| POST /bookings/hold | Partial | `/care/holds` (`:42`) — no amount/currency, returns hold only | booking hold + price |
| POST /bookings/:id/payment-intent | Missing | `care.service.ts:79` throws 503 | Paystack init |
| POST /webhooks/paystack | Missing | `verifyWebhook` unused (`care.service.ts:83`) | signature+verify+dedupe |
| GET /bookings/:id; GET /bookings | Missing | not found | bookings model |
| POST /bookings/:id/cancel | Missing | not found | refund state |
| GET /payments/:id; GET /receipts/:bookingId | Missing | not found | — |
| GET /consultations | Done | `communications.controller.ts:19` | — |
| POST /promo-codes/validate | Missing | not found | — |

#### E. Messaging and health briefs

| Endpoint | Status | Evidence | Needed |
|---|---|---|---|
| GET /conversations | Partial | `/consultations` (`communications.controller.ts:19`) | naming/contract |
| GET /conversations/:id/messages | Done | `:26` (cursor, membership) | — |
| POST /conversations/:id/messages | Partial | `:35` (encrypted) | attachment IDs |
| POST /uploads/presign | Partial/Conflicts | `/health-vault/upload-intent` (Cloudinary) | S3 presign + MIME/scan |
| POST /messages/:id/read | Partial | `/consultations/:id/read` bulk (`:47`) | per-message receipt |
| POST /briefs/generate | Missing | not found | deterministic generator |
| GET /briefs/:id | Missing | not found | traceability payload |
| POST /briefs/:id/share | Partial | `/health-shares` (`:101`) | brief-scoped share |
| DELETE /briefs/:id/shares/:shareId | Partial | `DELETE /health-shares/:id` (`:114`) | — |
| GET /specialists/me/shared-briefs | Missing | not found | clinician view |

#### F. Safety and guardians

| Endpoint | Status | Evidence | Needed |
|---|---|---|---|
| GET /guardians | Done | `safety.controller.ts:16` | relationship/scopes shape |
| POST /guardians/invitations | Partial | `:21` — no SMS send, delivery explicitly disabled | SMS invite + expiry |
| POST /guardian-invites/accept | Partial | `:27` — acceptance ≠ identity verification | identity confirmation |
| POST /guardians/:id/resend | Missing | not found | throttled resend |
| DELETE /guardians/:id | Done | `:33` | — |
| PATCH /guardians/:id/scopes | Missing | not found | scope mutation |
| POST /sos-events | Partial | `/safety/sos/trigger` (`:84`) — no location snapshot, needs Idempotency-Key | event model |
| GET /sos-events/:id | Missing | only `/safety/sos/:id/deliveries` (`:103`) | state endpoint |
| POST /sos-events/:id/close | Partial | `/safety/sos/cancel` (`:92`, PIN) | close/resolve semantics |
| POST /safety/check-ins | Partial | `:40` — no recipients/delivery audit | delivery lifecycle |
| POST/DELETE /safety/location-sessions | Done | `:45,50,55` (consent-gated, ≤1h TTL) | — |
| GET /safety/resources | Missing | directory search only (`directory.controller.ts`) | verified resources endpoint |

#### G. Learn, settings, notifications, admin, clinician

| Endpoint | Status | Evidence | Needed |
|---|---|---|---|
| GET /articles; GET /articles/:slug | Missing | **not found** (admin UI stub only) | CMS schema/endpoints |
| GET /notifications; PATCH read | Partial | `communications.controller.ts:79,84` — no unread count | unread count |
| GET/PUT /notification-preferences | Partial | `:91,95` — PATCH not PUT | PUT alias/local reminder times |
| POST /devices; DELETE /devices/:id | Done | `:56,61,70` | push delivery absent |
| GET/PATCH /privacy-settings | Missing | not found (preferences partially in notification prefs) | privacy settings model |
| POST /account/export | Partial | `GET /users/me/export` synchronous (`users.controller.ts:60`) | async job + secure download |
| POST /account/delete-request | Partial | `POST /users/me/request-deletion` (`:67`) | erasure worker |
| GET /support/faqs; POST /support/tickets | Missing | not found | support module |
| GET /subscriptions/me | Missing | not found | entitlements |
| ADMIN /admin/specialists, /admin/articles | Partial | `/admin/clinicians*` (`admin.controller.ts:50,57`); articles missing | article review |
| CLINICIAN /clinician/slots, /clinician/bookings | Partial | `POST /care/availability` (`care.controller.ts:25`); no bookings | clinician portal |

### 4.5 Section 9 — lifecycle state machines

| Domain | Status | Evidence | Gap |
|---|---|---|---|
| Booking held→…→refunded | Missing | no bookings model | full machine |
| Guardian invited→active/expired/declined→revoked | Partial | `safety.schema.ts` enum `pending/verified/revoked`; no decline/expire | transitions + timers |
| Pregnancy active→completed/ended/archived | Done | `pregnancy.schema.ts`, `pregnancy.service.ts:endPregnancy` | — |
| SOS triggered→delivery→closed | Partial | `dispatchStatus` + attempts; states `active/cancelled` only | partial/all/failed + close |
| Health sharing draft→active→expired/revoked | Partial | `health_shares` active/revoked/expiry filter | draft + per-recipient consent record |

### 4.6 Section 10 — predictions and clinical safety

| Rule | Status | Evidence | Gap |
|---|---|---|---|
| Cycle intervals, confidence, uncertainty | Done | `packages/health-engine/src/index.ts` (weighted avg, outliers, LOW/MED/HIGH, margins) | product/clinical approval |
| No contraceptive claims | Done | `cycles.service.ts`, controller disclaimers; tests assert | — |
| Gestation from LMP/EDD with provenance | Done | `pregnancy.service.ts` (clinician EDD priority, `dateConfidence`) | review |
| Red-flag escalation copy | Partial | `pregnancy.service.ts:96-101` hard-coded urgent notice | clinician-approved copy; no AI triage (good) |
| Deterministic health brief, traceable coverage | Missing | not found | implement |
| Medically reviewed/versioned content | Missing | no articles/CMS | implement + review workflow |

### 4.7 Section 11 — mobile integration contract

| Item | Status | Evidence | Gap |
|---|---|---|---|
| OpenAPI 3.1 JSON/YAML | Done | `apps/api/openapi.{json,yaml}`, `apps/api/scripts/generate-openapi.ts` | CI drift check |
| Postman collection | Partial | `apps/api/postman_collection.json` (2 KB, 4 groups) | regenerate full collection |
| Typed client generation | Partial | `packages/api-client/src/index.ts` hand-written; **no generator script** | generator + CI |
| Enum dictionary | Done | `GET /config/options` | approvals |
| Realistic seed accounts | Missing | no seed script | 5 roles |
| Push payload rules (no health data, discreet) | Partial | inbox sanitises (`communications.service.ts`); no push sender | push provider + payload tests |
| Idempotent logs/retry-safe | Partial | daily-log version optimistic concurrency; no `Idempotency-Key` | interceptor |
| SOS network-failure contract | Partial | API never claims delivery; no client guidance | mobile + error codes |

### 4.8 Section 12 — edge cases / QA coverage

| Group | Status | Evidence | Missing cases |
|---|---|---|---|
| Onboarding | Partial | `apps/api/test/onboarding.spec.ts` | under-18, unknown LMP, contradictory "none", step-8 incomplete server rules |
| Auth | Partial | `apps/api/test/auth.spec.ts` | Google-existing-email, enumeration, reset expiry |
| Cycles | Partial | `apps/api/test/cycles-pregnancy.spec.ts` | duplicate start date, overlaps, sparse data, cross-tz midnight |
| Daily logs | Partial | `apps/api/test/home-calendar.spec.ts` | full PRD field set, note encryption |
| Pregnancy | Partial | `apps/api/test/cycles-pregnancy.spec.ts` | EDD correction priority, loss flow copy, kick before support |
| Booking/payments | Missing | no endpoints | concurrency beyond holds, expiry, replay, amount mismatch, outage |
| Chat/briefs | Partial | `apps/api/test/care-communications-privacy.spec.ts`, `apps/api/test/consultations-devices-sos.spec.ts` | attachment scan, clinician removal mid-thread, brief expiry |
| Safety | Partial | `apps/api/test/safety-vault-waitlist.spec.ts`, `apps/api/test/consultations-devices-sos.spec.ts` | no GPS/no network, SMS down, partial delivery, recycled phone |
| Privacy | Partial | export/deletion tests | revocation mid-session, deletion retention, rate limits, backup restore |
| Role isolation | Partial | admin RBAC tests | guardian role, clinician cross-patient access |

### 4.9 Section 15 — handover checklist

| Item | Status | Evidence |
|---|---|---|
| openapi.json/yaml | Done | `apps/api/openapi.*` |
| Postman workspace/curl examples | Partial | `apps/api/postman_collection.json` |
| ERD | **not found** | — |
| env-example without secrets | Partial | `apps/api/.env.example` |
| Staging behind HTTPS | Missing | no staging config |
| Test roles (5 accounts) | Missing | no seed script |
| Paystack sandbox + replay tests | Missing | no integration |
| APNs/FCM/SMS/email/monitoring/rollback | Missing | not found |
| API-to-screen checklist | Partial | `docs/IMPLEMENTATION.md` inventory, not per-frame |
| Clinical/privacy signoff | Missing | tracked as pending |

---

## 5. Dependencies

| Dependency | Status | Evidence |
|---|---|---|
| `@nestjs/common|core|platform-express` 11 | Installed | `apps/api/package.json` |
| `@nestjs/mongoose`, `mongoose` | Installed | same |
| `@nestjs/jwt`, `passport`, `passport-jwt` | Installed | same |
| `@nestjs/swagger` | Installed | same |
| `@nestjs/throttler` | Installed **but guard unused** | `app.module.ts` |
| `argon2` | Installed | `auth.service.ts` |
| `class-validator`, `class-transformer` | Installed **but zero imports** | `grep` |
| `zod` | Installed (current validation) | `common/validation` |
| `jest`, `ts-jest`, `supertest`, `mongodb-memory-server` | Installed | devDependencies |
| `twilio` | Installed | WhatsApp only |
| `cloudinary` | Installed | vault (conflict) |
| `bcryptjs`, `joi` | Installed, **dead** | 0 imports |
| `ioredis` / `redis` | **Missing** | lockfile |
| `bullmq` / `@nestjs/bullmq` | **Missing** | lockfile |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | **Missing** | lockfile |
| `google-auth-library` | **Missing** | lockfile |
| `nodemailer` (or provider SDK) | **Missing** | lockfile |
| `firebase-admin` / APNs library | **Missing** | lockfile |
| SMS provider SDK (e.g. Termii/Twilio SMS) | **Missing** (Twilio present but not wired for SMS) | — |
| `openapi-typescript` (typed client gen) | **Missing** | no script |
| Docker/compose file | **Missing** | `find` returned nothing |

---

## 6. Repository facts used above

### 6.1 Schemas (`apps/api/src/database/schemas/`)
`audit-log`, `care`, `communications`, `consent`, `cycle` (+ daily logs), `directory`, `health-vault`, `notification`, `onboarding`, `pregnancy` (+ pregnancy logs), `privacy-job`, `safety-pin`, `safety` (incidents, guardians, invites, location sessions, delivery attempts), `session`, `user` (+ profile), `waitlist`.

### 6.2 Migrations
`apps/api/src/database/migrations/database-migrations.ts` — `001_core_platform_indexes`, `002_onboarding_consent_indexes`, `003_cycle_period_query_index`, `004_pregnancy_logs`, `005_prd_milestones_2_5`, `006_consultation_device_delivery_indexes`.

### 6.3 Tests
`auth.spec.ts`, `onboarding.spec.ts`, `consents-config.spec.ts`, `cycles-pregnancy.spec.ts`, `home-calendar.spec.ts`, `care-communications-privacy.spec.ts`, `consultations-devices-sos.spec.ts`, `safety-vault-waitlist.spec.ts`, `notifications-security.spec.ts` (+ `helpers.ts`, `setup.ts`, `failfast-prod.ts`, `journey-run.ts`).

### 6.4 Controllers and mount points
`auth`, `users` (+ `consents`, `config`), `cycles` (+ `daily-logs`), `pregnancy`, `home` (`/home`, `GET /daily-logs`), `care`, `communications`, `safety`, `notifications` (webhooks + cron), `directory`, `health-vault`, `admin`, `waitlist`, `health`.

---

## 7. Conflicts (per hard rule 6 — listed before any change)

1. **API prefix**: repo `/api/v1`; PRD `/v1`. Changing breaks `packages/api-client`, `apps/web/middleware.ts` + `next.config.ts` proxy, `vercel.json`, docs, tests.
2. **Response envelope**: repo `{success, data, meta:{requestId}}`; PRD `{data, meta?, requestId}`. A global interceptor can add the new shape but every web/admin consumer (`packages/api-client/src/index.ts`) unwraps `.data`, so this is a coordinated breaking change.
3. **Validation library**: hard rule mandates class-validator DTOs; repo uses Zod (`apps/api/src/common/validation/api-schemas.ts`, ~470 lines, all controllers). Migrating touches every route, Swagger metadata, and all e2e tests.
4. **Object storage**: hard rule mandates S3-compatible presigned URLs; repo uses Cloudinary signatures and stores `cloudinaryPublicId`. Migration changes `health-vault` service/schema, `packages/api-client` upload helper, and tests.
5. **Error envelope**: PRD requires `{error:{code,message,details}, requestId}`; `MongoExceptionFilter` forwards raw Nest errors for `HttpException`s, and some services throw `{success:false,error:{…}}` (e.g. `auth.service.ts`, `cycles.service.ts`). Requires a global filter + error-code catalog (breaking payloads).
6. **Rate limiting is not active**, contradicting `README.md` ("global 30 req/min/IP"). Registering the guard will change behaviour for burst clients (expected: desired).
7. **Daily-log private notes are stored in plaintext**, contradicting §4/§10. Fixing changes stored shape (`notes` → encrypted fields) and needs a migration/backfill decision.
8. **`/auth/register` dev-returns verification tokens** (`auth.service.ts:78`) and **no email sender exists** — production accounts cannot verify or reset without an email provider. Not a conflict with PRD, but a release blocker.
9. **Extra non-PRD endpoints** exist (`waitlist`, `directory`, `health-vault`, SOS PIN). Proposal: keep them (additive) unless removal is requested.
10. **Working tree is dirty** (35 files from the previous slice). Phase 2 should start with a baseline commit to keep "one feature per commit" honest.

---

## 8. Decisions needed before Phase 2

1. **Prefix**: adopt PRD `/v1` (breaking, all clients updated) **or** keep `/api/v1` and mount `/v1` as an alias? Default proposal: alias both.
2. **Envelope**: adopt PRD `{data, meta, requestId}` / `{error:{…}, requestId}` (breaking) **or** keep existing and document the deviation? Default proposal: adopt, update all consumers.
3. **Validation**: migrate Zod → **class-validator DTOs** as mandated? Default proposal: yes (keep Zod only for shared frontend forms).
4. **Storage**: S3-compatible provider — **AWS S3**, **Cloudflare R2**, or **MinIO local + S3 in prod**? Default proposal: MinIO local dev + AWS S3 production.
5. **Email / SMS / push providers** (interface + one mainstream implementation): default proposal — **AWS SES (or Resend)** email, **Termii** for Nigeria/Ghana SMS (Twilio SMS fallback), **FCM + APNs** push.
6. Keep the non-PRD modules (waitlist, directory, vault, PIN) as additive? Default proposal: keep.
7. May the baseline commit of the existing 35 changed files be made before Phase 2?

---

## 9. Phase 2 plan (after `go`), in PRD sprint order

1. **Decisions first** (§8), then commit baseline.
2. **Foundations**: `/v1` aliasing + PRD envelope/error filter + request-ID middleware + `Idempotency-Key` interceptor, Redis throttling, class-validator DTO migration, Google OIDC, MFA for staff, `/me` + onboarding aliases, `/config/options` parity.
3. **Tracking**: `/periods`, enriched daily logs (mode/flow/bloodColor/energy/cravings/sleep + note encryption), `/home?date`, pregnancy aliases/trimester/milestones, clinician-confirmed EDD path.
4. **Care**: specialists detail/catalog parity, slots per specialist, **bookings + payments** (Paystack intent, signed/deduped webhook, server verification), cancellation/refund state, receipts, promo validation.
5. **Communications**: briefs (deterministic + traceable + share/revoke), S3 presign with MIME validation, per-message read, clinician shared briefs.
6. **Safety/settings**: guardian relationship/scopes/resend/declined-expired, SMS invites, SOS event model + close + append-only audit, `/safety/resources`, privacy settings, async export, deletion workflow, support FAQ/tickets, subscriptions read, articles/CMS + admin review, clinician bookings.
7. **Cross-cutting**: Redis + BullMQ, provider interfaces (SMS/email/push/storage/payments), indices/migrations, audit coverage, structured logging without health data, readiness probe.
8. **Phase 3**: complete `.env.example`, docker-compose (Mongo+Redis+MinIO), seed script (5 roles), OpenAPI regeneration + Postman + typed-client generation + CI drift check, README rewrite.
9. **Phase 4**: build/lint/typecheck/tests + local smoke (register → login → onboarding → log → hold → signed webhook → guardian invite → SOS) and a final reprint of this matrix.

---

## 10. Verification statement

- No code, schema, environment, or database was modified during this audit.
- Working tree at audit time: **35** uncommitted paths (24 modified files, 3,691 insertions / 630 deletions) — unchanged by the audit.
- No Docker/Compose/ERD files exist in the repository (`find` returned none).
- The test suite was **not re-run** during the read-only audit; the last run earlier in the session passed 9 suites / 68 tests (exit 0 with `--forceExit`; pre-existing Jest open-handle warning).
- Findings above are based on direct file reads and greps; where something is absent it is marked **Missing / not found**, not inferred.

**Stopping here as instructed.** Reply `go` (with any overrides to §8) to begin Phase 2.
