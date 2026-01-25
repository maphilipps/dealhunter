import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  serverExternalPackages: [
    '@slack/bolt',
    'better-sqlite3',
    'sqlite-vec',
    'sqlite-vec-darwin-arm64',
    'sqlite-vec-linux-arm64',
    'sqlite-vec-linux-x64',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb', // Allow multiple PDFs up to 10 MB each
    },
  },
};

export default withWorkflow(withBotId(nextConfig));
