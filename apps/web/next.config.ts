import type { NextConfig } from "next";

// The internal console is served by `apps/admin` on its own host. Typing
// `/user` on the public site is a common habit, so send it to the console
// instead of a bare 404. `ADMIN_APP_URL` matches the variable the API's
// account seeder already uses; the console is not linked anywhere public.
const ADMIN_APP_URL = (
  process.env.ADMIN_APP_URL ||
  (process.env.NODE_ENV === "production" ? "https://admin.obiren.co" : "http://localhost:3002")
).replace(/\/+$/, "");

// The API sets these through Helmet; the frontends are served by Next's own
// server, so without them the public pages have no HSTS and can be framed.
// A CSP is deliberately absent: the App Router ships inline bootstrap scripts,
// so a policy needs nonces and its own change.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/user",
        destination: `${ADMIN_APP_URL}/user`,
        permanent: false,
      },
      {
        source: "/user/:path*",
        destination: `${ADMIN_APP_URL}/user`,
        permanent: false,
      },
    ];
  },
  async rewrites() {
    // In production the API always runs beside the frontend on port 3020. Falling
    // back to localhost:3000 there silently sent every /api/v1 call to whatever
    // unrelated service owns that port, so the fallback must be the real target.
    const api =
      process.env.API_PROXY_TARGET ||
      (process.env.NODE_ENV === "production" ? "http://127.0.0.1:3020" : "http://localhost:3000");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${api}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
