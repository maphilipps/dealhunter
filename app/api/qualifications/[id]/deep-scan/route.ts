/**
 * Deep Scan API Endpoint (DEA-145)
 *
 * POST /api/qualifications/[id]/deep-scan
 * - Manually trigger deep scan for a lead
 * - Re-trigger if needed (overwrites previous results)
 *
 * GET /api/qualifications/[id]/deep-scan
 * - Get current deep scan progress
 */

import { NextRequest, NextResponse } from 'next/server';

import { getDeepScanProgress } from '@/lib/agents/deep-scan-orchestrator';
import { auth } from '@/lib/auth';

/**
 * GET /api/qualifications/[id]/deep-scan
 * Get current deep scan progress
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await props.params;
    const leadId = params.id;

    // Get progress
    const progress = await getDeepScanProgress(leadId);

    if (!progress) {
      return NextResponse.json({ error: 'Deep scan not started' }, { status: 404 });
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('[Deep Scan API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get deep scan progress' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/qualifications/[id]/deep-scan
 * Deprecated: Use /api/qualifications/[id]/deep-scan/start to run in background
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await props.params;
  const leadId = params.id;

  return NextResponse.json(
    {
      error: 'Deprecated endpoint',
      hint: `Use /api/qualifications/${leadId}/deep-scan/start for background processing`,
    },
    { status: 410 }
  );
}
