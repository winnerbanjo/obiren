import type { NextConfig } from "next";

// The internal console is served by `apps/admin` on its own host. Typing
// `/user` on the public site is a common habit, so send it to the console
// instead of a bare 404. `ADMIN_APP_URL` matches the variable the API's
// account seeder already uses; the console is not linked anywhere public.
const ADMIN_APP_URL = (
  process.env.ADMIN_APP_URL ||
  (process.env.NODE_ENV === "production" ? "https://admin.obiren.co" : "http://localhost:3002")
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
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
    const api = process.env.API_PROXY_TARGET || "http://localhost:3000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${api}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
