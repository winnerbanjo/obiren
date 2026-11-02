# PRD v1.0 — endpoint audit

**Audited against:** Òbìrèn Backend Product Requirements Document & Mobile API
Contract v1.0 (19 October 2026), §7 endpoint inventory.

**Audited surface:** `apps/api/openapi.json` (generated from the running Nest
app) — **141 paths / 168 operations**.

**Verdict:** every capability named in PRD §7 exists. **0 missing.** 21 of the
91 PRD operations are reachable under a different path or HTTP method than the
PRD spells out; 2 of those also differ in behaviour (export is synchronous
instead of an async archive, and read receipts are conversation-scoped rather
than per-message). There are **no duplicate `METHOD + path` entries** and **no
duplicate route surface**: the legacy `/care/holds` resource was removed.

> The mobile client should generate from the checked-in OpenAPI document, not
> from the PRD's prose paths. Where the two differ, §3 is the mapping.

---

## 1. Coverage by section

| PRD section | Operations | Exact path | Different path/method | Missing |
| --- | --- | --- | --- | --- |
| A. Auth, users, onboarding | 15 | 15 | 0 | 0 |
| B. Home, cycles, check-ins | 12 | 12 | 0 | 0 |
| C. Pregnancy | 9 | 8 | 1 | 0 |
| D. Care, booking, payments | 13 | 13 | 0 | 0 |
| E. Messaging and briefs | 10 | 3 | 7 | 0 |
| F. Safety and guardians | 13 | 4 | 9 | 0 |
| G. Learn, settings, notifications, admin | 19 | 15 | 4 | 0 |
| **Total** | **91** | **70** | **21** | **0** |

---

## 2. Exact matches (70)

All of these are present with the PRD's method and path (`/v1` is accepted as an
alias of the `/api/v1` prefix):

- **A:** `POST /auth/register`, `/login`, `/google`, `/refresh`, `/logout`,
  `/forgot-password`, `/reset-password`; `GET|PATCH /me`; `GET|PATCH
  /onboarding`; `POST /onboarding/complete`; `GET|POST /consents`; `GET
  /config/options`.
- **B:** `GET /home`; `POST /periods`; `PATCH /periods/:id`; `GET /periods`;
  `GET /cycles/current`; `GET /cycles/history`; `GET /cycles/history/:id`;
  `GET /daily-logs`; `GET|PUT|PATCH|DELETE /daily-logs/:date`.
- **C:** `POST /pregnancies`; `GET /pregnancies/active`; `PATCH
  /pregnancies/:id`; `GET /pregnancies/:id/timeline`; `GET|PUT
  /pregnancy-logs/:date`; `POST|GET /pregnancies/:id/kicks`.
- **D:** `GET /specialists`; `GET /specialists/:id`; `GET
  /specialists/:id/slots`; `POST /bookings/hold`; `POST
  /bookings/:id/payment-intent`; `POST /webhooks/paystack`; `GET /bookings/:id`;
  `GET /bookings`; `POST /bookings/:id/cancel`; `GET /payments/:id`; `GET
  /receipts/:bookingId`; `GET /consultations`; `POST /promo-codes/validate`.
- **E:** `POST /briefs/generate`; `GET /briefs/:id`; `GET
  /specialists/me/shared-briefs`.
- **F:** `POST /safety/check-ins`; `POST|DELETE /safety/location-sessions`;
  `GET /safety/resources`.
- **G:** `GET /articles`; `GET /articles/:slug`; `GET /notifications`; `PATCH
  /notifications/:id/read`; `GET /notification-preferences`; `POST /devices`;
  `DELETE /devices/:id`; `GET|PATCH /privacy-settings`; `GET /support/faqs`;
  `POST /support/tickets`; `GET /subscriptions/me`; the admin article lifecycle
  (`GET|POST|PUT /admin/articles`, `PUT /admin/articles/:id/review`, `POST
  /admin/articles/:id/publish|archive`); `GET|POST|PATCH|DELETE
  /clinician/slots`; `GET /clinician/bookings`, `POST
  /clinician/bookings/:id/complete`.

---

## 3. Present under a different path or method (21)

| PRD operation | Actual operation | Note |
| --- | --- | --- |
| `PATCH /pregnancies/:id/wellness` | `PATCH /pregnancies/:id/wellness/{date}` | Date is a path segment, not a body field. |
| `GET /conversations` | `GET /consultations` | The PRD lists both `GET /consultations` (D) and `GET /conversations` (E). One endpoint satisfies both. |
| `GET /conversations/:id/messages` | `GET /consultations/:id/messages` | Participant-scoped, cursor paginated. |
| `POST /conversations/:id/messages` | `POST /consultations/:id/messages` | Body encrypted with AES-256-GCM. |
| `POST /uploads/presign` | `POST /health-vault/upload-intent` | Cloudinary signed upload; no S3 presign. |
| `POST /messages/:id/read` | `POST /consultations/:id/read` | **Behaviour:** conversation-scoped acknowledgement, not per message. |
| `POST /briefs/:id/share` | `POST /health-shares` | Recipient-scoped, date-range-limited, expiring grant; not addressed by brief id. |
| `DELETE /briefs/:id/shares/:shareId` | `DELETE /health-shares/:id` | Revocation is immediate. |
| `GET /guardians` | `GET /safety/guardians` | |
| `POST /guardians/invitations` | `POST /safety/guardians` | Hashed one-time invite, max 5, scopes. |
| `POST /guardian-invites/accept` | `POST /safety/guardians/accept` | Acceptance does not verify identity (documented). |
| `POST /guardians/:id/resend` | `POST /safety/guardians/:id/resend` | Throttled. |
| `DELETE /guardians/:id` | `DELETE /safety/guardians/:id` | |
| `PATCH /guardians/:id/scopes` | `PATCH /safety/guardians/:id/scopes` | |
| `POST /sos-events` | `POST /safety/sos/trigger` | Needs `Idempotency-Key`; never claims dispatch. |
| `GET /sos-events/:id` | `GET /safety/sos-events/:id` | Incident + per-recipient attempts. |
| `POST /sos-events/:id/close` | `POST /safety/sos/cancel` | Requires the Safety PIN (argon2id, lockout after 5 failures). |
| `PUT /notification-preferences` | `PATCH /notification-preferences` | Same resource, PATCH semantics. |
| `POST /account/export` | `GET /users/me/export` | **Behaviour:** synchronous JSON export, not an async archive job. |
| `POST /account/delete-request` | `POST /users/me/request-deletion` | 30-day cancellable request; erasure stays operator-managed. |
| `ADMIN /admin/specialists` | `GET /admin/clinicians`, `PUT /admin/clinicians/:id/verification` | Evidence-backed verification, audited. |

---

## 4. Endpoints not in the PRD (additive, keep)

- Auth hardening: `POST /auth/verify-email`, `/auth/resend-verification`,
  `GET /auth/me`, `/auth/sessions`, `/auth/mfa/status|enroll|verify|disable|challenge`.
- Users: `GET /users/me`, `PATCH /users/me`, `GET /users/me/export`,
  `GET /users/me/privacy-jobs`, `POST /users/me/request-deletion|cancel-deletion`,
  `/users/onboarding*` (deprecated compatibility forms of `/me` and
  `/onboarding`).
- Cycles: `POST /cycles/start-period`, `/cycles/end-period`, `PATCH /cycles/:id`.
- Pregnancy: `GET /pregnancies/current` (deprecated alias),
  `/pregnancies/history`, `POST /pregnancies/:id/end`,
  `PUT /pregnancies/:id/logs/:date`.
- Safety: `POST /safety/pin`, `/safety/pin/change`, `GET /safety/pin/status`,
  `GET /safety/incidents`, `POST /safety/location-sessions/:id/updates`.
- Care: `GET /care/availability` (deprecated cross-specialist view).
- Communications: `GET|POST /consultations/:id/attachments`,
  `GET /attachments/:id/download`, `GET /health-shares/received`,
  `DELETE /briefs/:id`, `GET /devices`.
- Content and support: `GET|PATCH /support/tickets/:id`, admin support queue.
- Admin: `/admin/metrics`, `/admin/users`, `PUT /admin/users/:id/status`,
  `/admin/audit-logs`, `/admin/directory`, `/admin/safety/resources*`,
  `POST /admin/consultations`, `POST /admin/promo-codes`.
- Platform: `GET /health`, `/directory/*`, `/waitlist*`, `/health-vault/*`,
  `GET|POST /internal/cron/*`, `/webhooks/twilio/*`.

---

## 5. Duplicate-endpoint audit

**No duplicate `METHOD + path`.** Nest refuses to register a second handler for
the same method and path, and the OpenAPI document has exactly one entry per
operation. Every operation has one owning controller.

### 5.1 Deliberate aliases (same service method, no drift)

The PRD path is canonical; the earlier form is retained and marked
`deprecated` so generated clients steer to one route.

| Canonical (PRD) | Deprecated compatibility route |
| --- | --- |
| `GET|PATCH /me` | `GET|PATCH /users/me` |
| `GET|PATCH /onboarding`, `POST /onboarding/complete` | `/users/onboarding*` |
| `GET /pregnancies/active` | `GET /pregnancies/current` |
| `GET /pregnancy-logs/:date` | `GET /pregnancies/logs/:date` |
| `GET /specialists/:id/slots` | `GET /care/availability` |
| `GET /safety/sos-events/:id` | `GET /safety/sos/:id/deliveries` |

### 5.2 Removed duplicate surface

`/care/holds` (`GET`, `POST`, `DELETE /:id`) was **removed**. It exposed a second
hold resource — `{ holdId, bookingEnabled: false }` with no server pricing — that
duplicated `POST /bookings/hold`, the PRD operation and now the only hold path
(`{ booking: { status: 'held', amountMinor, currency }, holdExpiresAt,
checkoutEnabled }`). Its three e2e assertions moved to `/bookings/hold` and
`GET /bookings?status=held`.

### 5.3 Overlaps the PRD itself creates

- `GET /consultations` (D) and `GET /conversations` (E) describe one list; the
  API exposes one route.
- `GET|PATCH /privacy-settings` and `GET|PATCH /notification-preferences` are
  separate settings surfaces: consent/preferences vs notification channels and
  discreet mode.
- `PATCH /pregnancies/:id/wellness` and the pregnancy daily log both record
  water/vitamins. Wellness updates counters only; the log stays the full record.

---

## 6. Contract-shape differences to know before writing the mobile client

1. **Daily log body does not match the PRD example.** The API accepts
   `bleeding: {level}`, `pain: {level, locations[]}`, `moods: []`, `energy:
   1–5`, `notes`, plus `mode`/`bloodColor`/`cravings`/`sleep`/`sexualActivity`.
   The PRD example uses `flow`, `mood`, `pain: []`, `painScore`, `privateNote`.
   Copying the PRD JSON yields `400 VALIDATION_ERROR` (unknown fields are
   rejected, not stripped).
2. **Booking hold response** returns `{ booking: { id, status: 'held', … },
   holdExpiresAt, checkoutEnabled }`.
3. **SOS** returns `deliveryConfirmed: false` unless a provider confirmed
   delivery; there is no dispatch guarantee.
4. **`POST /bookings/hold` requires `Idempotency-Key`**, as do payment intents,
   guardian invites and SOS.
5. **`GET /safety/resources`** takes `countryCode` (NG/GH/GB/US), `category`,
   `q`, `limit` — not `country`/`region`. Region is matched by `q`.
6. **Lists are cursor-paginated** with `limit` default 20–30, max 100, except
   clinician-owned slot lists (`limit` max 200, start-time ordered) and the
   safety resource list (`limit` max 50).

---

## 7. Non-endpoint PRD handover items

| PRD §15 item | Status |
| --- | --- |
| OpenAPI 3.1 JSON + YAML | ✅ `apps/api/openapi.json|yaml`, live at `/api/v1/docs-json` |
| Env example without secrets | ✅ `apps/api/.env.example` + `docs/DEPLOYMENT_ENV_STAGING.md` |
| Staging behind HTTPS + test roles | ✅ degraded staging mode; ✅ sanitized five-role seed script |
| Postman collection | ⚠️ exists but stale/small |
| ERD | ❌ not present |
| Paystack sandbox replay tests | ✅ `npm run verify:sandbox` + e2e webhook suites |
| APNs/FCM push delivery | ❌ devices are registered; nothing is pushed |
| SMS delivery | ❌ not implemented (fails closed) |
| Monitoring, alarms, rollback plan | ❌ not present |
| API-to-screen checklist for the 42 frames | ❌ not present |
| Clinical / privacy / security sign-off | ❌ open, tracked in `docs/COMPLIANCE_READINESS.md` |

---

## 8. Decisions taken

1. **No PRD-literal aliases** were added for the 21 differing operations: that
   would double the surface and recreate duplicates. The client generates from
   OpenAPI; §3 is the translation table.
2. **Deprecation flags now follow the PRD**: `/me`, `/onboarding*`,
   `/pregnancies/active`, `/pregnancy-logs/:date`, `/specialists/:id/slots` and
   `/safety/sos-events/:id` are canonical; their earlier forms are marked
   `deprecated`.
3. **`/care/holds` removed**; `/bookings/hold` is the only hold path.
4. **Clinician availability completed**: `GET/POST /clinician/slots` and
   `PATCH/DELETE /clinician/slots/:id`, scoped to the caller's own verified
   clinician profile.
5. **Account export stays synchronous** (`GET /users/me/export`). An async
   archive needs artifact storage that is not configured (Cloudinary is the only
   storage provider and is fail-closed); revisit when a vault/storage decision
   is made.
