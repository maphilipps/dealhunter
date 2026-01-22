'use server';

import { z } from 'zod';

import { performWebResearch, type WebResearchResponse } from './web-research-service';

import { auth } from '@/lib/auth';

/**
 * Server Action: Trigger web research for a lead section
 *
 * This action:
 * 1. Validates authentication
 * 2. Validates input parameters
 * 3. Triggers web research
 * 4. Returns results
 *
 * Used by Section Page Template when confidence is low.
 */

const TriggerWebResearchSchema = z.object({
  rfpId: z.string().min(1, 'RFP ID is required'),
  leadId: z.string().min(1, 'Lead ID is required'),
  sectionId: z.string().min(1, 'Section ID is required'),
  question: z.string().min(1, 'Research question is required'),
  maxResults: z.number().int().min(1).max(10).optional(),
});

export type TriggerWebResearchInput = z.infer<typeof TriggerWebResearchSchema>;

export async function triggerWebResearch(
  input: TriggerWebResearchInput
): Promise<WebResearchResponse> {
  // 1. Check authentication
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      results: [],
      chunksStored: 0,
      error: 'Not authenticated',
    };
  }

  // 2. Validate input
  const validation = TriggerWebResearchSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      results: [],
      chunksStored: 0,
      error: validation.error.issues[0].message,
    };
  }

  const { rfpId, sectionId, question, maxResults } = validation.data;

  // 3. Perform web research
  try {
    const result = await performWebResearch({
      rfpId,
      sectionId,
      question,
      maxResults,
    });

    return result;
  } catch (error) {
    console.error('[ACTION] Web research failed:', error);
    return {
      success: false,
      results: [],
      chunksStored: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
