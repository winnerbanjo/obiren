# Òbìrèn Backend Execution Plan

**Basis:** Backend Product Requirements Document & Mobile API Contract v1.0 (19 October 2026). Milestones are ordered to deliver the existing mobile experience without duplicating current API routes. Calendar durations are intentionally omitted until team capacity, provider contracts, and clinical/legal review availability are known.

## Milestone 0 — Baseline, local setup, API contract

**Status:** Implemented; Google login and product approvals remain as Sprint 1 gates

- [x] Inventory existing routes/modules and mark implemented vs missing capability.
- [x] Add resumable eight-step onboarding API and ownership/validation tests.
- [x] Generate OpenAPI 3.1 JSON/YAML from the running Nest API.
- [x] Add purpose-specific append-only consent evidence and public `/config/options`.
- [x] Create git-ignored local API environment file; do not connect it to tests or run migrations on the supplied Atlas database.
- [x] Verify API build and full e2e suites (5 suites, 39 tests), plus OpenAPI artifact and ignore checks.
- [ ] Confirm Google OIDC audiences/provider ownership before implementing login.
- [ ] Obtain product/privacy approval for consent semantics and product/clinical approval for provisional intake options.

**Exit criteria:** API build and e2e suites pass; OpenAPI artifacts are current; local development configuration is git-ignored; product/privacy approves consent purpose/version rules before launch.

## Milestone 1 — Sprint 1 foundations

**Priority:** P0 · **Status:** Backend baseline implemented; product/integration gates remain

- [x] Consent collection appends grant/revocation events by purpose, policy version, source, timestamp, and authenticated owner.
- [x] `/config/options` serves existing localization/country data plus explicitly provisional intake/session enums.
- [x] Add new versioned indexes for onboarding drafts and consent event history.
- [x] Optional staff MFA: TOTP enrolment/verification, single-use recovery codes, encrypted secret at rest, and a short-lived challenge step in sign-in. Sign-in only requires it once an account enables it.
- [ ] Google OIDC: add only with server-side token verification and a configured audience; no client-trusted profile claims. (Still blocked on provider/audience ownership.)
- [ ] Tighten onboarding required fields and paths only after PM confirms skip rules, under-18 policy, unknown LMP behavior, and purpose-specific consent requirements.
- [ ] Mobile team reviews endpoint/enum contract; product/privacy and clinical owners approve the unresolved policies/options.

**Exit criteria:** Backend build and tests pass; mobile can fetch enums and record/revoke consent separately by purpose; no client can change consent history, set a role/status, or access another user’s consent. Launch still depends on product/privacy/clinical approval and OIDC decisions.

## Milestone 2 — Tracking and home (Sprint 2)

**Priority:** P0 · **Status:** Backend slice implemented; clinical review and equipment-dependent kick guidance remain

- [x] Extend existing cycle routes and prediction service; do not recreate `/cycles/current`, `/cycles/history`, or period-start behavior. `/periods` is a contract-compatible view over the same cycle records.
- [x] Implement owner-scoped period edit and history detail, cursor-paginated history, duplicate/order/overlap validation, timezone-aware cycle day, confidence output, and non-contraceptive disclaimer.
- [x] Update the shared typed API client and existing web period tracker to consume the history response envelope.
- [x] Add versioned migration `003_cycle_period_query_index` for cycle-history queries.
- [x] Verify full API e2e suites (9 suites, 68 tests), full monorepo build, and the new index migrations on ephemeral MongoDB.
- [x] Extend existing `/daily-logs/:date` with partial updates and delete using optimistic versioning.
- [x] Extend current pregnancy endpoints with EDD provenance/override, active journey/timeline, comprehensive pregnancy logs, daily wellness, and carefully gated kick counting.
- [x] Add user home aggregation from persisted data, not design placeholders, including the PRD `?date=` day view with deterministic cards, streak and data-sufficiency insights.
- [ ] Clinician review of gestational milestones, kick-count gating (blocked before 28 weeks), and urgent-symptom copy.

**Exit criteria:** Home, calendar, history, logging and pregnancy screens can render from API state; two-user ownership tests pass; cycle dates use user timezone and prediction safety language is medically reviewed.

## Milestone 3 — Care and payments (Sprint 3)

**Priority:** P0 · **Status:** Catalog, availability, holds, bookings, Paystack checkout and webhook confirmation implemented; refunds, promo codes and approved pricing remain gated

- [x] Create verified specialist catalog and clinician verification administration; filter unverified/inactive practitioners from user search.
- [x] Build specialist availability/slot inventory and atomic expiring booking holds. Never double-book concurrent clients.
- [x] Integrate Paystack with server-calculated amount/currency, signed webhook verification, server-side transaction verification, idempotency/deduplication and reconciliation. Checkout and webhook processing fail closed unless `PAYMENT_ENABLED` and an approved `PAYMENT_POLICY_VERSION` are configured.
- [x] Add `/specialists` catalog parity, specialist-scoped slots, the held → pending_payment → confirmed booking state machine, cancellation with slot release, and deterministic receipts. Confirmation occurs only after a signed webhook whose server-side verification matches the quoted amount and currency.
- [x] Extend `/daily-logs` and `/home` with the PRD field set, local-date day view, and `/periods` CRUD over existing cycle records.
- [ ] Define cancellation/refund policy, clinic vs audio/video/text session types, pricing, entitlements and promo codes with product before enabling checkout. Refunds are marked `pending_policy`, never simulated.
- [x] Clinician-side booking completion (`POST /clinician/bookings/:id/complete`) and `GET /subscriptions/me`, which derives entitlements from confirmed, provider-verified bookings and reports `policyPending` instead of inventing a plan catalogue.
- [ ] Apply approved pricing, promotions and refunds at checkout once the payment/refund policy exists.

**Exit criteria:** Concurrent hold and webhook replay/forgery/amount-mismatch/outage tests pass in sandbox; confirmation occurs only after verified gateway success; refund and operational runbooks are approved.

## Milestone 4 — Communications and sharing (Sprint 4)

**Priority:** P1 · **Status:** Conversations, sharing, inbox, and devices implemented; attachments and provider delivery remain

- [x] Consultation-bound conversations with membership checks and cursor pagination.
- [x] Encrypted message storage (AES-256-GCM, ciphertext and tag at rest), delivered/read states based on client evidence. Attachment presigning/scanning remains unimplemented.
- [x] User-authorized health briefs with evidence range, scopes, expiry, revocation, and audit. free-text notes are excluded from the snapshot.
- [x] User notification inbox, read state, preferences, device token registration/revocation with hashed tokens, discreet-mode-safe payloads, and honest delivery status.
- [x] Consultation attachment metadata registration with participant checks. Download fails closed (503) until malware scanning is configured, so nothing is released unscanned.
- [x] Deterministic health briefs (`POST /briefs/generate`, `GET /briefs/:id`, `DELETE /briefs/:id`, `GET /specialists/me/shared-briefs`) with a SHA-256 content hash, per-scope counts, consent and verified-clinician gating, and no free-text notes.
- [x] Reuse the existing notification outbox and internal worker; no parallel queue was added and unconfigured providers are marked failed, never sent.

**Exit criteria:** Unauthorized conversation access and expired/revoked share tests pass; provider failure handling is visible and no private health detail leaks to locked-screen payloads.

## Milestone 5 — Safety, privacy and account controls (Sprint 5)

**Priority:** P1 · **Status:** Guardians, SOS delivery evidence, location sessions, emergency-resource freshness records and privacy jobs implemented; operational and support gates remain

- [x] Extend existing SOS/PIN/incidents routes rather than creating parallel safety endpoints.
- [x] Guardian lifecycle: E.164 invites, one-time hashed token, explicit acceptance, up to five contacts, scopes, revoke and audit trail. Identity confirmation still requires an approved challenge channel, so acceptance does not verify identity.
- [x] SOS delivery attempts with a partial/failure lifecycle that never claims delivery; quiet check-ins and short-TTL location sessions gated by explicit consent with immediate revoke.
- [x] Localized emergency/domestic-violence resources served from the published dataset with explicit verification and freshness records: `GET /safety/resources` is public (no token, no account data), each record carries `source_verified`/`directory_source_verified`/`operationally_confirmed` state plus `lastCheckedAt`/`nextReviewDueAt`/`freshness`, and staff reviews are recorded through audited, evidence-backed `emergency_manager` administration. An unreviewed or overdue resource is labelled as such; nothing claims rescue or government dispatch.
- [ ] Operationally confirm every published number with the provider before launch. The dataset is source-checked only; several records still carry an editorial follow-up note and must not be presented as operationally confirmed.
- [x] Extend export/deletion routes with job records, owner-cancellable deletion, consultation-message export, and documented retention limits. Erasure execution is operator-managed pending retention approval.
- [x] Support FAQ and ticket APIs: public versioned FAQ copy that reports its own review state, owner-scoped tickets with references and replies, and a staff queue. No health record is attached to a ticket.
- [x] Retention housekeeping (`POST /internal/cron/run-retention`) for expired operational records only (sessions, invitations, location sessions, expired shares/briefs, idempotency rows, old webhook audit rows). Preview is the default; deletion needs `RETENTION_EXECUTION_ENABLED=true`. Account health records are never purged by it.

**Exit criteria:** Guardian/SOS delivery failures, no GPS, no network, partial delivery, revoke-mid-session, account export integrity, deletion cancellation/retention and role-isolation tests pass; operational safety plan is approved.

## Milestone 6 — Hardening and release readiness

**Priority:** Release gate · **Status:** Not started

- Security review, role/ownership audit, secret management, encryption/backup restore, rate limiting and threat modeling.
- Clinician review of medical language, pregnancy content, warnings, notifications and cycle prediction disclaimers.
- Legal/privacy review of Nigeria/Ghana obligations, consent, DSAR, data retention and vendor DPAs.
- Load test against agreed staging workload and document P95 targets; configure alarms and incident response.
- Verify Paystack/SMS/email/push/webhook failure recovery and production/staging separation.
- [x] Sanitized five-role demo seed (`apps/api/scripts/seed-demo.ts`) plus a verified, priced clinician for local and staging checks.
- [ ] Publish Postman examples, ERD, mobile-screen API matrix, runbooks, rollback plan, and API changelog (OpenAPI 3.1 artifacts are already generated).

**Exit criteria:** QA, mobile, engineering, clinical, privacy/security, and operations signoff; no production health data in test; staging accounts for each role; no deployment or production migration without explicit release authorization.

## Dependency and decision register

| Decision / dependency | Needed by | Owner |
| --- | --- | --- |
| Consent purposes, versions, revoke semantics and required gates | Milestone 1 | Product + privacy/legal |
| Under-18 policy, onboarding step/skip rules, unknown LMP and pregnancy objective behavior | Milestone 1 | Product + clinical/legal |
| Supported country/locale/condition/symptom/session enums | Milestone 1 | Product + clinical |
| OIDC provider, client IDs/audiences and mobile verification setup | Milestone 1 | Platform/security |
| Cycle overlap reconciliation and prediction thresholds/disclaimers | Milestone 2 | Product + clinical |
| Practitioner verification policy, session types/prices, refunds and promo rules | Milestone 3 | Product + clinical/operations |
| Paystack sandbox credentials and webhook host | Milestone 3 | Finance/operations |
| Approved message response-time disclaimer, brief scopes and retention | Milestone 4 | Product + clinical/privacy |
| Guardian invitation identity check, SOS operational plan and verified resources | Milestone 5 | Safety operations + legal |
| Retention exceptions and production DPA/clinical/security review | Milestone 6 | Legal/privacy/security/clinical |

## Current next action

Every PRD endpoint in the audited scope is now implemented and covered by e2e tests, including MFA, support, articles, privacy settings, briefs, attachments, promotions/entitlements and retention. What remains is configuration and approval, not missing routes: Google OIDC provider/audience, product/privacy approval of consent semantics and policy versions, practitioner pricing plus refund/promotion policy, Paystack and messaging/storage credentials, an approved attachment scanner, an operational SOS delivery channel with validated per-country resources, and qualified erasure execution with documented retention exceptions. Do not enable payments, guardian messaging, or account erasure until those approvals and sandbox verifications exist.
