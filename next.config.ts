/**
 * Next.js Configuration
 * @description Configures remote image domains (LinkedIn CDN, Logo.dev),
 * and security headers (X-Frame-Options, X-Content-Type-Options,
 * Referrer-Policy, X-XSS-Protection) applied to all routes.
 * @module next.config
 */

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/** @type {NextConfig} */
const nextConfig: NextConfig = {
  // PostHog endpoints use trailing slashes (e.g. /e/) — prevent Next.js from stripping them
  skipTrailingSlashRedirect: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.licdn.com",
      },
      {
        protocol: "https",
        hostname: "img.logo.dev",
      },
      {
        protocol: "https",
        hostname: "unavatar.io",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://us.posthog.com https://*.posthog.com",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "chainlinked",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
