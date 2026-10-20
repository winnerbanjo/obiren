# Òbìrèn Implementation Baseline

**Source of truth:** Backend Product Requirements Document & Mobile API Contract v1.0 (19 October 2026), plus the existing repository behavior. This document records an engineering baseline; any item labeled **proposed** still needs product, clinical, privacy, or operations approval as appropriate.

## Goal and working rules

Deliver a mobile-first, owner-authorized NestJS REST API using the repository’s TypeScript/Mongoose/MongoDB architecture. Existing routes and behavior are extended, not recreated. Before adding a route, check the Nest controllers, the live Swagger document, and the shared API client. Each new or changed endpoint must have strict validation, ownership/role enforcement, OpenAPI metadata, tests for relevant authorization and failure cases, and a changelog entry.

- API prefix: `/api/v1`; successful responses generally use `{ success, data, meta }` and `meta.requestId`.
- JSON dates use `YYYY-MM-DD`; timestamps use UTC ISO-8601. User-local day calculations must use the profile IANA timezone.
- The API’s Zod schemas are authoritative for request validation. Unknown fields are rejected.
- Use existing Nest modules, Mongoose schemas, `@obiren/health-engine`, `@obiren/localization`, and shared types where they are appropriate; do not add another stack or duplicate domain implementation.
- Do not connect test runs to live health-data databases. Use the in-memory Mongo server or an explicitly approved non-production database.
- The user supplied an Atlas URI for local API configuration. It is stored only in the git-ignored `apps/api/.env`; do not run migrations, seed data, or tests against that URI.
- Never claim SOS dispatch, payment, clinical review, or provider delivery succeeded without verified provider evidence.

## Current API inventory (existing routes)

Routes below are already registered in controllers and must be extended rather than recreated. See `/api/v1/docs-json` and `apps/api/openapi.json` / `apps/api/openapi.yaml` for generated request metadata.

| Area | Existing route surface | Implementation notes |
| --- | --- | --- |
| Authentication | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password`; `GET /auth/me`, `/auth/sessions` | Argon2id password hashing; access JWT and rotating opaque refresh tokens; email verification/reset tokens; no Google OIDC endpoint yet. |
| User/profile | `GET /users/me`, `PATCH /users/me`; `GET /users/me/export`; `POST /users/me/request-deletion`, `/users/me/cancel-deletion` | Owner-scoped identity/profile and immediate JSON export exist; deletion is a 30-day request flow, not yet a full erasure worker. |
| Consent | `GET/POST /consents` | Added append-only, user-owned events for seven separate purposes, with current state derived from immutable grant/revocation history. Product/privacy still needs to approve purpose/legal bases and policy versions. |
| Configuration | `GET /config/options` | Added unauthenticated, versioned option catalog based partly on shared localization enums. Condition and session choices are explicitly provisional and need product/clinical review. |
| Onboarding | `GET/PATCH /users/onboarding`; `POST /users/onboarding/complete` | Added for the eight-step PRD contract. Draft is user-owned, resumable, and completion is server-controlled. |
| Cycle | `GET /cycles/current`, `/cycles/history`, `/cycles/history/:id`; `POST /cycles/start-period`, `/cycles/end-period`; `PATCH /cycles/:id` | Existing routes extended with confidence estimates and a contraception disclaimer, timezone-aware cycle day, cursor history, owner-scoped detail/edit, date/overlap validation, and inclusive bleeding duration. |
| Daily cycle logs | `GET/PUT /daily-logs/:date` | Basic upsert exists. Full PRD symptom dimensions, partial PATCH/delete, paginated calendar summaries, note encryption, timezone, and version semantics remain incomplete. |
| Pregnancy | `GET /pregnancies/current`; `POST /pregnancies`; `POST /pregnancies/:id/end`; `PUT /pregnancies/:id/logs/:date` | Pregnancy and symptom logging exist, including limited safety notices. Clinician-confirmed EDD provenance, full timeline, kick sessions, wellness counters, and richer logs remain incomplete. |
| Safety | `POST /safety/pin`, `/safety/pin/change`, `/safety/sos/trigger`, `/safety/sos/cancel`; `GET /safety/pin/status`, `/safety/incidents` | PIN and a user SOS incident flow exist. Guardian invitations, accepted-contact scopes, delivery-attempt lifecycle, quiet check-ins, bounded location sessions, and verified resources remain incomplete. |
| Directory | `GET /directory/search`, `/nearby`, `/services/:serviceId` | Public directory search and localization data exist. Keep SOS emergency-resource verification and directory-service records distinct. |
| Health vault | `POST /health-vault/upload-intent`, `/health-vault/documents`; `GET /health-vault/documents`, `/documents/:id`; `DELETE /documents/:id` | Cloudinary signed flow exists. Broader document scanning, encryption guarantees, and share lifecycle remain release/security work. |
| Notifications | Twilio inbound/status webhooks and `GET /internal/cron/process-notifications` | Provider operations exist; user inbox, preferences, device tokens, deep-link payload controls, and delivery receipts are still missing. |
| Waitlist | Existing public signup, stats, entries, preview endpoints | Not a substitute for product account onboarding. |
| Admin | `GET /admin/metrics`, `/users`, `/audit-logs`; `PUT /admin/users/:id/status`, `/directory` | RBAC and basic administration exist. Specialist verification, CMS review, payments reconciliation, and clinician operations do not. |
| Health | `GET /health` | Liveness only; do not mistake it for dependency readiness. |

## Sprint 1 and Milestone 2 implementation status

- Existing authentication and profile capabilities have been reviewed; the existing account, profile, and cycle routes were extended rather than duplicated.
- Eight-step onboarding draft endpoints and their e2e tests are implemented. A client cannot set `onboardingStatus` directly. Completion requires an objective and final canonical step, and an LMP baseline is only created if there is no active cycle.
- Purpose-specific consent history and public `/config/options` are implemented. Consent writes append distinct grant/revocation events; current choices are derived from history. Indexes are provided by versioned migration `002_onboarding_consent_indexes`.
- The API serves generated OpenAPI 3.1 at `/api/v1/docs-json`; checked-in JSON and YAML artifacts are generated from the live Nest Swagger document and include the new routes.
- Local API configuration reads the git-ignored `apps/api/.env`; test runs continue to use an in-memory database, not the supplied Atlas URI.
- Remaining Sprint 1 product/integration gates: Google OIDC (requires verified provider configuration and app audience), mobile registration/consent integration, product/privacy approval of consent policy semantics, product/clinical approval of provisional options, and a documented staging environment.
- Milestone 2 cycle slice: existing cycle routes now include edit/detail and cursor history; current-cycle estimates include confidence, timezone, and explicit non-contraceptive metadata. The API client and web period-tracker consumer were updated to match the history envelope.
- Remaining Milestone 2: richer daily logs and partial update/delete, local-date log filtering, a complete home aggregation endpoint, pregnancy EDD provenance/timeline/wellness/kick events, and medically reviewed content. Cycle average statistics currently use only valid 20–45 day observed intervals; this remains a limited baseline rather than a clinical prediction claim.
- Important product/legal decision: consent purpose/version requirements, lawful basis, retention, and which consents gate which actions must be confirmed. The API must not collapse health, care, sharing, location, or marketing choices into one checkbox.

## Definition of done per capability

1. Reuse or extend the existing route if its purpose overlaps; do not add a second route for an existing operation.
2. Document request, response, success/failure states, status codes, and security in OpenAPI 3.1.
3. Validate all input server-side with strict Zod schemas; validate calendar dates, ranges, and state transitions.
4. Derive ownership from the bearer token and enforce role and relationship checks for every resource.
5. Add unit/e2e coverage for normal, validation, replay/idempotency, authorization/IDOR, and provider failure paths relevant to the endpoint.
6. Keep private or health data out of logs, push previews, and public configuration responses.
7. Update the milestone status here and in `EXECUTION_PLAN.md`; record unresolved assumptions instead of silently making product decisions.
8. Verify with the API build, relevant e2e tests, and generated API artifact checks. Run full e2e suites before declaring a milestone complete.

## Release constraints

Clinical copy and escalation paths require qualified clinical approval; privacy notices, consent, retention and erasure need qualified privacy/legal review. Payments need signed webhook verification and reconciliation. SOS needs validated per-country resources and an operational incident plan. These are release gates, not features that should be inferred from Figma or a successful TypeScript build.
