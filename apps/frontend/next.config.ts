import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default withSentryConfig(nextConfig, {
  org: "ventia",
  project: "ventia-frontend",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
