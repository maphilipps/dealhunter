import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { runDuplicateCheckAgent } from '@/lib/bids/duplicate-check-agent';
import { extractedRequirementsSchema } from '@/lib/extraction/schema';

/**
 * POST /api/pre-qualifications/duplicate-check
 *
 * Check for duplicate Pre-Qualifications using AI-powered duplicate detection
 */

const DuplicateCheckRequestSchema = z.object({
  extractedRequirements: extractedRequirementsSchema,
  accountId: z.string().optional(),
  excludeRfpId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = (await request.json()) as unknown;
    const parsed = DuplicateCheckRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { extractedRequirements, accountId, excludeRfpId } = parsed.data;

    // Run duplicate check agent
    const result = await runDuplicateCheckAgent({
      extractedRequirements,
      accountId: accountId ?? undefined,
      excludeRfpId: excludeRfpId ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Duplicate Check API] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
