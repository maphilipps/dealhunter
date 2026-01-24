/**
 * Costs & Budget Section Synthesizer
 *
 * Provides detailed cost breakdown including implementation costs,
 * ongoing costs, and budget fit analysis.
 */

import { z } from 'zod';

import type { SectionSynthesizerInput, SectionSynthesizerOutput } from './base';
import { SectionSynthesizerBase } from './base';

// ===== Zod Output Schema =====

const costBreakdownSchema = z.object({
  category: z.string().min(1),
  oneTime: z.string().optional().describe('One-time costs (e.g., "€50,000")'),
  annual: z.string().optional().describe('Annual recurring costs'),
  monthly: z.string().optional().describe('Monthly recurring costs'),
  description: z.string(),
});

const budgetFitSchema = z.object({
  clientBudget: z.string().optional().describe('Client budget if known (e.g., "€200,000")'),
  estimatedTotal: z.string().describe('Estimated total project cost'),
  fitScore: z.number().min(0).max(100).describe('How well estimate fits budget (0-100)'),
  assessment: z.string().describe('Budget fit assessment'),
  recommendations: z.array(z.string()).min(0).max(5).describe('Recommendations if budget is tight'),
});

const roiAnalysisSchema = z.object({
  estimatedROI: z.string().optional().describe('Expected ROI (e.g., "150-200% over 3 years")'),
  paybackPeriod: z.string().optional().describe('Estimated payback period (e.g., "18-24 months")'),
  businessBenefits: z.array(z.string()).min(1).max(8).describe('Quantified business benefits'),
  costSavings: z
    .array(
      z.object({
        area: z.string(),
        annualSavings: z.string(),
        description: z.string(),
      })
    )
    .optional(),
});

const tcoSchema = z.object({
  year1: z.string().describe('Total Cost of Ownership - Year 1'),
  year2: z.string().optional(),
  year3: z.string().optional(),
  year5: z.string().optional(),
  breakdown: z
    .array(
      z.object({
        component: z.string(),
        year1: z.string(),
        year2: z.string().optional(),
        year3: z.string().optional(),
      })
    )
    .describe('TCO breakdown by component'),
});

const costsOutputSchema = z.object({
  summary: z.string().min(50).describe('Executive summary of cost analysis'),

  implementationCosts: z.object({
    total: z.string().describe('Total implementation cost estimate'),
    breakdown: z.array(costBreakdownSchema).min(1).describe('Breakdown by category'),
    contingency: z.string().optional().describe('Contingency buffer (e.g., "10%")'),
  }),

  ongoingCosts: z.object({
    totalAnnual: z.string().describe('Total annual operating costs'),
    totalMonthly: z.string().describe('Total monthly operating costs'),
    breakdown: z.array(costBreakdownSchema).min(1).describe('Breakdown by category'),
  }),

  budgetFit: budgetFitSchema,

  roiAnalysis: roiAnalysisSchema,

  tcoAnalysis: tcoSchema,

  costDrivers: z
    .array(
      z.object({
        driver: z.string(),
        impact: z.enum(['low', 'medium', 'high', 'very-high']),
        description: z.string(),
      })
    )
    .min(1)
    .max(8)
    .describe('Key factors driving costs'),

  costOptimization: z
    .array(
      z.object({
        opportunity: z.string(),
        potentialSavings: z.string(),
        tradeoff: z.string(),
      })
    )
    .min(0)
    .max(8)
    .describe('Opportunities to reduce costs'),

  financialRisks: z
    .array(
      z.object({
        risk: z.string(),
        likelihood: z.enum(['low', 'medium', 'high']),
        impact: z.string().describe('Financial impact if risk occurs'),
        mitigation: z.string(),
      })
    )
    .min(0)
    .max(8),

  comparisonToBaseline: z
    .object({
      baselineApproach: z.string().describe('Baseline approach (e.g., "Status quo")'),
      baselineCost: z.string(),
      proposedCost: z.string(),
      difference: z.string(),
      justification: z.string(),
    })
    .optional(),
});

type CostsOutput = z.infer<typeof costsOutputSchema>;

// ===== Synthesizer Implementation =====

export class CostsSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'costs';
  readonly sectionTitle = 'Kosten & Budget';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, context } = input;

    // Step 1: Query RAG for cost and budget data
    const ragResults = await this.queryRAG(leadId, undefined, {
      maxResults: 20,
      minConfidence: 15,
    });

    if (ragResults.length === 0) {
      throw new Error('No RAG data available for cost analysis. Run a Deep Scan first.');
    }

    // Step 2: Build context from RAG chunks
    const ragContext = ragResults
      .map(
        (chunk, idx) =>
          `[Chunk ${idx + 1}] (Confidence: ${chunk.similarity.toFixed(0)}%, Agent: ${chunk.agentName || 'unknown'})\n${chunk.content}`
      )
      .join('\n\n');

    // Step 3: Generate cost analysis
    const systemPrompt = `You are an expert financial analyst specializing in digital transformation and CMS project budgeting.

Analyze project costs and provide:
1. Implementation Costs - Total with breakdown by category (development, design, content, hosting, licenses, training, etc.)
2. Ongoing Costs - Annual and monthly recurring costs breakdown
3. Budget Fit - How well estimate fits client budget (if known) with recommendations
4. ROI Analysis - Expected ROI, payback period, business benefits, cost savings
5. TCO Analysis - Total Cost of Ownership for Year 1, 2, 3, 5 with breakdown
6. Cost Drivers - Key factors driving costs with impact assessment
7. Cost Optimization - Opportunities to reduce costs with tradeoffs
8. Financial Risks - Risks that could increase costs with mitigation
9. Comparison to Baseline - Cost comparison to status quo or alternative approaches

Consider:
- Project scope and complexity
- Team rates and resource requirements
- Technology licensing and infrastructure costs
- Training and change management
- Contingency buffers (typically 10-20%)
- Long-term operating costs
- Regional cost differences (Germany/Europe pricing)

Be specific with estimates (e.g., "€150,000-200,000") and justify them.
Use Euro (€) currency for German market.`;

    const userPrompt = `Lead ID: ${leadId}
User Context: ${context.userName} (${context.userRole})

=== RAG DATA CONTEXT START ===
${ragContext}
=== RAG DATA CONTEXT END ===

Analyze the cost requirements based on the project data.
Provide detailed cost breakdown, budget fit, ROI, and TCO analysis.

Output must be valid JSON matching the schema.`;

    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse);
    const costsOutput: CostsOutput = costsOutputSchema.parse(rawResult);

    const confidence = this.calculateConfidence(ragResults);
    const sources = this.extractSources(ragResults);

    // Step 4: Save to database
    await this.saveSectionData(leadId, costsOutput, {
      agentName: 'costs-synthesizer',
      generatedAt: new Date(),
      sources,
      confidence,
    });

    return {
      success: true,
      sectionId: this.sectionId,
      content: costsOutput,
      metadata: {
        generatedAt: new Date(),
        agentName: 'costs-synthesizer',
        sources,
        confidence,
      },
    };
  }
}

// Singleton instance
export const costsSynthesizer = new CostsSynthesizer();
