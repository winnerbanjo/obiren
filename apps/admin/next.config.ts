import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@obiren/types",
    "@obiren/health-engine",
    "@obiren/localization",
    "@obiren/permissions",
    "@obiren/validation",
    "@obiren/ui",
  ],
};

export default nextConfig;
