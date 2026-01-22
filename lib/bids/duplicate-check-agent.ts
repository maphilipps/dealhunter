import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import { checkForDuplicates, type DuplicateCheckResult } from './duplicate-check';

import { openai } from '@/lib/ai/providers';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

/**
 * Duplicate Check Agent
 *
 * Vercel AI SDK wrapper for duplicate detection with structured output
 */

/**
 * Zod schema for duplicate check agent output
 */
export const DuplicateCheckAgentOutputSchema = z.object({
  hasDuplicates: z.boolean().describe('Whether duplicates were found'),
  confidence: z.number().min(0).max(100).describe('Confidence score (0-100)'),
  recommendation: z
    .enum(['merge', 'manual_review', 'create_new'])
    .describe(
      'Recommended action: merge (>90% similarity), manual_review (70-90%), create_new (<70%)'
    ),
  reasoning: z.string().describe('Explanation of the decision'),
  exactMatches: z.array(
    z.object({
      rfpId: z.string(),
      customerName: z.string(),
      reason: z.string(),
      websiteUrl: z.string().optional(),
      submissionDeadline: z.string().optional(),
    })
  ),
  similarMatches: z.array(
    z.object({
      rfpId: z.string(),
      customerName: z.string(),
      similarity: z.number().min(0).max(100),
      reason: z.string(),
      websiteUrl: z.string().optional(),
      submissionDeadline: z.string().optional(),
    })
  ),
});

export type DuplicateCheckAgentOutput = z.infer<typeof DuplicateCheckAgentOutputSchema>;

/**
 * Run duplicate check with AI-enhanced decision making
 *
 * This agent combines multiple duplicate detection strategies and uses AI
 * to provide a structured recommendation with reasoning.
 */
export async function runDuplicateCheckAgent(params: {
  extractedRequirements: ExtractedRequirements;
  accountId?: string;
  excludeRfpId?: string;
}): Promise<DuplicateCheckAgentOutput> {
  const { extractedRequirements, accountId, excludeRfpId } = params;

  // Run duplicate check with all strategies (fuzzy matching + semantic similarity)
  const duplicateResult: DuplicateCheckResult = await checkForDuplicates(
    extractedRequirements,
    accountId,
    excludeRfpId
  );

  // If no duplicates found, return early
  if (!duplicateResult.hasDuplicates) {
    return {
      hasDuplicates: false,
      confidence: 100,
      recommendation: 'create_new',
      reasoning: 'Keine Duplikate gefunden. RFP kann als neu angelegt werden.',
      exactMatches: [],
      similarMatches: [],
    };
  }

  // Calculate highest similarity
  const highestSimilarity = Math.max(...duplicateResult.similarMatches.map(m => m.similarity), 0);

  // Use AI to analyze duplicate result and provide structured recommendation
  const result = await generateObject({
    model: openai('claude-haiku-4.5') as unknown as LanguageModel,
    schema: DuplicateCheckAgentOutputSchema,
    prompt: `
Du bist ein Duplicate Detection Agent. Analysiere die gefundenen Duplikate und gib eine strukturierte Empfehlung.

**Neuer RFP:**
- Kunde: ${extractedRequirements.customerName || 'Unbekannt'}
- Projekt: ${extractedRequirements.projectName || 'Unbekannt'}
- Beschreibung: ${extractedRequirements.projectDescription || 'Keine Beschreibung'}
- Website: ${extractedRequirements.websiteUrl || 'Nicht angegeben'}

**Gefundene Duplikate:**

Exakte Matches (${duplicateResult.exactMatches.length}):
${duplicateResult.exactMatches.map(m => `- ${m.customerName} (${m.reason})`).join('\n') || 'Keine'}

Ähnliche Matches (${duplicateResult.similarMatches.length}):
${duplicateResult.similarMatches.map(m => `- ${m.customerName} (${m.similarity}%: ${m.reason})`).join('\n') || 'Keine'}

**Entscheidungsregeln:**
- > 90% Similarity: "merge" (automatisch zusammenführen)
- 70-90% Similarity: "manual_review" (manuelle Prüfung)
- < 70% Similarity: "create_new" (neuer RFP)

Analysiere die Matches und gib eine Empfehlung mit Begründung.
    `.trim(),
    temperature: 0.3,
  });

  return result.object;
}
