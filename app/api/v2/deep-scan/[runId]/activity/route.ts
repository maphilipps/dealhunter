/**
 * GET /api/v2/deep-scan/[runId]/activity
 *
 * Agent endpoint to get the activity log of a Deep Scan run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAgentAuth } from '@/lib/agent-tools';
import { registry } from '@/lib/agent-tools/registry';
import { DEEP_SCAN_TOOL_NAMES } from '@/lib/deep-scan-v2/constants';
import { activityLogEntryTypeEnum } from '@/lib/deep-scan-v2/types';
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

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
    const typesParam = searchParams.get('types');

    // Parse and validate types filter
    let types: (typeof activityLogEntryTypeEnum)[number][] | undefined;
    if (typesParam) {
      const requestedTypes = typesParam.split(',').filter(Boolean);
      const validTypes = activityLogEntryTypeEnum as readonly string[];
      types = requestedTypes.filter(t =>
        validTypes.includes(t)
      ) as (typeof activityLogEntryTypeEnum)[number][];
    }

    const result = await registry.execute(
      DEEP_SCAN_TOOL_NAMES.ACTIVITY,
      { runId, limit, types },
      context
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Deep Scan activity error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAgentAuth(DEEP_SCAN_TOOL_NAMES.ACTIVITY, handler);
