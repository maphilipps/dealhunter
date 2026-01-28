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
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { queryRAG } from '@/lib/rag/retrieval-service';

/**
 * Section configuration for highlight generation
 */
const DASHBOARD_SECTIONS = [
  {
    id: 'facts',
    title: 'Key Facts',
    query: 'Projektübersicht Kunde Branche Scope wichtigste Fakten',
  },
  {
    id: 'budget',
    title: 'Budget',
    query: 'Budget Preis Kosten Finanzierung Vergütung Angebotspreis Wert',
  },
  {
    id: 'timing',
    title: 'Zeitplan / Verfahren',
    query: 'Zeitplan Termine Fristen Meilensteine Deadlines Vergabeverfahren',
  },
  {
    id: 'contracts',
    title: 'Verträge',
    query: 'Vertrag Bedingungen AGB Haftung Gewährleistung Vertragsstrafe',
  },
  {
    id: 'deliverables',
    title: 'Leistungsumfang',
    query: 'Leistungen Anforderungen Deliverables Umfang Aufgaben',
  },
  {
    id: 'references',
    title: 'Referenzen',
    query: 'Referenzen Nachweise Erfahrung Qualifikation Projekte',
  },
  {
    id: 'award-criteria',
    title: 'Zuschlagskriterien',
    query: 'Zuschlagskriterien Bewertung Wertung Punkte Kriterien',
  },
  {
    id: 'offer-structure',
    title: 'Angebotsstruktur',
    query: 'Angebotsstruktur Gliederung Format Unterlagen Abgabe',
  },
] as const;

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

// Type for generated highlights - used by generateStructuredOutput
// type SectionHighlights = z.infer<typeof SectionHighlightsSchema>;

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
 * Generates Top-3 Key Facts for all dashboard sections.
 * Should be called after all expert agents have completed.
 */
export async function runDashboardSummaryAgent(
  preQualificationId: string
): Promise<DashboardSummaryResult> {
  const errors: string[] = [];
  let sectionsProcessed = 0;
  let sectionsWithHighlights = 0;

  console.log(`[DashboardSummaryAgent] Starting for ${preQualificationId}`);

  for (const section of DASHBOARD_SECTIONS) {
    try {
      const { highlights, confidence } = await generateSectionHighlights(
        preQualificationId,
        section.id,
        section.title,
        section.query
      );

      await storeHighlights(preQualificationId, section.id, highlights, confidence);

      sectionsProcessed++;
      if (highlights.length > 0) {
        sectionsWithHighlights++;
        console.log(
          `[DashboardSummaryAgent] ${section.id}: ${highlights.length} highlights (${confidence}%)`
        );
      } else {
        console.log(`[DashboardSummaryAgent] ${section.id}: No highlights found`);
      }
    } catch (error) {
      const errorMsg = `Section ${section.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`[DashboardSummaryAgent] ${errorMsg}`);
    }
  }

  console.log(
    `[DashboardSummaryAgent] Complete: ${sectionsProcessed}/${DASHBOARD_SECTIONS.length} sections, ${sectionsWithHighlights} with highlights`
  );

  return {
    success: errors.length === 0,
    sectionsProcessed,
    sectionsWithHighlights,
    errors,
  };
}

/**
 * Get cached dashboard highlights for a pre-qualification
 */
export async function getDashboardHighlights(
  preQualificationId: string
): Promise<Map<string, { highlights: string[]; confidence: number }>> {
  const results = await db.query.dealEmbeddings.findMany({
    where: and(
      eq(dealEmbeddings.preQualificationId, preQualificationId),
      eq(dealEmbeddings.chunkType, 'dashboard_highlight')
    ),
  });

  const highlightsMap = new Map<string, { highlights: string[]; confidence: number }>();

  for (const row of results) {
    try {
      const metadata = row.metadata ? JSON.parse(row.metadata) : {};
      const sectionId = metadata.sectionId;
      if (sectionId && row.content) {
        const highlights = JSON.parse(row.content) as string[];
        highlightsMap.set(sectionId, {
          highlights,
          confidence: row.confidence ?? 50,
        });
      }
    } catch {
      // Skip malformed entries
    }
  }

  return highlightsMap;
}

/**
 * Invalidate dashboard highlights for a section
 * Call this when section data changes
 */
export async function invalidateSectionHighlights(
  preQualificationId: string,
  sectionId: string
): Promise<void> {
  await db
    .delete(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        eq(dealEmbeddings.chunkType, 'dashboard_highlight'),
        eq(dealEmbeddings.agentName, `dashboard_${sectionId}`)
      )
    );
}
