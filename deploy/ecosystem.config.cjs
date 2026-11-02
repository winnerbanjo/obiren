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

module.exports = {
  apps: [
    app(process.env.PM2_API_NAME || "obiren-api", "apps/api", process.env.API_PORT || 3000),
    app(process.env.PM2_WEB_NAME || "obiren-web", "apps/web", process.env.WEB_PORT || 3100),
    app(process.env.PM2_ADMIN_NAME || "obiren-admin", "apps/admin", process.env.ADMIN_PORT || 3030),
    app(process.env.PM2_DOCTOR_NAME || "obiren-doctor", "apps/doctor", process.env.DOCTOR_PORT || 3020),
  ],
};
