import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@slack/bolt',
    'better-sqlite3',
    'sqlite-vec',
    'sqlite-vec-darwin-arm64',
  ],
};

export default withWorkflow(withBotId(nextConfig));
