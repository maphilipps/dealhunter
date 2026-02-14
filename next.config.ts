import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@slack/bolt', 'pdfjs-dist'],
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb', // Allow many files (16+ PDFs up to 10 MB each)
    },
    proxyClientMaxBodySize: 200 * 1024 * 1024, // 200MB — must match serverActions.bodySizeLimit
  },
  async headers() {
    return [
      {
        // Override stale 301 browser cache from removed permanent redirect (qualifications->pitches).
        // Browsers cache 301s indefinitely. This header ensures fresh requests on next visit.
        // TODO: Remove after all users have visited once (mid-March 2026)
        source: '/qualifications/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
        ],
      },
    ];
  },
};

export default withSentryConfig(withWorkflow(withBotId(nextConfig)), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'marc-philipps',

  project: 'qualifier',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
