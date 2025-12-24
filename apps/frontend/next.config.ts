import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",

  // Experimental features
  experimental: {
    // Enable server actions if needed
  },
};

export default nextConfig;
