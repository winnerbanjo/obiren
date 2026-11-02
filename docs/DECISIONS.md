# Engineering Decisions Record — Òbìrèn

This record explains decisions that were made while implementing the PRD where
the document leaves a choice open, or where the safe answer is not the obvious
one. Each entry states the decision, the alternatives considered, and why.

Related documents: `docs/IMPLEMENTATION.md` (what exists),
`docs/EXECUTION_PLAN.md` (milestones and remaining gates),
`docs/CREDENTIALS.md` (variable reference), `docs/COMPLIANCE_READINESS.md`
(approvals).

---

## 1. Google sign-in (`POST /auth/google`)

**Status:** implemented (October 2026). Email + password sign-in is unchanged and
still works, including for accounts that later link Google.

### D-01 — Verify the Google ID token on the server; trust nothing in the body

The client obtains an ID token from Google Identity Services (web) or the Google
Sign-In SDK (mobile) and posts only that token. The API verifies the RS256
signature against Google's published certificates, the issuer
(`accounts.google.com`), the expiry, and the audience before reading any claim.
Email, name and subject come from the *verified payload*, never from the request.

*Alternative rejected:* accepting `{ email, googleId, name }` from the client.
Anyone can post a victim's email address; that is account-takeover as a feature.

*Alternative rejected:* running the OAuth authorization-code exchange in the API.
It requires shipping a client secret and a redirect URI to native clients, and
adds a second, weaker authentication path. ID-token verification is the flow
Google documents for mobile/native clients.

Library: `google-auth-library` (official), constructed once so Google's
certificate cache is reused.

### D-02 — Audiences are an explicit allow-list; unset means disabled

`GOOGLE_CLIENT_ID` accepts one or more client IDs (web, iOS, Android),
comma-separated. A token minted for a different client is rejected even if it is
otherwise valid, so a third-party app cannot ask our API for a session with a
token obtained for itself.

When the variable is unset the endpoint returns **503
`PROVIDER_UNAVAILABLE`** and every other endpoint keeps working. There is no
wildcard audience and no "skip verification in development" switch.

### D-03 — A new Google identity creates an active, email-verified account

Google has already proven control of the address, and the token says
`email_verified: true`. Creating a `pending_verification` account would only add
a second email round-trip that the user cannot pass any better than Google did.
The account is created `active` with `emailVerifiedAt` set, `authProviders:
['google']` and **no password hash**, plus a profile built from the verified
`given_name`/`family_name` (falling back to the email local-part).

### D-04 — Linking to an existing account requires that account to be verified

If the Google email matches an existing account:

| Existing account state | Behaviour |
| --- | --- |
| Email verified | Link (`googleSub` written, `google` added to `authProviders`). Password sign-in keeps working |
| Email **not** verified (e.g. someone pre-registered the address) | **Refuse** with 403 `AUTH_GOOGLE_ACCOUNT_UNVERIFIED`; no link, no session |

*Why:* pre-registration ("pre-hijacking"). If the API auto-linked, an attacker
who registered the victim's email with their own password would silently keep
password access to the account the victim has just claimed with Google. The
refusal message tells the real owner to use *forgot password* — which they can
complete, because the address is theirs — and then link Google from settings.

The reverse direction is also guarded: if an account is already linked to a
different Google subject, a second Google identity for the same email gets
409 `AUTH_GOOGLE_ACCOUNT_CONFLICT`.

### D-05 — Google sign-in cannot bypass MFA

If the account has TOTP enabled, Google sign-in returns the same short-lived
`mfaRequired` / `mfaToken` challenge as password sign-in instead of tokens. A
second factor that can be skipped by choosing another login method is not a
second factor.

### D-06 — Password-less accounts fail password login cleanly

`POST /auth/login` now treats a missing `passwordHash` as invalid credentials
(401) rather than running Argon2 against `undefined` (which produced a 500). A
Google-only user who wants a password uses **forgot password**; no separate
"set password" endpoint was invented, and none is in the PRD.

### D-07 — Disabled states are checked before a session is issued

`suspended`, `restricted` and `deleted` are refused with 403
`AUTH_ACCOUNT_DISABLED`, matching password sign-in. Sign-in also joins the
strict credential rate-limit bucket (`THROTTLE_AUTH_*`).

### D-08 — Storage and migration

`users.googleSub` holds the Google `sub`; a **unique sparse** index
(`uniq_user_google_sub`, migration `012_google_identity_indexes`) prevents two
accounts from claiming the same Google identity while leaving local accounts
without one untouched. The same migration backfills `authProviders: ['password']`
on existing users.

### D-09 — What this does *not* include

- **No Apple sign-in** — not in the audited PRD scope; add it as a separate
  decision (Apple requires a client-secret JWT minted from a private key).
- **No token revocation probe** — Google ID tokens live about an hour and the
  API verifies expiry; the revocation endpoint is not called on every sign-in.
  If "sign out of Google everywhere" must invalidate Obiren sessions, that needs
  an explicit design (it is not in the PRD).
- **No extra Google scopes** — only `openid email profile`. No Gmail, Calendar or
  Drive access, so no Google verification review for sensitive scopes.
- **No mobile SDK wiring in this repository** — the mobile client must add the
  Google Sign-In SDK and call `POST /auth/google`; the shared API client exposes
  `authApi.googleSignIn(idToken)`.
- **Primary client is mobile** — the API exists for the mobile app; the web app
  is a landing page plus a thin authenticated shell. The web Google button
  (`apps/web/components/GoogleSignInButton.tsx`) is therefore a convenience and
  is configuration-gated on `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; the mobile app must
  add the Google Sign-In SDK and post its ID token to `POST /auth/google`.
  Completion status per surface: `docs/PRD_COMPLETION.md`.

### D-10 — Decisions still needed from the business (not engineering)

| Decision | Owner | Effect |
| --- | --- | --- |
| Who owns the Google Cloud project / OAuth consent screen | Product + engineering | Without it there is no client ID to configure |
| Which client IDs exist (web, iOS, Android) and their package/bundle IDs | Mobile + web | `GOOGLE_CLIENT_ID` allow-list |
| Whether Google sign-in should be staff-only or public at launch | Product | Public is the default; restricting would need a role check on first link |
| Brand/consent-screen publishing status | Product | Unverified consent screens show a warning to users |

---

## 2. Is production just "add the .env values"?

No. Environment variables are necessary but not sufficient. The API deliberately
refuses to start in production without its core secrets, and several capabilities
fail closed (503) rather than pretending to work. Beyond `.env`:

### 2.1 Configuration that is more than a value

| Item | What must happen besides setting a variable |
| --- | --- |
| Database | Create the Atlas cluster, database user, IP allow-list, enable backups, then run `npm --prefix apps/api run migrate` (indexes + backfills, including `012_google_identity_indexes`) |
| Email | Verify the sending domain in Resend (SPF/DKIM). `EMAIL_FROM` must be on that domain or verification/reset mail is rejected by receivers |
| Redis | Provision a TLS Redis (Upstash/Redis Cloud) reachable from the API. Without it the API refuses to start in production, because rate limiting is shared state |
| Paystack | Register the webhook URL `https://<api-host>/api/v1/webhooks/paystack` in the dashboard; a booking is confirmed only by a signed webhook, so payments are broken without a publicly reachable API |
| Twilio | Approved WhatsApp sender + message templates; point the inbound/status webhook at the API |
| Cloudinary | Account with the upload preset/folder policy you want; without credentials the vault returns 503 by design |
| Google | OAuth consent screen, client IDs, authorised JavaScript origins, and the audience allow-list above |
| Cron | A scheduler (Vercel Cron or external) calling `/api/v1/internal/cron/*` with `X-Cron-Secret`; nothing runs retention or notification processing without one |
| DNS/TLS | Domains for web, admin and API; update `CORS_ORIGINS` to the real origins (wildcards are not used with credentials) |
| Monitoring | Error tracking, uptime checks and log retention are not configured by any env var in this repo |
| Backups/DR | Atlas backup schedule and a restore rehearsal |

### 2.2 Approvals no variable can grant

These are release gates in `docs/EXECUTION_PLAN.md`, not code gaps:

- Clinical review of article copy and of cycle/pregnancy/symptom wording before publishing.
- Product/privacy approval of consent purposes, lawful bases and policy versions.
- Safety-operations confirmation (by phone) of every published emergency number, and an approved SOS delivery channel.
- Finance/product approval of prices, refunds and promotions before `PAYMENT_ENABLED=true`.
- An approved malware scanner before attachment downloads leave `not_configured`.
- Qualified legal execution of erasure/retention exceptions before account deletion runs automatically.

### 2.3 Capabilities that are intentionally out of scope

Refunds (a paid cancellation is marked `pending_policy`), promo-code redemption
(validation quotes a price only), push notification delivery (devices are
registered; nothing sends), SMS, and S3/R2 object storage. They are documented
so they are not mistaken for missing configuration.

---

## 3. Testing and verification rules adopted

- `NODE_ENV` is never used as a "trust me" switch: verification/reset tokens are
  echoed in responses only for `development` and `test`
  (`apps/api/src/common/auth/token-exposure.ts`), and the allow-list fails closed.
- Google verification is injected (`GoogleTokenVerifier`), so the e2e suite
  covers account-linking rules without contacting Google; the verifier's own
  failure modes are tested by stubbing `OAuth2Client.verifyIdToken`.
- Anything requiring a live provider is exercised by
  `apps/api/scripts/verify-sandbox-integrations.ts`
  (`npm --prefix apps/api run verify:sandbox`), which never prints secrets and
  exits non-zero on any failure. It cannot pass without real credentials —
  that is the point.
