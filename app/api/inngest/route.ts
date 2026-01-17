import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { deepAnalysisFunction } from '@/lib/inngest/functions/deep-analysis';

/**
 * Inngest webhook endpoint with signature verification
 *
 * Security Architecture (Defense in Depth):
 * - This endpoint is exempt from middleware auth (it's called by Inngest service, not users)
 * - Signature verification (INNGEST_SIGNING_KEY) prevents unauthorized external webhook calls
 * - User access control happens at trigger endpoints (e.g., /api/bids/[id]/deep-analysis/trigger)
 * - Trigger endpoints verify authentication and bid ownership before sending events to Inngest
 * - Therefore, this webhook only processes pre-authorized events
 *
 * Why this design is secure:
 * 1. Users cannot directly call this webhook (signature verification blocks them)
 * 2. Users can only trigger jobs for bids they own (verified at trigger endpoint)
 * 3. Inngest service can only execute jobs for events sent by our trigger endpoints
 * 4. This separates concerns: user auth at UI layer, service auth at webhook layer
 *
 * Setup:
 * 1. Get signing key from Inngest dashboard: https://app.inngest.com/env/[your-env]/manage/signing-key
 * 2. Add INNGEST_SIGNING_KEY to your .env.local file
 * 3. Restart dev server
 *
 * Production: Ensure INNGEST_SIGNING_KEY is set in your production environment
 *
 * @see https://www.inngest.com/docs/security/webhook-signatures
 * @see /app/api/bids/[id]/deep-analysis/trigger/route.ts for user access control
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [deepAnalysisFunction],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
