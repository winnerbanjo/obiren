# PRD completion status

**Basis:** Òbìrèn Backend Product Requirements Document & Mobile API Contract
v1.0 (19 October 2026), as audited in `docs/AUDIT_REPORT.md`, implemented in
`docs/IMPLEMENTATION.md`, and tracked in `docs/EXECUTION_PLAN.md`.

**Consumer note:** the API is consumed by the **mobile app**. The web app is a
landing page plus a thin authenticated shell, and the admin app is an internal
operations surface. Anything in this document about client work means the mobile
client unless stated otherwise.

> The PRD document itself is not checked into this repository. This status is
> measured against the audited PRD scope recorded in the documents above. If a
> newer PRD revision exists outside the repo, it must be diffed against this
> list before anyone signs off.

## Verdict

| Question | Answer |
| --- | --- |
| Is every PRD route in the audited scope built? | **Yes** — 141 paths in the generated OpenAPI document |
| Is every PRD *behaviour* built? | **No** — the exceptions are listed in §3 and are deliberate |
| Can it ship by only adding `.env` values? | **No** — see §2 |
| Is a staging environment / SLO evidence available? | **No** — nothing has been proven against a deployed environment |

Short version: **the backend is code-complete for the PRD's audited scope, but
the product is not launch-complete.** What is left is configuration, approvals,
and a short list of deliberately deferred features — not unimplemented routes.

## 1. Implemented (no engineering work left)

- Authentication: register, login, refresh (rotating, replay-detecting), logout,
  email verification/resend, password reset, `GET /auth/me`, sessions,
  **Google sign-in** (`POST /auth/google`, added October 2026) and opt-in TOTP MFA
  with single-use recovery codes.
- Onboarding: resumable eight-step draft, server-side completion, `/me` and
  `/onboarding` aliases.
- Consent: append-only, per-purpose history; `/privacy-settings` reads it;
  `/config/options` is public and versioned.
- Cycle and periods: current cycle, history (cursor), detail, edit,
  `/periods` + `/periods?from&to`, period length averages without predictions.
- Daily logs: full PRD field set, optimistic versioning, partial PATCH/delete,
  encrypted private notes, calendar read without notes.
- Home: day view with cycle/pregnancy state, streak, next-action cards and
  data-sufficiency insights.
- Pregnancy: current/active, EDD provenance, timeline, encrypted check-ins,
  wellness counters, kick counting gated at 28 weeks.
- Safety: PIN, SOS with per-recipient delivery attempts (never faked), guardians
  with hashed one-time invites, check-ins, consent-gated location sessions,
  verified emergency-resource dataset with review workflow and freshness.
- Care: verified specialist catalogue, slots, atomic holds, server-priced
  checkout, Paystack webhook-confirmed bookings, receipts, cancellation,
  participant-scoped encrypted consultation messaging, health shares.
- Content and support: medically reviewed articles, FAQs, tickets and staff
  queue, deterministic health briefs, entitlements/promo quoting.
- Vault and privacy: Cloudinary signed uploads (fail-closed), attachments with
  fail-closed download, export, deletion request/cancel, retention job.
- Platform: PRD response/error envelopes, request IDs, `Idempotency-Key`
  interceptor, Redis-backed throttling, cursor pagination, OpenAPI 3.1 artifacts,
  21 e2e suites / 141 tests, versioned migrations `001`–`012` (no `005`).

## 2. Blocked on configuration or approval (no code change)

| Item | Owner | Why it is not "just an env var" |
| --- | --- | --- |
| Atlas cluster + `npm run migrate` | Ops | Indexes/backfills, incl. `012_google_identity_indexes`, must run against the real database |
| Redis, DNS/TLS, Vercel projects | Ops | API refuses to boot in production without Redis; origins must match `CORS_ORIGINS` |
| Resend domain verification | Ops | SPF/DKIM; without it verification/reset mail is rejected |
| Paystack webhook registration | Finance/Ops | Public URL must exist; a booking is confirmed only by a signed webhook |
| Paystack live keys + approved pricing/refund policy | Finance | `PAYMENT_ENABLED` requires `PAYMENT_POLICY_VERSION=approved:<version>` |
| Google OAuth consent screen + client IDs | Product + mobile | `GOOGLE_CLIENT_ID` allow-list; nothing verifies without it |
| Twilio WhatsApp sender/templates | Ops | Without them notifications are marked failed, never sent |
| Cloudinary account | Ops | Vault returns 503 without credentials (by design) |
| Cron scheduler (`X-Cron-Secret`) | Ops | Retention and notification processing never run otherwise |
| Clinical review of article/pregnancy copy | Clinical | Content is published only with a stored approval reference |
| Emergency-number confirmation by phone | Safety ops | Dataset reports `unreviewed`/`freshness` until reviewed |
| Consent purposes, lawful bases, policy versions | Privacy/Legal | API refuses to guess; changes are recorded events |
| Retention exceptions + erasure procedure | Legal | Deletion currently stops at an operator-managed job |
| Staging environment, monitoring, backups, load/SLO run | Ops | No measurements exist yet; do not claim an SLO |

## 3. Deliberately not implemented (and why)

| Item | Current behaviour | Why deferred | To finish |
| --- | --- | --- | --- |
| Refund execution | Cancelling a paid booking sets `refundStatus: pending_policy`; no refund is claimed | No approved refund policy; the API will not invent financial states | Policy sign-off → Paystack refund call + audit |
| Promo-code redemption | `/promo-codes/validate` quotes a server-priced discount | Redemption changes money; blocked with payments | Approved promotion rules |
| Push notification delivery | Devices registered; no push is sent | No APNs/FCM credentials or provider integration | Provider account + sender worker |
| SMS delivery | Rows fail closed | No SMS provider integrated | Provider + templates |
| Attachment malware scanning | `scanStatus: not_configured`; downloads return 503 | No approved scanner | Scanner vendor approval |
| Automated erasure worker | Deletion request returns `pending_operator_worker`, `erasureCompleted: false` | Retention/legal exceptions unresolved | Documented exceptions → worker |
| Apple sign-in | Absent | Not in audited PRD scope | Client secret JWT + verifier + same linking rules |
| S3/R2 object storage | Cloudinary is the vault provider | Replacement planned behind the same interface | Provider decision |
| Admin payments reconciliation | Admin app has no payments API to call | Not needed for the mobile launch | Finance requirement |
| Secret manager | Environment variables only | Infra choice not taken | Vault/SSM + rotation runbook |

## 4. What the mobile client must still do

- Google: add the platform Google Sign-In SDK, send the ID token to
  `POST /auth/google`, and handle `mfaRequired` (the token pair is not returned
  until `/auth/mfa/challenge` succeeds). No profile fields are sent.
- Store the refresh token in secure storage (Keychain/Keystore) and always
  replace it on `/auth/refresh`; a replayed token revokes the family.
- Send `Idempotency-Key` on holds, payment intents, guardian invites and SOS.
- Treat 503 as "provider not configured", not as a transient failure to retry
  blindly (vault, payments, attachments).
- Generate the client from `/api/v1/docs-json` or the checked-in
  `apps/api/openapi.json` rather than hand-writing request shapes.

## 5. How to re-check this status

```bash
cd apps/api && npm test                     # 21 suites / 141 tests
cd apps/api && npm run generate:openapi     # regenerates the 141-path contract
cd apps/api && npm run build                # typecheck
```

If the answer to "are we finished?" must be yes, the remaining work is §2 and
§3 — configuration, approvals, and six deferred features — not missing
endpoints.
