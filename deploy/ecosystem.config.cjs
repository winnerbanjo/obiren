/**
 * PM2 process manifest for the Obiren server deployment.
 *
 * The release script reloads only the processes whose app changed, so the
 * names here must stay in sync with scripts/deploy/remote-release.sh.
 * Ports can be overridden per host via the environment.
 */
const path = require("node:path");

function app(name, directory, port) {
  return {
    name,
    cwd: path.join(__dirname, "..", directory),
    script: "npm",
    args: "start",
    env: {
      NODE_ENV: "production",
      PORT: String(port),
      // Runtime half of the /api/v1 rewrite: Next bakes the destination at
      // build time, but server routes read this at request time. Both default
      // to the loopback API, never the dev default of localhost:3000.
      API_PROXY_TARGET: process.env.API_PROXY_TARGET || "http://127.0.0.1:3020",
    },
    // A crash loop should not hammer the host; pm2 keeps the last exit state.
    max_restarts: 10,
    restart_delay: 3000,
    // Give the API time to connect to MongoDB before pm2 counts a slow start
    // as a failure.
    min_uptime: "20s",
    kill_timeout: 15000,
  };
}

// The defaults are the ports Caddy proxies to on the server (see
// docs/DEPLOYMENT.md). They are deliberately explicit: `pm2 startOrReload ...
// --update-env` re-reads this file, so a release must not depend on the deploy
// shell exporting API_PORT/DOCTOR_PORT.
//
// The Obiren droplet is shared with the Kubernetes-hosted kuipid services,
// which already listen on 3000-3003. Obiren therefore owns 3020-3022; the last
// deploy that used 3002/3003 could never bind and both hosts served nothing.
module.exports = {
  apps: [
    app(process.env.PM2_API_NAME || "obiren-api", "apps/api", process.env.API_PORT || 3020),
    app(process.env.PM2_WEB_NAME || "obiren-web", "apps/web", process.env.WEB_PORT || 3100),
    app(process.env.PM2_ADMIN_NAME || "obiren-admin", "apps/admin", process.env.ADMIN_PORT || 3021),
    app(process.env.PM2_DOCTOR_NAME || "obiren-doctor", "apps/doctor", process.env.DOCTOR_PORT || 3022),
  ],
};
