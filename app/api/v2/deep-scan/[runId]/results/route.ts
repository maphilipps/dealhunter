/**
 * GET /api/v2/deep-scan/[runId]/results
 *
 * Agent endpoint to get comprehensive results of a Deep Scan run.
 * Returns audit results, analysis, documents, and provenance data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAgentAuth } from '@/lib/agent-tools';
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

    const { searchParams } = new URL(req.url);
    const includeDocuments = searchParams.get('includeDocuments') !== 'false';
    const includeProvenance = searchParams.get('includeProvenance') !== 'false';

    const result = await registry.execute(
      DEEP_SCAN_TOOL_NAMES.RESULT,
      { runId, includeDocuments, includeProvenance },
      context
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Deep Scan results error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAgentAuth(DEEP_SCAN_TOOL_NAMES.RESULT, handler);
