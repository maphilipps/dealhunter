/**
 * Dashboard Summary Agent
 *
 * Generates Top-3 Key Facts (highlights) for each dashboard section.
 * Called at the end of the qualification process after all expert agents have completed.
 * Results are cached in dealEmbeddings with chunkType='dashboard_highlight'.
 */

import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { DASHBOARD_SECTIONS } from '@/lib/dashboard/sections';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { queryRAG } from '@/lib/rag/retrieval-service';

/**
 * Schema for generated highlights
 */
const SectionHighlightsSchema = z.object({
  highlights: z
    .array(z.string().max(150))
    .max(3)
    .describe('Top 3 most important facts for this section'),
  hasContent: z.boolean().describe('Whether relevant content was found'),
});

/**
 * Generate highlights for a single section
 */
async function generateSectionHighlights(
  preQualificationId: string,
  sectionId: string,
  sectionTitle: string,
  ragQuery: string
): Promise<{ highlights: string[]; confidence: number }> {
  try {
    // Query RAG for relevant content
    const ragResults = await queryRAG({
      preQualificationId,
      question: ragQuery,
      maxResults: 8,
    });

    if (ragResults.length === 0) {
      return { highlights: [], confidence: 0 };
    }

    // Build context from RAG results
    const context = ragResults.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');

    // Calculate confidence from similarity scores
    const avgSimilarity = ragResults.reduce((sum, r) => sum + r.similarity, 0) / ragResults.length;
    const confidence = Math.round(avgSimilarity * 100);

    // Generate highlights using AI
    const result = await generateStructuredOutput({
      model: 'quality',
      schema: SectionHighlightsSchema,
      system: `Du bist ein Analyst für Ausschreibungsdokumente.
Extrahiere die 3 wichtigsten Fakten für den Bereich "${sectionTitle}" aus dem gegebenen Kontext.

Regeln:
- Maximal 3 Bullet Points
- Jeder Punkt maximal 100 Zeichen
- Nur konkrete, relevante Fakten
- Keine Vermutungen oder Spekulationen
- Wenn keine relevanten Informationen vorhanden sind, setze hasContent auf false
- Sprache: Deutsch
- Format: Kurz, prägnant, informativ`,
      prompt: `Extrahiere die Top-3 Key Facts für "${sectionTitle}" aus diesem Kontext:\n\n${context}`,
      temperature: 0.2,
    });

    if (!result.hasContent || result.highlights.length === 0) {
      return { highlights: [], confidence: 0 };
    }

    return { highlights: result.highlights, confidence };
  } catch (error) {
    console.error(`[DashboardSummaryAgent] Error for section ${sectionId}:`, error);
    return { highlights: [], confidence: 0 };
  }
}

/**
 * Store highlights in dealEmbeddings
 */
async function storeHighlights(
  preQualificationId: string,
  sectionId: string,
  highlights: string[],
  confidence: number
): Promise<void> {
  // Delete existing highlights for this section
  await db
    .delete(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        eq(dealEmbeddings.chunkType, 'dashboard_highlight'),
        eq(dealEmbeddings.agentName, `dashboard_${sectionId}`)
      )
    );

  // Only store if we have highlights
  if (highlights.length === 0) {
    return;
  }

  // Insert new highlights
  await db.insert(dealEmbeddings).values({
    preQualificationId,
    agentName: `dashboard_${sectionId}`,
    chunkType: 'dashboard_highlight',
    chunkIndex: 0,
    content: JSON.stringify(highlights),
    metadata: JSON.stringify({ sectionId }),
    confidence,
    chunkCategory: 'elaboration',
  });
}

export interface DashboardSummaryResult {
  success: boolean;
  sectionsProcessed: number;
  sectionsWithHighlights: number;
  errors: string[];
}

/**
 * Run the Dashboard Summary Agent
 *
 * Generates Top-3 Key Facts for all dashboard sections in parallel.
 * Should be called after all expert agents have completed.
 */
export async function runDashboardSummaryAgent(
  preQualificationId: string
): Promise<DashboardSummaryResult> {
  console.error(`[DashboardSummaryAgent] Starting for ${preQualificationId}`);

  // Generate highlights for all sections in parallel
  const results = await Promise.allSettled(
    DASHBOARD_SECTIONS.map(async section => {
      const { highlights, confidence } = await generateSectionHighlights(
        preQualificationId,
        section.id,
        section.title,
        section.ragQuery
      );
      await storeHighlights(preQualificationId, section.id, highlights, confidence);
      return { sectionId: section.id, highlights, confidence };
    })
  );

  // Aggregate results
  const errors: string[] = [];
  let sectionsProcessed = 0;
  let sectionsWithHighlights = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      sectionsProcessed++;
      if (result.value.highlights.length > 0) {
        sectionsWithHighlights++;
        console.error(
          `[DashboardSummaryAgent] ${result.value.sectionId}: ${result.value.highlights.length} highlights (${result.value.confidence}%)`
        );
      } else {
        console.error(`[DashboardSummaryAgent] ${result.value.sectionId}: No highlights found`);
      }
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : 'Unknown error');
      console.error(`[DashboardSummaryAgent] Section failed:`, result.reason);
    }
  }

  console.error(
    `[DashboardSummaryAgent] Complete: ${sectionsProcessed}/${DASHBOARD_SECTIONS.length} sections, ${sectionsWithHighlights} with highlights`
  );

  return {
    success: errors.length === 0,
    sectionsProcessed,
    sectionsWithHighlights,
    errors,
  };
}
