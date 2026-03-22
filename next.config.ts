import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["inbox.tastymath.com"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "inbox.tastymath.com:3000"],
    },
  },
};

export default nextConfig;
