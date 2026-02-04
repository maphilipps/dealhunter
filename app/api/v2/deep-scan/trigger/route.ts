/**
 * POST /api/v2/deep-scan/trigger
 *
 * Agent endpoint to trigger a new Deep Scan run.
 * Validates input, creates run record, and returns runId.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAgentAuthAndRateLimit } from '@/lib/agent-tools';
import { registry } from '@/lib/agent-tools/registry';
import { DEEP_SCAN_TOOL_NAMES } from '@/lib/deep-scan-v2/constants';
import { triggerDeepScanInputSchema } from '@/lib/deep-scan-v2/types';
import type { ToolContext } from '@/lib/agent-tools/types';

async function handler(req: NextRequest, context: ToolContext): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { context: _ctx, ...input } = body;

    // Validate input
    const parseResult = triggerDeepScanInputSchema.safeParse(input);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid input: ${parseResult.error.message}`,
        },
        { status: 400 }
      );
    }

    // Execute the tool
    const result = await registry.execute<{ runId: string }>(
      DEEP_SCAN_TOOL_NAMES.TRIGGER,
      parseResult.data,
      context
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Deep Scan trigger error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export const POST = withAgentAuthAndRateLimit(DEEP_SCAN_TOOL_NAMES.TRIGGER, handler);
