# Obiren API — staging deployment and environment reference

**Purpose:** get the API running on a staging server *before* every credential
exists, so the mobile client team can call real endpoints. This is a staging
handoff document, **not** a launch checklist. Production sign-off still needs the
items in `docs/CREDENTIALS.md` and `docs/COMPLIANCE_READINESS.md`.

Related: `apps/api/.env.example` (annotated template), `docs/CREDENTIALS.md`
(where each value comes from), `docs/API_END_TO_END.md` (how the API behaves).

---

## 1. TL;DR — the smallest staging deployment

Only **one** variable is genuinely mandatory:

```bash
NODE_ENV=production
ALLOW_DEGRADED_STARTUP=true
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/obiren_staging
```

With `ALLOW_DEGRADED_STARTUP=true` the API boots with everything else missing:

- the startup log lists each missing variable and what it disables;
- `GET /api/v1/health` returns `status: "degraded"` plus the same list;
- features that need a missing credential keep failing **closed** with `503`
  and a readable `error.details.requiredEnv` (never a fake success);
- JWT secrets are generated randomly per process, so tokens are unforgeable but
  **sessions end on every restart** and are not shared between instances.

Without the flag the API keeps its production behaviour: it refuses to start and
prints every missing variable. That stays the default for real launches.

---

## 2. Recommended staging values (2-minute setup)

| Variable | Value for staging | Why |
| --- | --- | --- |
| `NODE_ENV` | `production` | Keeps prod security semantics (no dev token echo, no known fallback secrets). |
| `ALLOW_DEGRADED_STARTUP` | `true` | The escape hatch. Boot with gaps, report them. |
| `MONGODB_URI` | Atlas URI for a **staging** database | Required. Never point staging at a database holding real user data. |
| `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` | Two different `openssl rand -base64 48` values | Without them a random secret is used and every redeploy logs everyone out. |
| `CORS_ORIGINS` | `https://<web-staging-host>` (or leave empty for mobile-only) | Only affects browsers. Native apps do not need CORS. |
| `PORT` | whatever the host provides (Render/Railway set it) | The API listens on `PORT`, default 3000. |
| `THROTTLE_LIMIT` / `THROTTLE_AUTH_LIMIT` | e.g. `600` / `60` for staging | Defaults are 120/min and 10/15min; a mobile team testing flows will hit them. |

Do **not** set `NODE_ENV=staging`. It is not a supported value: the API treats
anything other than `production` as development, which enables the *known* dev
JWT fallback secrets (anyone could forge tokens) and other dev conveniences.
Use `NODE_ENV=production` + `ALLOW_DEGRADED_STARTUP=true` instead — the state is
explicit and reported.

---

## 3. Full variable reference

`Required` = the API refuses to start in production without it, unless
`ALLOW_DEGRADED_STARTUP=true`. “Without it” describes the degraded behaviour.

### 3.1 Core

| Variable | Required | Default | Without it |
| --- | --- | --- | --- |
| `NODE_ENV` | yes* | `development` | `development` behaviour: known JWT fallbacks, verification/reset tokens echoed in responses. Always set `production` on a deployed server. |
| `PORT` | no | `3000` | Listens on 3000; most PaaS hosts inject `PORT`. |
| `ALLOW_DEGRADED_STARTUP` | staging only | `false` | `false` = fail fast with a readable list of missing variables. |
| `MONGODB_URI` | **yes (always)** | dev `mongodb://127.0.0.1:27017/obiren_development` | **Fatal, even in degraded mode.** Nothing can be served without a database. |
| `WEB_APP_URL` | no | `http://localhost:3001` | Verification / password-reset links point at the wrong host. |
| `LOG_LEVEL` | no | `info` in prod | — |

\* `NODE_ENV` is not validated as “required”, but leaving it unset gives
development semantics on a public server. Set it.

### 3.2 Authentication and sessions

| Variable | Required | Without it |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | yes (min 32 chars) | A random per-process secret is generated: tokens work until the next restart and are not valid on other instances. |
| `JWT_REFRESH_SECRET` | yes (min 32 chars, must differ) | Same as above for refresh tokens. |

### 3.3 Security, limits and jobs

| Variable | Required | Without it |
| --- | --- | --- |
| `CORS_ORIGINS` | yes (comma-separated) | Browser clients are blocked; native mobile clients are unaffected. |
| `REDIS_URL` | yes | Rate limiting falls back to an in-process counter, so limits do not hold across instances. |
| `CRON_SECRET` | yes | Internal cron routes reject every call: retention and the notification outbox never run. |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | no | `60000` / `120`. |
| `THROTTLE_AUTH_TTL_MS` / `THROTTLE_AUTH_LIMIT` | no | `900000` / `10`. |
| `IDEMPOTENCY_TTL_SECONDS` | no | `86400`. |

### 3.4 Health data

| Variable | Required | Without it |
| --- | --- | --- |
| `HEALTH_DATA_ENCRYPTION_KEY` | yes | Writing daily-log notes, pregnancy notes and consultation messages returns **503** rather than storing plaintext. Everything else (cycles, dates, symptoms without notes) still works. |
| `HEALTH_DATA_ENCRYPTION_KEY_ID` | no | `default`. Label for key rotation/audit. |

### 3.5 Email, identity, storage, messaging, payments

All of these are optional in staging; the feature simply reports itself as
unavailable.

| Variable | Unlocks | Without it |
| --- | --- | --- |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Verification and password-reset email | Mail is captured in-process instead of delivered. **Sign-in still works without email verification**, so the mobile team can register and use the API. Password reset is unavailable. |
| `GOOGLE_CLIENT_ID` | `POST /auth/google` | Endpoint returns `503 PROVIDER_UNAVAILABLE` with `error.details.requiredEnv: ["GOOGLE_CLIENT_ID"]`. Email + password is unaffected. Comma-separate web/iOS/Android client IDs. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Health Vault upload/download | All `/health-vault/*` routes return `503` with the required variable names. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | WhatsApp notifications and webhook signature checks | Outbound notifications are recorded as `failed`, never “sent”. |
| `PAYMENT_ENABLED`, `PAYMENT_POLICY_VERSION`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_API_BASE`, `PAYSTACK_CURRENCY`, `PAYSTACK_CALLBACK_URL` | Checkout and webhook confirmation | Checkout/payment-intent returns `503`; no booking state changes. Requires `PAYMENT_POLICY_VERSION=approved:<version>`. Leave disabled in staging. |
| `WAITLIST_LIST_PASSWORD` | Restricted waitlist list view | That view is inaccessible; the public waitlist signup still works. |

Web-only, in the frontend project (not the API): `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
`API_PROXY_TARGET`.

---

## 4. Deploying

### 4.1 What the server must run

```bash
# On the server, from the repository root
npm ci                                    # full install: ts-node needs typescript
export NODE_ENV=production
export ALLOW_DEGRADED_STARTUP=true
export MONGODB_URI="mongodb+srv://..."
npm --prefix apps/api run migrate         # creates indexes; idempotent, safe to re-run
npm --prefix apps/api start               # ts-node src/main.ts, listens on $PORT
```

`npm run build` compiles to `apps/api/dist/apps/api/src/main.js`, but the
workspace packages resolve to `packages/*/src/index.js`, which only exists after
those packages are built. Running the compiled output directly is therefore not
supported today — use `npm start`, or deploy the Vercel serverless entry
(`apps/api/api/index.ts`) as described in the README.

### 4.2 Platform notes

- **Vercel:** `apps/api/vercel.json` rewrites `/api/v1/*` to `api/index.ts`.
  Set the same environment variables in the project settings and add
  `ALLOW_DEGRADED_STARTUP=true` for the staging environment only.
- **Render / Railway / Fly / a VPS:** use the commands above. Health check path:
  `/api/v1/health`.
- **Scheduler (optional for staging):** the cron endpoints require
  `X-Cron-Secret: $CRON_SECRET`. The definitions in `apps/api/vercel.json`
  currently point at paths that are not all implemented (see §6) — scheduled
  jobs are not needed for mobile API consumption.

### 4.3 Smoke test after deploy

```bash
BASE=https://<staging-host>/api/v1

# 1. Liveness + exactly what is missing
curl -s $BASE/health | jq '.data.status, .data.configuration.missing[].variable'

# 2. Public content works without any credentials
curl -s $BASE/config/options | jq '.data' | head
curl -s "$BASE/safety/resources?countryCode=NG" | jq '.data.resources | length'
curl -s $BASE/articles | jq '.data'

# 3. Register, then sign in (verification is not required to log in)
curl -s -X POST $BASE/auth/register -H 'content-type: application/json' \
  -d '{"email":"dev@example.com","password":"Str0ngPassw0rd!","firstName":"Dev","lastName":"Tester","countryCode":"NG","preferredLanguage":"en"}'
TOKEN=$(curl -s -X POST $BASE/auth/login -H 'content-type: application/json' \
  -d '{"email":"dev@example.com","password":"Str0ngPassw0rd!","platform":"android"}' | jq -r '.data.tokens.accessToken')

# 4. Authenticated read
curl -s $BASE/users/me -H "authorization: Bearer $TOKEN" | jq '.data.email'
```

If step 3 fails with `503` mentioning `MONGODB_URI`, the database connection is
wrong — the API is up but has nothing to serve.

---

## 5. What the mobile client can build against today

Everything below works with only `MONGODB_URI` configured:

- **Docs:** `GET /api/v1/docs` (Swagger UI) and `/api/v1/docs-json`
  (OpenAPI 3.1, also checked in at `apps/api/openapi.json`).
- **Auth:** register, login, refresh (rotation), logout, sessions, `/auth/me`.
  Google sign-in needs `GOOGLE_CLIENT_ID`; MFA is opt-in TOTP.
- **Onboarding, profile, consent, privacy settings, config options.**
- **Cycles and periods:** `/cycles/*`, `/periods`, `/cycles/current` predictions
  (estimates, explicitly not contraception advice).
- **Daily logs:** `/daily-logs/:date` — notes need
  `HEALTH_DATA_ENCRYPTION_KEY`; the rest of the log fields do not.
- **Home:** `GET /home?date=`.
- **Pregnancy:** `/pregnancies*`, `/pregnancy-logs/:date` (logged notes encrypted;
  check-ins without notes work).
- **Safety:** PIN, SOS trigger/cancel, guardians, incidents, verified emergency
  resources (`/safety/resources`).
- **Support, articles, specialists catalogue, directory search.**

Still 503 in a minimal staging deployment: Health Vault documents, consultation
message bodies (encrypted), Google sign-in, payments/checkout, attachment
downloads, outbound email/WhatsApp/push, and file notes.

---

## 6. Known gaps in this staging setup (do not mistake for done)

1. **Sessions are lost on restart** until `JWT_ACCESS_SECRET` and
   `JWT_REFRESH_SECRET` are set. Set them before sharing the URL with testers.
2. **`/health` is public** and lists missing variable *names* (never values).
   Acceptable for staging; a production launch should run with complete
   configuration so the list is empty.
3. **Payments stay disabled** regardless of `PAYSTACK_*` until an approved
   `PAYMENT_POLICY_VERSION` exists — by design.
4. **Scheduled jobs are limited to two**: `apps/api/vercel.json` runs the
   notification outbox (every 10 min) and retention (`run-retention?dryRun=false`,
   daily 04:00). Cron auth accepts `X-Cron-Secret` and the
   `Authorization: Bearer <CRON_SECRET>` header Vercel sends. Cycle predictions
   are computed on read, and emergency-resource re-verification still has no
   background job — staff review it through `/admin/safety/resources`.
   Set `CRON_SECRET` or both scheduled calls return 401.
5. **No staging monitoring/backups.** Health checks are manual (`/health`).
6. **Staging data is real data.** Never import production health records into
   it; use throwaway accounts.

---

## 7. Before this goes anywhere near real users

Replace the staging shortcut with the production rules: remove
`ALLOW_DEGRADED_STARTUP`, set every required variable, verify the Resend domain,
register the Paystack webhook, confirm every emergency number, and complete the
sign-offs listed in `docs/COMPLIANCE_READINESS.md`. A deployment that starts in
degraded mode is a development convenience, not a launch.

> Repository note: `.gitignore` contains `*docs`, so the `docs/` tree is ignored.
> New files here must be staged explicitly: `git add -f docs/DEPLOYMENT_ENV_STAGING.md`.
