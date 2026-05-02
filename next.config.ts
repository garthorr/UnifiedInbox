import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["inbox.tastymath.com"],
  // Prevent Next.js from bundling Node.js-only packages used in server routes
  serverExternalPackages: ["imapflow", "mailparser"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "inbox.tastymath.com:3000"],
    },
  },
};

export default nextConfig;
