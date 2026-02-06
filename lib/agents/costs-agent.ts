/**
 * Costs Agent (Phase 2.3)
 *
 * Calculates project costs and budget fit analysis.
 *
 * Features:
 * - Uses PT Calculator for base estimation
 * - Adds budget fit analysis
 * - Generates cost breakdown by phase and role
 * - ROI projection based on project type
 *
 * Inputs:
 * - Content Architecture (from RAG)
 * - Migration Complexity (from RAG)
 * - Selected CMS technology
 * - Customer budget range (if available)
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { pitches, leadScans, pitchSectionData, dealEmbeddings } from '@/lib/db/schema';
import { calculatePTEstimation, type PTEstimationResult } from '@/lib/estimations/pt-calculator';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cost breakdown schema
 */
export const CostBreakdownSchema = z.object({
  phase: z.string().describe('Phase name'),
  hours: z.number().describe('Estimated hours'),
  cost: z.number().describe('Estimated cost in EUR'),
  percentage: z.number().describe('Percentage of total cost'),
});

export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;

/**
 * Budget fit analysis schema
 */
export const BudgetFitSchema = z.object({
  status: z
    .enum(['excellent', 'good', 'tight', 'over_budget', 'unknown'])
    .describe('Budget fit status'),
  estimatedCost: z.number().describe('Total estimated cost in EUR'),
  customerBudgetMin: z.number().nullable().describe('Customer min budget (if known)'),
  customerBudgetMax: z.number().nullable().describe('Customer max budget (if known)'),
  variance: z.number().nullable().describe('Variance from customer budget (%)'),
  recommendation: z.string().describe('Budget recommendation'),
});

export type BudgetFit = z.infer<typeof BudgetFitSchema>;

/**
 * Costs analysis result schema
 */
export const CostsAnalysisSchema = z.object({
  // PT Estimation
  totalHours: z.number().describe('Total person hours'),
  totalPT: z.number().describe('Total person days (hours/8)'),
  baselineHours: z.number().describe('Baseline hours'),
  additionalHours: z.number().describe('Additional hours from delta'),
  riskBufferPercent: z.number().describe('Risk buffer percentage'),

  // Cost Estimation
  hourlyRate: z.number().describe('Assumed hourly rate in EUR'),
  totalCost: z.number().describe('Total estimated cost in EUR'),
  costBreakdown: z.array(CostBreakdownSchema).describe('Cost by phase'),

  // Budget Fit
  budgetFit: BudgetFitSchema,

  // Feature-Level Costs (optional)
  featureCosts: z
    .array(
      z.object({
        feature: z.string(),
        hours: z.number(),
        cost: z.number(),
        complexity: z.enum(['low', 'medium', 'high']),
      })
    )
    .describe('Estimated costs per feature'),

  // ROI Indicators
  roi: z.object({
    paybackPeriod: z.string().describe('Estimated payback period'),
    mainBenefits: z.array(z.string()).describe('Main ROI benefits'),
    qualitativeValue: z.string().describe('Qualitative value assessment'),
  }),

  // Metadata
  confidence: z.number().min(0).max(100).describe('Estimation confidence'),
  assumptions: z.array(z.string()).describe('Key assumptions'),
});

export type CostsAnalysis = z.infer<typeof CostsAnalysisSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default hourly rate for adesso (EUR)
 */
const DEFAULT_HOURLY_RATE = 120;

/**
 * Hours per person day
 */
const HOURS_PER_PT = 8;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run costs agent
 *
 * @param leadId - Lead ID
 * @param preQualificationId - Qualification ID
 * @returns Costs analysis with budget fit
 */
export async function runCostsAgent(
  leadId: string,
  preQualificationId: string
): Promise<CostsAnalysis> {
  // 1. Fetch lead data
  const [leadData] = await db
    .select({
      customerName: pitches.customerName,
      selectedCmsId: pitches.selectedCmsId,
      qualificationScanId: pitches.qualificationScanId,
    })
    .from(pitches)
    .where(eq(pitches.id, leadId))
    .limit(1);

  if (!leadData) {
    throw new Error(`Lead ${leadId} not found`);
  }

  // 2. Fetch Quick Scan for page count and features
  let qualificationScanData: {
    pageCount: number | null;
    features: unknown;
    migrationComplexity: unknown;
  } | null = null;

  if (leadData.qualificationScanId) {
    const [qs] = await db
      .select({
        pageCount: leadScans.pageCount,
        features: leadScans.features,
        migrationComplexity: leadScans.migrationComplexity,
      })
      .from(leadScans)
      .where(eq(leadScans.id, leadData.qualificationScanId))
      .limit(1);

    if (qs) {
      qualificationScanData = {
        pageCount: qs.pageCount,
        features: safeParseJson(qs.features),
        migrationComplexity: safeParseJson(qs.migrationComplexity),
      };
    }
  }

  // 3. Fetch existing section data for content architecture and migration complexity
  const sectionResults = await db
    .select({
      sectionId: pitchSectionData.sectionId,
      content: pitchSectionData.content,
    })
    .from(pitchSectionData)
    .where(eq(pitchSectionData.pitchId, leadId));

  const sectionDataMap: Record<string, unknown> = {};
  for (const section of sectionResults) {
    sectionDataMap[section.sectionId] = safeParseJson(section.content);
  }

  // 4. Try to use PT Calculator if we have the required data
  let ptEstimation: PTEstimationResult | null = null;

  if (
    leadData.selectedCmsId &&
    sectionDataMap['cms-architecture'] &&
    (sectionDataMap['migration'] || qualificationScanData?.migrationComplexity)
  ) {
    try {
      ptEstimation = await calculatePTEstimation({
        leadId,
        technologyId: leadData.selectedCmsId,
        contentArchitecture: sectionDataMap['cms-architecture'] as Parameters<
          typeof calculatePTEstimation
        >[0]['contentArchitecture'],
        migrationComplexity: (sectionDataMap['migration'] ||
          qualificationScanData?.migrationComplexity) as Parameters<
          typeof calculatePTEstimation
        >[0]['migrationComplexity'],
      });
    } catch {
      console.warn('[CostsAgent] PT Calculator failed, using fallback estimation');
    }
  }

  // 5. Calculate costs (using PT estimation or fallback)
  const totalHours =
    ptEstimation?.totalPT || estimateFallbackHours(qualificationScanData?.pageCount);
  const baselineHours = ptEstimation?.baselineHours || 0;
  const additionalHours = ptEstimation?.additionalPT || 0;
  const riskBuffer = ptEstimation?.riskBuffer || 20;
  const confidence = ptEstimation?.success
    ? ptEstimation.confidenceLevel === 'high'
      ? 80
      : ptEstimation.confidenceLevel === 'medium'
        ? 60
        : 40
    : 30;

  const hourlyRate = DEFAULT_HOURLY_RATE;
  const totalCost = totalHours * hourlyRate;

  // 6. Generate phase breakdown
  const costBreakdown: CostBreakdown[] =
    ptEstimation?.phases.map(phase => ({
      phase: phase.name,
      hours: phase.hours,
      cost: phase.hours * hourlyRate,
      percentage: phase.percentage,
    })) || generateFallbackPhases(totalHours, hourlyRate);

  // 7. Use AI to generate budget fit analysis and ROI
  const system = `Du bist ein Kosten- und ROI-Analyst für adesso SE.
Analysiere die Projektkosten und erstelle eine Budget-Fit-Analyse.

KONTEXT:
- adesso Stundensatz: ${hourlyRate}€/h (Durchschnitt über alle Rollen)
- Projektgröße: ${totalHours} Stunden (${Math.round(totalHours / HOURS_PER_PT)} PT)
- Geschätzte Kosten: ${totalCost.toLocaleString('de-DE')}€

BUDGET FIT STATUS:
- excellent: Kosten < 80% des Budgets
- good: Kosten 80-100% des Budgets
- tight: Kosten 100-115% des Budgets
- over_budget: Kosten > 115% des Budgets
- unknown: Budget nicht bekannt`;

  const prompt = `Analysiere die folgenden Kostendaten und erstelle eine vollständige Kostenanalyse:

PROJEKTDATEN:
- Kunde: ${leadData.customerName}
- Geschätzte Stunden: ${totalHours}h
- Baseline: ${baselineHours}h
- Zusätzlich: ${additionalHours}h
- Risk Buffer: ${riskBuffer}%
- Gesamtkosten: ${totalCost.toLocaleString('de-DE')}€

QUICK SCAN DATEN:
- Seitenzahl: ${qualificationScanData?.pageCount || 'Unbekannt'}
- Features: ${JSON.stringify(qualificationScanData?.features, null, 2)}

KOSTENAUFSCHLÜSSELUNG (Phase):
${costBreakdown.map(c => `- ${c.phase}: ${c.hours}h = ${c.cost.toLocaleString('de-DE')}€`).join('\n')}

Erstelle eine strukturierte Kostenanalyse mit:
1. Budget Fit (Status, Empfehlung)
2. Feature-Level Kosten (basierend auf Features aus Quick Scan)
3. ROI Indikatoren (Payback, Benefits, Qualitative Value)
4. Key Assumptions`;

  const aiAnalysis = await generateStructuredOutput({
    schema: z.object({
      budgetFit: BudgetFitSchema,
      featureCosts: z.array(
        z.object({
          feature: z.string(),
          hours: z.number(),
          cost: z.number(),
          complexity: z.enum(['low', 'medium', 'high']),
        })
      ),
      roi: z.object({
        paybackPeriod: z.string(),
        mainBenefits: z.array(z.string()),
        qualitativeValue: z.string(),
      }),
      assumptions: z.array(z.string()),
    }),
    system,
    prompt,
    temperature: 0.3,
  });

  // 8. Build final result
  const result: CostsAnalysis = {
    totalHours,
    totalPT: Math.round(totalHours / HOURS_PER_PT),
    baselineHours,
    additionalHours,
    riskBufferPercent: riskBuffer,
    hourlyRate,
    totalCost,
    costBreakdown,
    budgetFit: {
      ...aiAnalysis.budgetFit,
      estimatedCost: totalCost,
    },
    featureCosts: aiAnalysis.featureCosts,
    roi: aiAnalysis.roi,
    confidence,
    assumptions: [
      ...(ptEstimation?.assumptions || []),
      ...aiAnalysis.assumptions,
      `Stundensatz: ${hourlyRate}€/h`,
    ],
  };

  // 9. Store in RAG
  const chunkText = `Costs Analysis: ${leadData.customerName}

Total Cost: ${totalCost.toLocaleString('de-DE')}€
Total Hours: ${totalHours}h (${result.totalPT} PT)
Budget Fit: ${result.budgetFit.status}

Cost Breakdown:
${costBreakdown.map(c => `- ${c.phase}: ${c.cost.toLocaleString('de-DE')}€ (${c.percentage}%)`).join('\n')}

ROI:
- Payback Period: ${result.roi.paybackPeriod}
- Main Benefits: ${result.roi.mainBenefits.join(', ')}

Assumptions:
${result.assumptions.map(a => `- ${a}`).join('\n')}`;

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
      pitchId: leadId,
      preQualificationId: preQualificationId,
      agentName: 'costs',
      chunkType: 'analysis',
      chunkIndex: 0,
      content: chunkText,
      embedding: chunksWithEmbeddings[0].embedding,
      metadata: JSON.stringify({
        totalCost: result.totalCost,
        totalHours: result.totalHours,
        budgetFitStatus: result.budgetFit.status,
        confidence: result.confidence,
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

/**
 * Estimate hours based on page count when PT Calculator not available
 */
function estimateFallbackHours(pageCount: number | null | undefined): number {
  if (!pageCount) return 800; // Default medium project

  // Heuristic: ~0.5-1 hour per page for migration + development
  if (pageCount < 100) return 400; // Small project
  if (pageCount < 500) return 800; // Medium project
  if (pageCount < 1000) return 1200; // Large project
  return 1600; // Enterprise project
}

/**
 * Generate fallback phases when PT Calculator not available
 */
function generateFallbackPhases(totalHours: number, hourlyRate: number): CostBreakdown[] {
  return [
    {
      phase: 'Foundation Setup',
      hours: totalHours * 0.3,
      cost: totalHours * 0.3 * hourlyRate,
      percentage: 30,
    },
    {
      phase: 'Custom Development',
      hours: totalHours * 0.35,
      cost: totalHours * 0.35 * hourlyRate,
      percentage: 35,
    },
    {
      phase: 'Integrations',
      hours: totalHours * 0.1,
      cost: totalHours * 0.1 * hourlyRate,
      percentage: 10,
    },
    {
      phase: 'Content Migration',
      hours: totalHours * 0.15,
      cost: totalHours * 0.15 * hourlyRate,
      percentage: 15,
    },
    {
      phase: 'Testing & QA',
      hours: totalHours * 0.1,
      cost: totalHours * 0.1 * hourlyRate,
      percentage: 10,
    },
  ];
}
