import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 11 staging is self-hosted on the CVM behind loopback-only Nginx.
  // Vinext emits a self-contained Node runtime under dist/standalone so the
  // portal container does not need source files or development dependencies.
  output: "standalone",
};

export default nextConfig;
