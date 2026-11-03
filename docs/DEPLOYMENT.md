# Deployment

How the monorepo is checked and released. The rule is simple: **only the apps
whose files changed are tested and deployed.**

## 1. Continuous integration (`.github/workflows/ci.yml`)

A `changes` job runs first and inspects the diff with `dorny/paths-filter`.
Every app job is skipped unless its filter matched:

| Job | Runs when |
| --- | --- |
| `api` | `apps/api/**` |
| `web` | `apps/web/**` |
| `admin` | `apps/admin/**` |
| `doctor` | `apps/doctor/**` |

Shared inputs invalidate every app: `packages/**`, `package.json`,
`package-lock.json`, `tsconfig.json`. A docs-only or workflow-only PR therefore
runs no build jobs at all.

Each app keeps its existing checks (typecheck, tests for the API, production
build). Nothing is weakened by being conditional.

## 2. Deployment (same workflow, `deploy` job)

The `deploy` job runs **only on a push to `main`, only after every required
check has passed**, and only if at least one app changed.

It resolves the changed apps and streams `scripts/deploy/remote-release.sh` to
the deployment host over SSH. On the host the script:

1. takes a `flock` (two releases can never overlap),
2. records the current revision,
3. `git fetch` + hard-resets the checkout to `origin/main`,
4. deletes untracked files inside the app and `packages` trees it is about to
   build (`git clean -fd`, never `-x`, so every `.env`, `node_modules` and
   `.next` survives). A page removed in the repo otherwise lingers on the host
   and breaks the next build - which is exactly how a renamed console route
   once failed a redeploy,
5. runs `npm ci` once at the repo root,
6. builds **only the changed apps**,
7. runs API migrations when the API changed (`RUN_MIGRATIONS=1` by default),
8. reloads **only the changed PM2 processes** from `deploy/ecosystem.config.cjs`,
9. probes health endpoints.

### Health check and rollback

The API is always probed at `API_HEALTH_URL` (default
`http://127.0.0.1:3000/api/v1/health`). A probe passes on HTTP 200; when
`REQUIRE_STATUS_OK=1` it also requires `"status":"ok"` (leave it unset on
staging, where missing provider keys intentionally report `degraded`).

If any probe fails after `HEALTH_RETRIES` attempts (default 20 x 3 s), the
script:

1. hard-resets the checkout back to the previous revision,
2. reinstalls, rebuilds and restarts the same apps,
3. re-probes them and reports the outcome,
4. exits non-zero so the Actions run fails and is visible.

Migrations are **forward-only**: a rollback restores code, not the database
schema. Treat schema changes as backward-compatible for one release.

Frontend probes are opt-in: set `WEB_HEALTH_URL`, `ADMIN_HEALTH_URL`,
`DOCTOR_HEALTH_URL` to enable them. When unset, the release logs a warning and
skips that probe rather than failing a deploy for an unknown port.

## 3. Required GitHub configuration

Secrets (`Settings → Secrets and variables → Actions`):

| Name | Purpose |
| --- | --- |
| `DEPLOY_HOST` | Hostname or IP of the deployment server |
| `DEPLOY_USER` | SSH user with access to the checkout and `pm2` |
| `DEPLOY_SSH_KEY` | Private key for that user (no passphrase) |
| `DEPLOY_PORT` | SSH port (optional, defaults to 22) |

Variables:

| Name | Purpose |
| --- | --- |
| `DEPLOY_APP_DIR` | Path to the git checkout (default `/srv/obiren`) |
| `API_HEALTH_URL` | API health endpoint (default `http://127.0.0.1:3000/api/v1/health`) |
| `WEB_HEALTH_URL` | Optional web probe |
| `ADMIN_HEALTH_URL` | Optional admin probe |
| `DOCTOR_HEALTH_URL` | Optional doctor portal probe |

If `DEPLOY_HOST` is not set, the deploy job logs a warning and stops instead of
failing - configure the secrets above to turn releases on. The job also uses
the `production` GitHub Environment, so required reviewers can gate a deploy.

## 4. Host prerequisites

- Node.js 22 and npm on the server.
- PM2 installed globally (`npm i -g pm2`) and started on boot
  (`pm2 startup` + `pm2 save`).
- A git checkout of this repository at `DEPLOY_APP_DIR` with read access to
  `origin`, on branch `main`. It must hold real history, not a shallow clone:
  rollback resets to the previous revision, which a `--depth 1` clone does not
  contain (`git fetch --unshallow` fixes it).
- Each app's environment file present on the host (`apps/api/.env`,
  `apps/web/.env.local`, ...). The release script never writes or prints
  secrets.
- Ports matching `deploy/ecosystem.config.cjs` (API 3020, web 3100, admin 3021,
  doctor 3022) or overridden with `API_PORT`, `WEB_PORT`, `ADMIN_PORT`,
  `DOCTOR_PORT`. The Next.js apps start with plain `next start`, so the `PORT`
  PM2 sets is the port they bind - never hardcode `-p` in a `start` script.
- Free ports. The droplet also runs the kuipid services, which hold
  `3000`-`3003`, so Obiren owns `3020`-`3022`. Starting an Obiren app on
  `3002`/`3003` fails to bind (`EADDRINUSE`) and the host serves nothing, which
  is what previously happened to both app hosts. The `3002`/`3003` ports in the
  package.json `dev` scripts are local-development only.

## 5. Running a release by hand

```bash
ssh deploy@your-host
cd /srv/obiren
APPS="api" bash -s < scripts/deploy/remote-release.sh
```

Useful overrides: `BRANCH`, `HEALTH_RETRIES`, `HEALTH_DELAY`, `RUN_MIGRATIONS=0`,
`REQUIRE_STATUS_OK=1`.

## 6. Domains and the public site

One app owns each surface. The public marketing site exists **only** in
`apps/web` — no other app carries a landing page.

| Host | Serves | App |
| --- | --- | --- |
| `obiren.co` | Landing page and `/waitlist` | `apps/web` (Vercel) |
| `doctors.obiren.co` | Doctor portal, `/doctor/login` … | `apps/doctor` (:3022 behind Caddy) |
| `admin.obiren.co` | `/user`, the internal operations console | `apps/admin` (:3021 behind Caddy) |
| `api.obiren.co` | `/api/v1/*` | `apps/api` (:3020 behind Caddy) |

`apps/admin` has no public surface: `/` redirects to `/user`, the console is
`noindex`, and its address is shared with the Obiren team rather than linked
from the public site. Patients use the mobile app, so there is no patient
sign-up or patient sign-in on the web.

Typing `obiren.co/user` is a `307` to `<ADMIN_APP_URL>/user`, so a habit-formed
address still lands on the console. The redirect lives in
`apps/web/next.config.ts` and publishes nothing: the public site never renders
the console and carries no link to it.

`obiren.co` resolves to Vercel (`216.150.1.193`), while `api.`, `admin.` and
`doctors.obiren.co` resolve to the droplet (`164.90.192.242`). `obiren.co`
must therefore be a Vercel project whose **Root Directory is the repository
root** (empty in project settings), so the root `vercel.json` selects
`apps/web`.

`apps/admin/vercel.json` covers the app-scoped project case: npm workspaces
live outside `apps/admin`, so the file installs and builds from the monorepo
root (`cd ../..`) and forces the Next.js preset. Without it that project fails
to resolve the `@obiren/*` workspace packages on every deploy. The same pattern
applies to any other app-scoped project.

The landing page reads:

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_DOCTOR_PORTAL_URL` | Where "Doctor login" points. Defaults to `https://doctors.obiren.co/doctor/login` in production and `http://localhost:3003/doctor/login` in development. This is inlined at build time, so redeploy after changing it. |
| `NEXT_PUBLIC_IOS_APP_URL` | App Store link. When unset, the badge reads "Coming soon" and the launch-notify form is shown. |
| `NEXT_PUBLIC_ANDROID_APP_URL` | Google Play link. Same behaviour. |
| `API_PROXY_TARGET` | Origin the app's `/api/v1/*` rewrite forwards to. Required on the Vercel project, otherwise browser calls hit `localhost:3000`. |
| `ADMIN_APP_URL` | Origin the console is served from, used only by the `/user` redirect. Defaults to `https://admin.obiren.co` in production and `http://localhost:3002` in development. |

### Reverse proxy for the app hosts (Caddy)

DNS alone is not enough — each app listens on its own port and needs a proxy in
front of it with a certificate. The droplet runs **Caddy**, so a host whose DNS
is correct but whose TLS handshake fails (`SSL routines::tlsv1 alert internal
error`) has a site block whose certificate was never issued.

`/etc/caddy/Caddyfile` — **check the ports on the host before copying these**,
they are per-environment and the defaults in `deploy/ecosystem.config.cjs` need
not match what PM2 was started with:

```caddy
api.obiren.co {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3020
}

doctors.obiren.co {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3022
}

admin.obiren.co {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3021
}
```

| App | Server port | PM2 name | Local dev |
| --- | --- | --- | --- |
| `apps/api` | 3020 | `obiren-api` | 3000 |
| `apps/admin` | 3021 | `obiren-admin` | 3002 |
| `apps/doctor` | 3022 | `obiren-doctor` | 3003 |
| `apps/web` | 3100 (or Vercel) | `obiren-web` | 3001 |

Do **not** add a block for `obiren.co` here: that host resolves to Vercel, so a
site block would shadow the public site.

Read the real ports off the host rather than guessing:

```bash
pm2 list                       # process -> PORT from its env
ss -ltnp | grep -E ':(3020|3021|3022)\b'
```

Every app host must proxy to a *different* port. Two blocks pointing at the same
port means one of them is serving the wrong app — the symptom is an API JSON
envelope (`{"error":{"code":"NOT_FOUND"…}}`) or `Cannot GET /doctor/login`
on the portal host.

Apply and check the certificate:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 50 --no-pager   # ACME errors show up here
```

Caddy issues a certificate on the first request to a new host, so the DNS record
must already point at the droplet when the site block is added. A host whose
TLS handshake fails with `SSL routines::tlsv1 alert internal error` has a site
block but no certificate — reload Caddy and read the ACME errors. Verify with
`curl -sI https://doctors.obiren.co/doctor/login` (expect `200`, not a TLS
error). If the public site sits behind Cloudflare in Full mode, use
`tls internal` on the app hosts as well.

Set `API_PROXY_TARGET` for the portal to `https://api.obiren.co` so `/api/v1/*`
works from the portal origin.
