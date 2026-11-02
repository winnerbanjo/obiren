# Project and Repository Architecture

## Overview

Obiren is an npm-workspaces monorepo for women's health, pregnancy, and personal safety. It has three independently runnable applications and seven shared packages. The main runtime path is:

```text
Browser
  ├── apps/web   (Next.js user application; default API proxy)
  └── apps/admin (Next.js marketing/admin application; default API proxy)
             │ /api/v1/*
             ▼
        apps/api (NestJS REST API)
             │
             ▼
          MongoDB
```

The two Next.js applications proxy `/api/v1/*` to `API_PROXY_TARGET`, defaulting to `http://localhost:3000`. The shared API client uses same-origin `/api/v1` paths unless `NEXT_PUBLIC_API_URL` is explicitly set. This proxy arrangement allows browser refresh-token cookies to remain same-origin.

## Repository layout

```text
.
├── apps/
│   ├── api/                 NestJS API, persistence, authentication, and domain modules
│   ├── web/                 Next.js user-facing website and health app
│   └── admin/               Next.js marketing site and admin control centre
├── packages/
│   ├── api-client/          Typed browser API client and endpoint helpers
│   ├── health-engine/       Cycle prediction calculation
│   ├── localization/        Country configuration and emergency directory data
│   ├── permissions/         Role/action authorization helpers
│   ├── types/               Shared domain and API types
│   ├── ui/                  Shared React primitives and class-name helper
│   └── validation/          Shared frontend Zod schemas
├── package.json             npm workspaces and root-level convenience scripts
├── package-lock.json        npm lockfile (lockfile v3)
├── tsconfig.json            Root TypeScript compiler settings/path aliases
└── vercel.json              Root Vercel configuration for the web app
```

The root workspace includes `apps/*` and `packages/*`. Application-specific TypeScript/Next configuration is under each app; the API also owns its Jest configuration, deployment entrypoint, scripts, and Vercel cron definitions.

## Applications

### `apps/api` — NestJS 11 REST API

- **Default address:** `http://localhost:3000/api/v1`; `PORT` can override the listener port.
- **Bootstrap:** `src/main.ts` validates environment configuration and applies the common bootstrap in `src/common/bootstrap.ts` (Helmet, cookie parsing, `/api/v1` prefix, allow-list CORS, validation, graceful shutdown hooks).
- **Persistence:** Mongoose/MongoDB; schemas are in `src/database/schemas/`, with versioned/index migrations in `src/database/migrations/`. Development defaults to `mongodb://127.0.0.1:27017/obiren_development`; a reachable MongoDB server is still required for API startup.
- **Modules:** auth, users, cycles/daily logs, pregnancy, directory, notifications, safety/SOS, health vault, admin, waitlist, and health/liveness.
- **Cross-cutting security:** Zod request schemas and validation pipe, JWT authentication, database-backed role checks, rate limiting, exception mapping, session refresh rotation, and HTTP-only refresh cookies. Optional integrations include Cloudinary, Twilio, and email delivery.
- **Tests:** Jest integration suites in `test/` exercise authentication, cycle/pregnancy, safety/vault, and waitlist behaviors. `mongodb-memory-server` is a development dependency.
- **Deployment:** `api/index.ts` is the serverless entrypoint; `apps/api/vercel.json` declares cron endpoints.

### `apps/web` — Next.js 16 user app

- **Default Next.js dev port:** 3000 unless overridden with `-p`/`PORT`.
- **Routes:** landing page, authenticated home, waitlist signup/list, and waitlist API route. UI code is under `components/`; API/auth helpers and analytics are under `lib/`.
- **API integration:** uses `@obiren/api-client` and Next rewrites to proxy `/api/v1/*` to the API (`API_PROXY_TARGET`, default port 3000). Authentication keeps access tokens in memory and relies on the API's HTTP-only refresh cookie.
- **Important port caveat:** the checked-in `dev` script is just `next dev`, so it listens on 3000 by default, which conflicts with the API's default port. For a simultaneous local run, explicitly start the web app on 3001.

### `apps/admin` — Next.js marketing and admin app

- **Dev port:** 3002 (fixed by the app's dev script).
- **Routes:** public landing, about/features/pricing/professionals/learn/legal pages, plus `/admin` control centre.
- **API integration:** shares the API client and same-origin `/api/v1/*` rewrite configuration with the user app. Admin authorization is enforced by the API, not by hiding UI routes.

## Shared packages and dependency direction

- `@obiren/types` is the shared domain vocabulary (users/roles, cycles, pregnancy, emergency resources, and response envelopes).
- `@obiren/health-engine` depends on shared types and provides pure cycle-prediction logic.
- `@obiren/localization` depends on shared types and exports country configurations plus emergency-directory records.
- `@obiren/permissions` depends on shared types and evaluates role/action permissions.
- `@obiren/validation` depends on shared types and provides frontend form schemas. The API also maintains authoritative, stricter request schemas in `apps/api/src/common/validation/api-schemas.ts`.
- `@obiren/api-client` is consumed by both Next.js apps for typed HTTP operations and session refresh.
- `@obiren/ui` supplies React primitives (Button, Card, Badge, Stepper) and `cn` styling helper.

Conceptually, the shared packages are consumed by apps; API validation and persistence remain within the API. Domain code should not import from an app.

## Local development

Install dependencies once from the repository root:

```bash
npm ci
```

Run all three processes in separate terminals (or equivalent persistent sessions):

```bash
# API: requires MongoDB on localhost:27017 or MONGODB_URI
npm run api:dev

# User app: use 3001 to avoid the API's default port 3000
npm --prefix apps/web run dev -- -p 3001

# Admin app: app script uses port 3002
npm run admin:dev
```

Open `http://localhost:3001` for the user app, `http://localhost:3002` for admin/marketing, and `http://localhost:3000/api/v1/health` for API liveness. Set `API_PROXY_TARGET` in the frontend environments if the API is not at `http://localhost:3000`.

Root scripts include `dev` (web only, default port 3000), `api:dev`, `admin:dev`, `build` (web, admin, API sequentially), `lint` (web), and corresponding app-specific build scripts. These scripts do not start all apps as a single orchestration command.

## Configuration and deployment notes

- API environment validation is in `apps/api/src/config/env.validation.ts`; the annotated template is `apps/api/.env.example`. Development permits local-only JWT fallbacks and a localhost Mongo URI; production requires secure configuration.
- Cloudinary and Twilio settings enable their respective integrations; without them, related functionality is unavailable or simulated as described by the API implementation.
- Root `vercel.json` builds/deploys the web app. The API has a separate Vercel serverless entrypoint/configuration; the admin app is a separately configured Next.js deployment.
- Environment files and local dependencies/build output are excluded by `.gitignore` and should not be committed.
