import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  serverExternalPackages: ['@slack/bolt'],
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb', // Allow multiple PDFs up to 10 MB each
    },
  },
};

export default withWorkflow(withBotId(nextConfig));
