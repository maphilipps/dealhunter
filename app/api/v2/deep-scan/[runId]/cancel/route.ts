/**
 * POST /api/v2/deep-scan/[runId]/cancel
 *
 * Agent endpoint to cancel a running Deep Scan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAgentAuthAndRateLimit } from '@/lib/agent-tools';
import { registry } from '@/lib/agent-tools/registry';
import { DEEP_SCAN_TOOL_NAMES } from '@/lib/deep-scan-v2/constants';
import type { ToolContext } from '@/lib/agent-tools/types';

async function handler(
  req: NextRequest,
  context: ToolContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  try {
    const runId = params?.runId;
    if (!runId) {
      return NextResponse.json({ success: false, error: 'Missing runId' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason;

    const result = await registry.execute(DEEP_SCAN_TOOL_NAMES.CANCEL, { runId, reason }, context);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Deep Scan cancel error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAgentAuthAndRateLimit(DEEP_SCAN_TOOL_NAMES.CANCEL, handler);
