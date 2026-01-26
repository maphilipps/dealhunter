import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming Extraction activity
 * Best practice: Use native Web Streams for real-time updates
 * Security: Requires authentication and bid ownership verification
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // 1. Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await context.params;

  return new Response(
    JSON.stringify({
      error: 'Deprecated endpoint',
      hint: `Use /api/pre-qualifications/${id}/processing-status for background progress`,
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
