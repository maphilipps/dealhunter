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

import { runDeepScan, getDeepScanProgress } from '@/lib/agents/deep-scan-orchestrator';
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
 * Trigger deep scan for a lead
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await props.params;
    const leadId = params.id;

    // Run deep scan (async, but we wait for completion for now)
    // TODO: In production, this should be a background job
    const progress = await runDeepScan(leadId);

    return NextResponse.json({
      message: 'Deep scan completed',
      progress,
    });
  } catch (error) {
    console.error('[Deep Scan API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run deep scan' },
      { status: 500 }
    );
  }
}
