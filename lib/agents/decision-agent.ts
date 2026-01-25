/**
 * Decision Agent (DEA-152 / Phase 2.2)
 *
 * Aggregates all section analysis results to generate a final BID/NO-BID recommendation.
 *
 * Features:
 * - Queries RAG for all section data
 * - Calculates weighted scores by category
 * - Generates executive summary and detailed reasoning
 * - Produces structured DecisionAnalysis output
 *
 * Categories and Weights:
 * - Technical Fit (25%): Tech stack, website analysis, CMS architecture
 * - Commercial Viability (25%): Costs, budget, ROI
 * - Risk Assessment (20%): Migration complexity, risks
 * - Legal Compliance (15%): GDPR, industry regulations
 * - Reference Match (15%): Matching reference projects
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import {
  qualifications,
  qualificationSectionData,
  quickScans,
  dealEmbeddings,
} from '@/lib/db/schema';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Category analysis schema
 */
export const CategoryAnalysisSchema = z.object({
  id: z.string().describe('Category identifier'),
  name: z.string().describe('Display name'),
  weight: z.number().min(0).max(1).describe('Weight (0-1, total should sum to 1)'),
  score: z.number().min(0).max(100).describe('Score (0-100)'),
  pros: z.array(z.string()).describe('Positive factors'),
  cons: z.array(z.string()).describe('Negative factors / risks'),
});

export type CategoryAnalysis = z.infer<typeof CategoryAnalysisSchema>;

/**
 * Decision analysis result schema
 */
export const DecisionAnalysisSchema = z.object({
  executiveSummary: z.string().describe('2-3 sentence executive summary of recommendation'),
  recommendation: z.enum(['BID', 'NO-BID']).describe('Final recommendation'),
  confidenceScore: z.number().min(0).max(100).describe('Overall confidence score'),
  categories: z.array(CategoryAnalysisSchema).describe('Category breakdown with scores'),
  reasoning: z
    .string()
    .describe('Detailed reasoning explaining the recommendation (2-4 paragraphs)'),
});

export type DecisionAnalysis = z.infer<typeof DecisionAnalysisSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Category definitions with weights and related sections
 */
const CATEGORIES = [
  {
    id: 'technical',
    name: 'Technical Fit',
    weight: 0.25,
    relatedSections: ['technology', 'website-analysis', 'cms-architecture'],
  },
  {
    id: 'commercial',
    name: 'Commercial Viability',
    weight: 0.25,
    relatedSections: ['costs', 'overview'],
  },
  {
    id: 'risk',
    name: 'Risk Assessment',
    weight: 0.2,
    relatedSections: ['migration', 'risks', 'staffing'],
  },
  {
    id: 'legal',
    name: 'Legal Compliance',
    weight: 0.15,
    relatedSections: ['legal'],
  },
  {
    id: 'references',
    name: 'Reference Match',
    weight: 0.15,
    relatedSections: ['references'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run decision agent
 *
 * @param leadId - Lead ID
 * @param rfpId - RFP ID
 * @returns Decision analysis with BID/NO-BID recommendation
 */
export async function runDecisionAgent(leadId: string, rfpId: string): Promise<DecisionAnalysis> {
  // 1. Fetch lead data
  const [leadData] = await db
    .select({
      customerName: qualifications.customerName,
      industry: qualifications.industry,
      projectDescription: qualifications.projectDescription,
      quickScanId: qualifications.quickScanId,
    })
    .from(qualifications)
    .where(eq(qualifications.id, leadId))
    .limit(1);

  if (!leadData) {
    throw new Error(`Lead ${leadId} not found`);
  }

  // 2. Fetch Quick Scan data
  let quickScanData: Record<string, unknown> | null = null;
  if (leadData.quickScanId) {
    const [qs] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, leadData.quickScanId))
      .limit(1);

    if (qs) {
      quickScanData = {
        recommendedBusinessUnit: qs.recommendedBusinessUnit,
        confidence: qs.confidence,
        reasoning: qs.reasoning,
        migrationComplexity: safeParseJson(qs.migrationComplexity),
        techStack: safeParseJson(qs.techStack),
        cms: qs.cms,
        framework: qs.framework,
        hosting: qs.hosting,
        pageCount: qs.pageCount,
        companyIntelligence: safeParseJson(qs.companyIntelligence),
        decisionMakers: safeParseJson(qs.decisionMakers),
      };
    }
  }

  // 3. Fetch all section data from Deep Scan
  const sectionResults = await db
    .select({
      sectionId: qualificationSectionData.sectionId,
      content: qualificationSectionData.content,
      confidence: qualificationSectionData.confidence,
      sources: qualificationSectionData.sources,
    })
    .from(qualificationSectionData)
    .where(eq(qualificationSectionData.qualificationId, leadId));

  // Parse section data
  const sectionDataMap: Record<string, { content: unknown; confidence: number | null }> = {};
  for (const section of sectionResults) {
    sectionDataMap[section.sectionId] = {
      content: safeParseJson(section.content),
      confidence: section.confidence,
    };
  }

  // 4. Build category context for AI
  const categoryContext = CATEGORIES.map(cat => {
    const relatedData = cat.relatedSections.map(sectionId => {
      const data = sectionDataMap[sectionId];
      return {
        sectionId,
        data: data?.content || null,
        confidence: data?.confidence || null,
      };
    });

    return {
      id: cat.id,
      name: cat.name,
      weight: cat.weight,
      relatedSections: relatedData,
    };
  });

  // 5. Generate decision with AI
  const system = `Du bist ein BD-Decision Agent für adesso SE.
Deine Aufgabe ist es, alle verfügbaren Daten zu einem Lead zu analysieren und eine fundierte BID/NO-BID Empfehlung zu generieren.

KONTEXT:
- adesso ist ein IT-Dienstleister mit Fokus auf CMS-Migrationen (Drupal, etc.)
- Eine BID-Entscheidung bedeutet: Wir geben ein Angebot ab
- Eine NO-BID-Entscheidung bedeutet: Wir verzichten auf das Projekt

KATEGORIEN UND GEWICHTUNG:
- Technical Fit (25%): Passt das Projekt zu unseren technischen Fähigkeiten?
- Commercial Viability (25%): Ist das Projekt wirtschaftlich attraktiv?
- Risk Assessment (20%): Wie hoch sind die Projektrisiken?
- Legal Compliance (15%): Gibt es rechtliche Hürden?
- Reference Match (15%): Haben wir passende Referenzen?

SCORING GUIDELINES:
- 80-100: Sehr gut - starke positive Faktoren, keine kritischen Risiken
- 60-79: Gut - überwiegend positive Faktoren, handhabbare Risiken
- 40-59: Mittel - ausgeglichene Faktoren, signifikante Risiken
- 20-39: Schwach - überwiegend negative Faktoren, hohe Risiken
- 0-19: Kritisch - kritische Probleme, nicht empfehlenswert

BID-SCHWELLE:
- confidenceScore >= 60 UND keine Kategorie < 30 → BID empfohlen
- confidenceScore < 50 ODER eine Kategorie < 20 → NO-BID empfohlen
- Dazwischen: Abwägung basierend auf strategischen Faktoren`;

  const prompt = `Analysiere die folgenden Daten und erstelle eine BID/NO-BID Entscheidungsvorlage.

LEAD INFORMATIONEN:
- Kunde: ${leadData.customerName}
- Branche: ${leadData.industry || 'Unbekannt'}
- Projektbeschreibung: ${leadData.projectDescription || 'Keine Beschreibung'}

QUICK SCAN ERGEBNISSE:
${JSON.stringify(quickScanData, null, 2)}

DEEP SCAN SECTION DATEN (nach Kategorien):
${JSON.stringify(categoryContext, null, 2)}

Erstelle eine strukturierte Entscheidungsanalyse mit:
1. Executive Summary (2-3 Sätze)
2. Klare BID oder NO-BID Empfehlung
3. Gesamtconfidence (0-100)
4. Aufschlüsselung nach allen 5 Kategorien mit Score, Pros und Cons
5. Detaillierte Begründung (2-4 Absätze)

WICHTIG:
- Wenn Section-Daten fehlen, schätze basierend auf Quick Scan und Branche
- Sei präzise bei den Pros/Cons (konkrete Punkte, keine allgemeinen Aussagen)
- Die Gewichtungen müssen exakt wie definiert sein (0.25, 0.25, 0.2, 0.15, 0.15)`;

  const result = await generateStructuredOutput({
    schema: DecisionAnalysisSchema,
    system,
    prompt,
    temperature: 0.3,
  });

  // 6. Store in RAG for retrieval
  const chunkText = `Decision Analysis: ${leadData.customerName}

Recommendation: ${result.recommendation}
Confidence: ${result.confidenceScore}%

Executive Summary:
${result.executiveSummary}

Category Scores:
${result.categories.map(c => `- ${c.name}: ${c.score}% (Weight: ${c.weight * 100}%)`).join('\n')}

Reasoning:
${result.reasoning}`;

  const chunks = [
    {
      chunkIndex: 0,
      content: chunkText,
      tokenCount: Math.ceil(chunkText.length / 4),
      metadata: {
        startPosition: 0,
        endPosition: chunkText.length,
        type: 'section' as const,
      },
    },
  ];

  const chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);

  if (chunksWithEmbeddings && chunksWithEmbeddings.length > 0) {
    await db.insert(dealEmbeddings).values({
      qualificationId: leadId,
      preQualificationId: rfpId,
      agentName: 'decision',
      chunkType: 'analysis',
      chunkIndex: 0,
      content: chunkText,
      embedding: chunksWithEmbeddings[0].embedding,
      metadata: JSON.stringify({
        recommendation: result.recommendation,
        confidenceScore: result.confidenceScore,
        categoryScores: result.categories.map(c => ({ id: c.id, score: c.score })),
      }),
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely parse JSON string
 */
function safeParseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
