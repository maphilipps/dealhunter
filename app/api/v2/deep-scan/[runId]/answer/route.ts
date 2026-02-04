/**
 * POST /api/v2/deep-scan/[runId]/answer
 *
 * Agent endpoint to answer a pending question for a Deep Scan in waiting_for_user status.
 * This is the Human-in-the-Loop endpoint that resumes paused scans.
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
    const { answer, reasoning } = body;

    if (!answer || typeof answer !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid answer field' },
        { status: 400 }
      );
    }

    const result = await registry.execute(
      DEEP_SCAN_TOOL_NAMES.ANSWER,
      { runId, answer, reasoning },
      context
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Deep Scan answer error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAgentAuthAndRateLimit(DEEP_SCAN_TOOL_NAMES.ANSWER, handler);
