#!/usr/bin/env bash
#
# Obiren remote release script.
#
# Runs on the deployment host, streamed over SSH by .github/workflows/ci.yml.
# It receives only the apps whose files changed in the push and:
#
#   1. fast-forwards the checkout to origin/main,
#   2. installs and builds those apps (nothing else),
#   3. runs pending API migrations (set RUN_MIGRATIONS=0 to skip),
#   4. reloads only those PM2 processes,
#   5. probes each health endpoint; on any failure it restores the previous
#      revision, rebuilds, restarts and re-probes before exiting non-zero.
#
# Required: a git checkout of the repo at APP_DIR, pm2 on PATH, and the
# deploy/ecosystem.config.cjs manifest. Migrations are forward-only: a
# rollback restores code, not the schema.

set -Eeuo pipefail

APPS="${APPS:-}"
APP_DIR="${APP_DIR:-/srv/obiren}"
BRANCH="${BRANCH:-main}"

HEALTH_RETRIES="${HEALTH_RETRIES:-20}"
HEALTH_DELAY="${HEALTH_DELAY:-2}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-3}"

# A failing service is diagnosed on the spot (pm2 state + last log lines); the
# deploy log is the only place a release engineer can see the host.
DIAG_LINES="${DIAG_LINES:-40}"

# Next.js telemetry is a network call per process start; nothing here needs it.
export NEXT_TELEMETRY_DISABLED=1

# When 1, the API probe also requires {"data":{"status":"ok"}}. Leave unset for
# staging, where missing provider keys intentionally report "degraded".
REQUIRE_STATUS_OK="${REQUIRE_STATUS_OK:-0}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"

# Frontends have no health endpoint by default; set *_HEALTH_URL to enable the
# probe. The API always gets a probe so a broken backend can never sit live.
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:3000/api/v1/health}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-}"
ADMIN_HEALTH_URL="${ADMIN_HEALTH_URL:-}"
DOCTOR_HEALTH_URL="${DOCTOR_HEALTH_URL:-}"

# Set by probe_apps; declared here so `set -u` is safe before the first probe.
PROBE_FAILURES=""

log() { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }

usage_error() {
  echo "APPS must list one or more of: api web admin doctor" >&2
  exit 64
}

app_dir() {
  case "$1" in
    api) echo "apps/api" ;;
    web) echo "apps/web" ;;
    admin) echo "apps/admin" ;;
    doctor) echo "apps/doctor" ;;
    *) return 1 ;;
  esac
}

app_process() {
  case "$1" in
    api) echo "${PM2_API_NAME:-obiren-api}" ;;
    web) echo "${PM2_WEB_NAME:-obiren-web}" ;;
    admin) echo "${PM2_ADMIN_NAME:-obiren-admin}" ;;
    doctor) echo "${PM2_DOCTOR_NAME:-obiren-doctor}" ;;
    *) return 1 ;;
  esac
}

app_health_url() {
  case "$1" in
    api) echo "$API_HEALTH_URL" ;;
    web) echo "$WEB_HEALTH_URL" ;;
    admin) echo "$ADMIN_HEALTH_URL" ;;
    doctor) echo "$DOCTOR_HEALTH_URL" ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------- prerequisites

[ -n "$APPS" ] || usage_error
for app in $APPS; do
  app_dir "$app" >/dev/null || usage_error
done

command -v pm2 >/dev/null || { echo "pm2 is not installed on this host" >&2; exit 69; }
command -v curl >/dev/null || { echo "curl is required for health checks" >&2; exit 69; }

cd "$APP_DIR"
[ -d .git ] || { echo "$APP_DIR is not a git checkout" >&2; exit 65; }
[ -f deploy/ecosystem.config.cjs ] || { echo "deploy/ecosystem.config.cjs is missing from $APP_DIR" >&2; exit 65; }

# Refuse to run two releases at once; a concurrent push waits for the next run.
exec 9>/tmp/obiren-release.lock
if ! flock -n 9; then
  echo "Another release is already running on this host" >&2
  exit 75
fi

PREV_REV="$(git rev-parse HEAD)"
log "Releasing apps:${APPS} (current revision ${PREV_REV:0:12})"

# ------------------------------------------------------------------ build stage

# The lockfile is the only thing that can change the installed tree, so a
# release whose package-lock.json is unchanged reuses node_modules instead of
# paying ~60 s for npm ci on a 1 vCPU host. The stamp lives inside .git so it
# survives `git clean` and can never be committed.
LOCK_STAMP_FILE="$APP_DIR/.git/obiren-deps.sha256"

install_dependencies() {
  local current
  current="$(sha256sum package-lock.json | awk '{print $1}')"
  if [ -d node_modules ] && [ -f "$LOCK_STAMP_FILE" ] && [ "$(cat "$LOCK_STAMP_FILE")" = "$current" ]; then
    echo "==> dependencies already match package-lock.json; skipping npm ci"
    return 0
  fi
  npm ci --include=dev --no-audit --no-fund --prefer-offline
  printf '%s' "$current" > "$LOCK_STAMP_FILE"
}

# `git reset --hard` restores tracked files but never deletes untracked ones, so
# a page or component that was renamed or removed in the repo survives on the
# host. It then either fails the build (stale component props) or ships stale
# code. Clean the trees we are about to build; ignored files - every `.env`,
# `node_modules` and `.next` - are kept because -x is deliberately not used.
clean_checkout() {
  local dirs=() app
  for app in $APPS; do dirs+=("$(app_dir "$app")"); done
  dirs+=("packages")
  log "Removing untracked leftovers from: ${dirs[*]}"
  git clean -fd -- "${dirs[@]}"
}

# Next.js bakes `rewrites()` into .next/routes-manifest.json at build time, and
# that is what proxies the browser's `/api/v1/*` calls. Building without this
# variable bakes the dev default `http://localhost:3000`, which on this host is
# an unrelated service: every sign-in then fails with a 500 while the pages
# themselves still return 200. The API is always on loopback port 3020 here;
# override API_PROXY_TARGET only if a host really differs.
export API_PROXY_TARGET="${API_PROXY_TARGET:-http://127.0.0.1:3020}"

build_apps() {
  for app in $APPS; do
    log "Building ${app} ($(app_dir "$app"))"
    npm --prefix "$(app_dir "$app")" run build
  done
}

# `pm2 startOrReload` only refreshes the environment of an app that already
# exists: it keeps the script, args and cwd the process was first created with.
# A process born from an older checkout therefore keeps starting from a path
# that no longer exists (or with a hard-coded `-p 3002`) and crash-loops while a
# freshly created app comes up fine. Deleting first makes the manifest in this
# revision - cwd, args, PORT - authoritative on every release. Downtime is the
# same restart the deploy already performed.
reload_apps() {
  for app in $APPS; do
    local name
    name="$(app_process "$app")"
    log "Restarting ${app} (pm2: ${name})"
    pm2 delete "$name" >/dev/null 2>&1 || true
    if ! pm2 start deploy/ecosystem.config.cjs --only "$name" --update-env; then
      warn "pm2 could not start ${name}"
      diagnose_app "$app"
      exit 1
    fi
  done
  pm2 save >/dev/null 2>&1 || warn "pm2 save failed; process list will not survive a reboot"
}

# Print why an app is not serving: its pm2 definition (cwd/args/PORT) and the
# tail of its own log. Without this a failed health check only says "HTTP 000".
diagnose_app() {
  local app="$1" name
  name="$(app_process "$app")"
  warn "${app} is not healthy - pm2 state and last ${DIAG_LINES} log lines follow"
  {
    pm2 describe "$name"
    pm2 logs "$name" --lines "$DIAG_LINES" --nostream
  } 2>&1 >&2 || warn "could not read pm2 state for ${name}"
}

# ----------------------------------------------------------------- health check

check_health() {
  local url="$1" attempt code body
  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
    body="$(mktemp)"
    code="$(curl -sS -o "$body" -w '%{http_code}' --max-time "$HEALTH_TIMEOUT" "$url" 2>/dev/null || true)"

    if [ "$code" = "200" ]; then
      if [ "$REQUIRE_STATUS_OK" = "1" ] && ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "$body"; then
        echo "    ${attempt}/${HEALTH_RETRIES}: HTTP 200 but status is not \"ok\""
      else
        if grep -Eq '"status"[[:space:]]*:[[:space:]]*"degraded"' "$body"; then
          warn "$url reports a degraded configuration (missing provider keys)"
        fi
        rm -f "$body"
        echo "    healthy: $url"
        return 0
      fi
    else
      echo "    ${attempt}/${HEALTH_RETRIES}: HTTP ${code:-no response}"
    fi

    rm -f "$body"
    # No pointless final wait before reporting failure.
    if [ "$attempt" -lt "$HEALTH_RETRIES" ]; then
      sleep "$HEALTH_DELAY"
    fi
  done

  echo "    UNHEALTHY: $url"
  return 1
}

# The API health path every frontend proxies. Derived from the app's own health
# URL so a host that moves ports only has to change one variable.
proxy_health_url() {
  local app="$1" url scheme rest host
  case "$app" in
    web | admin | doctor) ;;
    *) return 0 ;;
  esac
  url="$(app_health_url "$app")"
  [ -n "$url" ] || return 0
  scheme="${url%%://*}"
  rest="${url#*://}"
  host="${rest%%/*}"
  [ -n "$host" ] || return 0
  echo "${scheme}://${host}/api/v1/health"
}

# One app: its page, then - because the page is prerendered and stays 200 even
# when the proxy is broken - the /api/v1 rewrite to the API.
probe_one_app() {
  local app="$1" url proxy rc=0
  url="$(app_health_url "$app")"
  check_health "$url" || rc=1

  if [ "$rc" -eq 0 ]; then
    proxy="$(proxy_health_url "$app")"
    if [ -n "$proxy" ]; then
      echo "    also checking the /api/v1 rewrite baked into this build"
      check_health "$proxy" || rc=1
    fi
  fi

  return "$rc"
}

# Probing every app one after another serialised the worst case: three apps x
# 20 attempts x (probe + delay) is minutes of waiting for services that boot in
# about two seconds. Each probe keeps its own output, so interleaved runs still
# print a readable report per app.
#
# Results go in PROBE_FAILURES, never stdout: the per-app report is streamed to
# stderr so a caller that captures stdout cannot mistake "healthy" for a
# failure (which made a perfectly good release roll itself back).
probe_apps() {
  local app url workdir pid
  local pids=()
  workdir="$(mktemp -d)"
  PROBE_FAILURES=""

  for app in $APPS; do
    url="$(app_health_url "$app")"
    if [ -z "$url" ]; then
      warn "no health URL configured for ${app}; skipping probe"
      continue
    fi
    log "Health check: ${app} -> ${url}" >&2
    (
      probe_one_app "$app" >"${workdir}/${app}.log" 2>&1
      echo "$?" >"${workdir}/${app}.status"
    ) &
    pids+=("$!")
  done

  for pid in "${pids[@]:-}"; do
    [ -n "$pid" ] || continue
    wait "$pid" || true
  done

  for app in $APPS; do
    [ -f "${workdir}/${app}.log" ] || continue
    sed "s/^/  /" "${workdir}/${app}.log" >&2
    if [ "$(cat "${workdir}/${app}.status" 2>/dev/null)" != "0" ]; then
      PROBE_FAILURES="${PROBE_FAILURES} ${app}"
      diagnose_app "$app"
    fi
  done

  rm -rf "$workdir"
  PROBE_FAILURES="$(echo "${PROBE_FAILURES}" | xargs)"
}

# -------------------------------------------------------------------- rollback

rollback() {
  local prev="$1" failed="$2"
  warn "Health check failed for:${failed} - rolling back to ${prev:0:12}"

  git reset --hard "$prev"
  clean_checkout
  install_dependencies
  build_apps
  reload_apps

  local still_failing
  probe_apps
  still_failing="$PROBE_FAILURES"
  if [ -n "$still_failing" ]; then
    warn "Rollback to ${prev:0:12} completed, but these apps are still failing health checks:${still_failing}"
    warn "The host needs attention (service logs, configuration, database)."
  else
    echo "Rollback complete: ${prev:0:12} is healthy again."
  fi
  warn "Migrations are forward-only; the database schema was not reverted."
  exit 1
}

# --------------------------------------------------------------- release stage

log "Fetching origin/${BRANCH}"
git fetch --prune origin "$BRANCH"
git checkout --force "$BRANCH"
git reset --hard "origin/$BRANCH"
NEW_REV="$(git rev-parse HEAD)"
echo "New revision: ${NEW_REV:0:12}"

clean_checkout
install_dependencies
build_apps

if echo " ${APPS} " | grep -q " api "; then
  if [ "$RUN_MIGRATIONS" = "1" ]; then
    log "Running API migrations"
    npm --prefix apps/api run migrate
  else
    warn "RUN_MIGRATIONS=0: skipping migrations"
  fi
fi

reload_apps

log "Verifying health"
probe_apps
if [ -n "$PROBE_FAILURES" ]; then
  rollback "$PREV_REV" "$PROBE_FAILURES"
fi

log "Release ${NEW_REV:0:12} is live for:${APPS}"
