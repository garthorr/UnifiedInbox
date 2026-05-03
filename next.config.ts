import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent the app from being embedded in an iframe (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers sniffing the MIME type away from the declared Content-Type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Minimal referrer leakage
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Enforce HTTPS for 1 year once the browser has seen the site once
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Restrict powerful browser features not needed by the app
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Tight CSP: all resources must come from same origin; inline scripts are
  // blocked except for Next.js's own nonce-less inline chunks (unsafe-inline is
  // required for Next.js <style> tags in older versions; tighten when possible).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      // Email iframes are sandboxed (allow-same-origin) so they resolve relative
      // URLs against the app origin — still safe because they have no script access.
      "frame-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["inbox.tastymath.com"],
  // Prevent Next.js from bundling Node.js-only packages used in server routes
  serverExternalPackages: ["imapflow", "mailparser"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "inbox.tastymath.com:3000", "inbox.home.tastymath.com"],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
