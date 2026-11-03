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
HEALTH_DELAY="${HEALTH_DELAY:-3}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-5}"

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

install_dependencies() {
  npm ci --include=dev --no-audit --no-fund
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

build_apps() {
  for app in $APPS; do
    log "Building ${app} ($(app_dir "$app"))"
    npm --prefix "$(app_dir "$app")" run build
  done
}

reload_apps() {
  for app in $APPS; do
    log "Reloading ${app} (pm2: $(app_process "$app"))"
    pm2 startOrReload deploy/ecosystem.config.cjs --only "$(app_process "$app")" --update-env
  done
  pm2 save >/dev/null 2>&1 || warn "pm2 save failed; process list will not survive a reboot"
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
    sleep "$HEALTH_DELAY"
  done

  echo "    UNHEALTHY: $url" >&2
  return 1
}

probe_apps() {
  local app url failures=""
  for app in $APPS; do
    url="$(app_health_url "$app")"
    if [ -z "$url" ]; then
      warn "no health URL configured for ${app}; skipping probe"
      continue
    fi
    log "Health check: ${app} -> ${url}"
    if ! check_health "$url"; then
      failures="${failures} ${app}"
    fi
  done
  echo "$failures" | xargs
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
  still_failing="$(probe_apps)"
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
FAILED="$(probe_apps)"
if [ -n "$FAILED" ]; then
  rollback "$PREV_REV" "$FAILED"
fi

log "Release ${NEW_REV:0:12} is live for:${APPS}"
