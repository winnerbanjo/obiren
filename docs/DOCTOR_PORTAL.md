# Obiren Doctor Portal — engineering handover

Status: implemented V1 against the existing Obiren API, booking engine and auth.
Product requirement: *Obiren Doctor Portal — Doctor bookings, appointment
management and availability, V1.0*.

The user app, Admin and Doctor Portal all read and write the **same** booking
records. There is no second appointment collection, no second admin app and no
fake dashboard data.

---

## 1. Surfaces

| Surface | Location | Who uses it |
| --- | --- | --- |
| Doctor Portal (new) | `apps/doctor` — port 3003 | Approved doctors |
| Admin → Doctors (new section) | `apps/admin/components/AdminDoctorsView.tsx` | Obiren staff (`super_admin`, `platform_admin`) |
| User app booking flow | `apps/web` (unchanged) | Patients |

### Doctor Portal routes

| Route | Purpose |
| --- | --- |
| `/doctor/login` | Email + password sign-in; rejects non-clinician accounts |
| `/doctor/activate` | One-time invitation token → doctor sets their own password |
| `/doctor/dashboard` | Real counts, today's schedule, pending requests, upcoming, availability snapshot, recent activity |
| `/doctor/appointments` | Searchable, filterable list (status, date, reference/patient) with cursor pagination |
| `/doctor/appointments/[id]` | Detail, payment state, patient note, status history and permitted actions |
| `/doctor/calendar` | Month calendar with appointments and blocked time |
| `/doctor/availability` | Weekly recurring hours (multiple periods/day), duration, buffer, timezone, preview of bookable slots, time off |
| `/doctor/profile` | Public profile editing; credential changes trigger admin re-review |
| `/doctor/notifications` | In-app booking event feed (new booking, confirmed, cancelled, rejected, rescheduled, 24-hour reminder) with unread count |
| `/doctor/settings` | Account state, password-reset request, notification and security notes |

`/` and `/doctor` redirect to `/doctor/dashboard`.

### Admin → Doctors

Added as one item in the **existing** Admin navigation (`doctors` tab), not a
separate admin product. It provides:

- Search (name, email, licence) and filters by status and public visibility.
- Status counts: invited, active, inactive, suspended.
- **Add Doctor** form grouped exactly as the PRD: personal, professional,
  practice, booking setup, account setup. Required fields: full name, email,
  professional title, specialization, at least one consultation type.
- Edit (email is immutable), activate/deactivate, suspend with a required,
  recorded reason, and reissue invitation.
- **Verify** (audited): evidence reference is mandatory; `active` is only kept
  true for an already-active doctor, so an invited doctor is never published
  before they take control of their account.
- Duplicate email and duplicate licence number are rejected with `409`.
- Doctor rows expose no password, clinical note or unrelated patient data.

#### Invitation / activation (no admin-set passwords)

1. Admin creates the doctor. The API creates the linked `user` (roles
   `user`, `clinician`) and `clinicians` profile.
2. A 7-day, single-use invitation token is issued (stored hashed).
3. If email is configured, the invitation is sent. If not, the API reports
   `emailDelivery: "not_configured"` **honestly**; in non-production it returns
   the one-time token once so Admin can copy the activation link. No reusable
   password is ever returned.
4. The doctor opens `/doctor/activate?token=…`, sets a password (≥8 chars, one
   uppercase, one number), and signs in. Activation marks the email verified
   and, for a verified doctor, activates the public profile.

Set `NEXT_PUBLIC_DOCTOR_PORTAL_URL` on the Admin deployment so the copied
activation link points at the portal (local default `http://localhost:3003`).

---

## 2. Authentication and authorization

- **Portal session:** the existing Obiren auth. 15-minute access JWT in memory,
  HTTP-only rotating refresh cookie, replay detection, DB re-check of status
  and roles on every request.
- **Role:** an explicit `clinician` role **and** a linked `clinicians` profile
  are required. `/doctor/*` pages are client-guarded for usability only; each
  API route is independently guarded by `JwtAuthGuard` + `RolesGuard`
  (`@Roles(ROLES.CLINICIAN)`).
- **Ownership:** no clinician route accepts a doctor id. The service resolves
  the doctor from `req.user.sub`, so changing an id in a URL cannot reach
  another doctor's data. Another doctor's appointment id returns `404`.
- **Admin:** `super_admin` / `platform_admin` only, reusing the existing Admin
  session and RBAC. Account and verification changes are written to the audit
  log; suspension revokes active sessions and hides the doctor.
- **Patient data minimisation:** the portal returns display name, optional
  phone, appointment type/time, patient-supplied note, payment status (never
  card data) and status history. No cycle, pregnancy, vault or clinical record.
- **Public visibility:** discovery requires `active: true`,
  `verificationStatus: "verified"` and a live account; listing also requires
  admin approval. Inactive/suspended/unverified doctors cannot receive new
  public bookings. Slot generation and booking always use the server-side
  calculation.

---

## 3. Data model

Reused, not duplicated:

| Collection | Use |
| --- | --- |
| `users` / `user_profiles` | Doctor account (roles, status) and display profile |
| `clinicians` | Doctor profile, verification, fees, duration, buffer, approval mode, listing |
| `availability_slots` | Concrete bookable inventory, holds and bookings (unique per doctor + start) |
| `bookings` | **The** appointment record for user app, Admin and portal |
| `booking_holds` | 5–10 minute checkout holds |
| `payments`, `payment_webhook_events` | Paystack state and replay protection (unchanged) |
| `in_app_notifications` | Patient + doctor booking events |
| `audit_logs` | Admin doctor actions and verification decisions |

Added for provider-side scheduling (through the existing migration runner):

| Collection | Purpose | Index |
| --- | --- | --- |
| `doctor_availability_rules` | Recurring weekly hours, minutes from local midnight, 0=Sunday | `(clinicianId, dayOfWeek, startMinutes)` |
| `doctor_time_off` | Leave / blocked ranges; overlaps are reported, never auto-cancelled | `(clinicianId, startsAt)` |

Booking additions (same record, no new collection): `statusHistory`
(append-only actor/role/reason/timestamps), `rescheduledFrom`, `completedAt`,
`noShowAt`, `rejectedAt`, `refundStatus`, and an index on
`(clinicianId, startsAt)`. `clinicians.licenceNumber` is uniquely indexed
(sparse) after duplicate checks.

Migration/indexes are created by
`apps/api/src/database/migrations/database-migrations.ts` (idempotent,
checksummed, distributed lock): `npm --prefix apps/api run migrate`.

---

## 4. API

All under `/api/v1`. Regenerated contracts: `apps/api/openapi.json` and
`apps/api/openapi.yaml` (161 paths).

### Provider-side (Doctor Portal)

| Method + path | Notes |
| --- | --- |
| `GET /clinician/me`, `PATCH /clinician/me` | Own profile; public fields only. Credential changes set `credentialReviewRequired` and de-list pending admin approval |
| `GET /clinician/dashboard` | Today/upcoming/pending/completed counts, today's schedule, pending list, availability snapshot, recent activity (doctor timezone) |
| `GET /clinician/bookings` | Filters: `status` (CSV), `from`, `to`, `sessionType`, `q`, cursor/limit |
| `GET /clinician/bookings/:id` | Detail + server-computed `actions` |
| `POST /clinician/bookings/:id/confirm` | Pending → confirmed (manual approval mode) |
| `POST /clinician/bookings/:id/reject` | Reason required; frees slot; paid booking → refund-pending |
| `POST /clinician/bookings/:id/reschedule` | Atomic claim of new slot then release of old; prevents double booking |
| `POST /clinician/bookings/:id/cancel` | Reason required; existing cancellation policy; patient notified |
| `POST /clinician/bookings/:id/complete` | Only after start; never touches payment |
| `POST /clinician/bookings/:id/no-show` | Only after start; state only |
| `GET/PATCH /clinician/schedule` | Weekly rules, timezone, duration, buffer; regenerates future unbooked slots only |
| `GET /clinician/schedule/preview` | Same slot calculator the user app uses |
| `GET/POST /clinician/time-off`, `DELETE /clinician/time-off/:id` | Blocking returns affected appointments for explicit resolution |
| `GET /clinician/notifications`, `POST /clinician/notifications/:id/read` | Doctor-only feed, ownership enforced |
| `GET /internal/cron/appointment-reminders` | Cron-secret guarded; creates one deduplicated in-app reminder per confirmed appointment entering the next 24 hours |

### Admin (existing Admin auth + RBAC)

| Method + path | Notes |
| --- | --- |
| `GET /admin/doctors` | Search/filter/paginate, status counts, booking count, no secrets |
| `POST /admin/doctors` | Creates account + profile, issues invitation |
| `GET/PATCH /admin/doctors/:id` | Admin view / permitted edits (listing requires verified) |
| `POST /admin/doctors/:id/status` | active / inactive / suspended (reason required) |
| `POST /admin/doctors/:id/invite` | Reissues one-time activation link |
| `PUT /admin/clinicians/:id/verification` | Audited verification with evidence reference (existing endpoint, now wired into the Doctors section) |

### Reused, unchanged patient flow

`GET /specialists`, `GET /specialists/:id/slots`, `POST /bookings/hold`,
`POST /bookings/:id/payment-intent`, `POST /webhooks/paystack`,
`GET /bookings/:id`, `GET /bookings`, `POST /bookings/:id/cancel`,
`POST /auth/login`, `POST /auth/activate-doctor`, `POST /auth/refresh`,
`POST /auth/logout`.

Status changes are notified in-app to the patient; the user app already reads
the authoritative booking status, so the portal update is reflected on refresh.
Every transition is validated server-side; invalid transitions return `409`
or `422`, never a silent success.

---

## 5. Local development

```bash
npm install

# 1) API with an in-memory MongoDB (no external DB needed)
npm --prefix apps/api run dev:memory     # http://localhost:3000/api/v1

# 2) Admin (Doctors section)
cp apps/admin/.env.example apps/admin/.env.local
npm run admin:dev                        # http://localhost:3002/user

# 3) Doctor Portal
cp apps/doctor/.env.example apps/doctor/.env.local
npm run doctor:dev                       # http://localhost:3003
```

Both Next apps proxy `/api/v1/*` to `API_PROXY_TARGET`; keep it pointed at the
same API deployment in staging so cookies and booking records stay consistent.

## 6. Configuration still required externally

| Setting | Effect if missing |
| --- | --- |
| `RESEND_API_KEY` + `EMAIL_FROM` (API) | Invitation and password-reset **emails are not sent**. Admin reports `not_configured` and shows the single-use link in non-production. Nothing is faked. |
| `NEXT_PUBLIC_DOCTOR_PORTAL_URL` (Admin) | Copied activation links fall back to the Admin origin / localhost:3003. |
| `API_PROXY_TARGET` (Admin + Doctor) | Both apps default to `http://localhost:3000`. |
| `PAYSTACK_SECRET_KEY` (API) | Existing behaviour: paid booking confirmation stays unavailable; portal lifecycle actions still work on the same records. |

Video consultation, chat, prescriptions, payouts and EMR are **out of V1
scope**, as specified in the PRD.

---

## 7. Verification evidence

Run:

```bash
cd apps/api && npx jest --runInBand
```

Latest run: **23 suites / 165 tests passed** (November 2026), including
`apps/api/test/doctor-portal.spec.ts` (11 tests) which exercises, through real
HTTP against in-memory MongoDB:

1. Admin creates a doctor → single-use invitation → doctor activates own
   password → admin list shows them active; invitation cannot be replayed.
2. Duplicate email / duplicate licence rejected.
3. Listing an unverified doctor rejected.
4. Doctor publishes weekly availability → user-facing catalogue and slots show
   it → concurrent attempts for the same slot cannot both succeed.
5. Doctor lifecycle: confirm, reject, cancel, complete, no-show, with invalid
   transitions rejected, status history and notifications recorded.
6. Reschedule is atomic and releases the previous slot.
7. Time off reports overlapping appointments instead of cancelling them.
8. Admin hide/suspend/reactivate is enforced on booking.
9. Credential changes de-list the doctor until re-approved.
10. A confirmed appointment inside 24 hours produces exactly one in-app
    reminder, and repeated cron runs cannot duplicate it.
11. Doctor role and ownership enforced on every portal route (another doctor's
    data is not reachable).

Additional checks run for this delivery:

- `npx tsc --noEmit` in `apps/api`, `apps/admin`, `apps/doctor` — clean.
- `npx next build` in `apps/doctor` — 13 routes compiled.
- `npx next build` in `apps/admin` — compiled with the Doctors section.
- `npm --prefix apps/api run generate:openapi` — 161 paths regenerated.

### Manual acceptance walkthrough

1. Sign in to Admin as a `super_admin`; open **Doctors** → **Add Doctor**.
2. Choose verification (a licence is required to verify) and whether to list.
3. Copy the activation link if email is not configured; open it in the portal
   and set a password.
4. Sign in at `/doctor/login`; the dashboard shows real (initially empty) data.
5. Set weekly hours in **Availability** and confirm the slot preview.
6. As a patient in the user app, pick one of those slots and complete the
   existing booking flow.
7. The booking appears in the doctor's dashboard/appointments. Perform the
   permitted action; the patient's booking status reflects it.

## 8. Known limitations / deliberate non-goals

- No patient clinical records, notes, prescriptions, video, chat or payouts in
  V1 (PRD out of scope).
- No "preview as patient" link: the existing user app has no specialist detail
  page to link to. The portal shows exactly which public fields are live and
  whether the profile is listed.
- Email/SMS delivery depends on the configured provider; in-app notifications
  are always recorded and never rolled back by a delivery failure. The 24-hour
  appointment reminder is currently in-app only — it is not additionally queued
  to an external channel.
- Doctor password changes use the existing reset flow (email link) because the
  platform has no authenticated change-password endpoint; the portal never
  stores or displays passwords.
