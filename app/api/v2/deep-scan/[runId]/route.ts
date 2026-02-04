/**
 * GET /api/v2/deep-scan/[runId]
 * DELETE /api/v2/deep-scan/[runId]
 *
 * Agent endpoints for getting status and deleting a Deep Scan run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAgentAuth } from '@/lib/agent-tools';
import { registry } from '@/lib/agent-tools/registry';
import { DEEP_SCAN_TOOL_NAMES } from '@/lib/deep-scan-v2/constants';
import type { ToolContext } from '@/lib/agent-tools/types';

// GET - Get run status
async function getHandler(
  _req: NextRequest,
  context: ToolContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  try {
    const runId = params?.runId;
    if (!runId) {
      return NextResponse.json({ success: false, error: 'Missing runId' }, { status: 400 });
    }

    const result = await registry.execute(DEEP_SCAN_TOOL_NAMES.STATUS, { runId }, context);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Deep Scan status error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete run
async function deleteHandler(
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
    const deleteDocuments = searchParams.get('deleteDocuments') !== 'false';

    const result = await registry.execute(
      DEEP_SCAN_TOOL_NAMES.DELETE,
      { runId, deleteDocuments },
      context
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Deep Scan delete error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAgentAuth(DEEP_SCAN_TOOL_NAMES.STATUS, getHandler);
export const DELETE = withAgentAuth(DEEP_SCAN_TOOL_NAMES.DELETE, deleteHandler);
