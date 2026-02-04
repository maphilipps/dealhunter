/**
 * GET /api/v2/deep-scan/runs
 *
 * Agent endpoint to list Deep Scan runs with filtering and pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAgentAuth } from '@/lib/agent-tools';
import { registry } from '@/lib/agent-tools/registry';
import { DEEP_SCAN_TOOL_NAMES } from '@/lib/deep-scan-v2/constants';
import { listDeepScansInputSchema } from '@/lib/deep-scan-v2/types';
import type { ToolContext } from '@/lib/agent-tools/types';

async function handler(req: NextRequest, context: ToolContext): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const input = {
      preQualificationId: searchParams.get('preQualificationId') ?? undefined,
      status: searchParams.get('status')?.split(',').filter(Boolean) ?? undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0,
      orderBy: (searchParams.get('orderBy') as 'createdAt' | 'updatedAt' | 'status') ?? 'createdAt',
      orderDir: (searchParams.get('orderDir') as 'asc' | 'desc') ?? 'desc',
    };

    // Validate input
    const parseResult = listDeepScansInputSchema.safeParse(input);
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
    const result = await registry.execute(DEEP_SCAN_TOOL_NAMES.LIST, parseResult.data, context);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Deep Scan list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAgentAuth(DEEP_SCAN_TOOL_NAMES.LIST, handler);
