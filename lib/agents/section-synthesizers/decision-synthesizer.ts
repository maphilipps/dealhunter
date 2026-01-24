/**
 * Decision Section Synthesizer
 *
 * Aggregates all section insights into a final BID/NO-BID recommendation.
 * This is the final decision page synthesizer.
 */

import { z } from 'zod';

import type { SectionSynthesizerInput, SectionSynthesizerOutput } from './base';
import { SectionSynthesizerBase } from './base';

// ===== Zod Output Schema =====

const decisionFactorSchema = z.object({
  factor: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(100).describe('Importance weight (0-100)'),
  assessment: z.string(),
  impact: z.enum(['positive', 'negative', 'neutral']),
});

const recommendationSchema = z.object({
  decision: z.enum(['BID', 'NO-BID', 'CONDITIONAL-BID']),
  confidence: z.number().min(0).max(100).describe('Confidence in this recommendation (0-100)'),
  reasoning: z.string().min(100).describe('Detailed reasoning for the recommendation'),
  conditions: z
    .array(z.string())
    .optional()
    .describe('Conditions that must be met (for CONDITIONAL-BID)'),
});

const decisionOutputSchema = z.object({
  summary: z.string().min(100).describe('Executive summary of BID/NO-BID decision'),

  recommendation: recommendationSchema,

  overallScore: z.number().min(0).max(100).describe('Overall project attractiveness score (0-100)'),

  decisionFactors: z
    .array(decisionFactorSchema)
    .min(5)
    .max(15)
    .describe('Key factors influencing the decision'),

  strengthsAndOpportunities: z
    .array(z.string())
    .min(3)
    .max(10)
    .describe('Key strengths and opportunities'),

  weaknessesAndThreats: z.array(z.string()).min(1).max(10).describe('Key weaknesses and threats'),

  strategicFit: z.object({
    score: z.number().min(0).max(100),
    assessment: z.string(),
    alignment: z
      .array(
        z.object({
          area: z.string(),
          fit: z.enum(['poor', 'adequate', 'good', 'excellent']),
          notes: z.string().optional(),
        })
      )
      .describe('Alignment with company strategy'),
  }),

  financialAssessment: z.object({
    budgetFit: z.enum(['poor', 'tight', 'adequate', 'comfortable']),
    profitabilityScore: z.number().min(0).max(100),
    assessment: z.string(),
    estimatedRevenue: z.string().optional(),
    estimatedMargin: z.string().optional(),
  }),

  riskAssessment: z.object({
    overallRiskLevel: z.enum(['low', 'medium', 'high', 'very-high']),
    topRisks: z
      .array(
        z.object({
          risk: z.string(),
          category: z.enum([
            'technical',
            'financial',
            'timeline',
            'organizational',
            'market',
            'legal',
          ]),
          severity: z.enum(['low', 'medium', 'high', 'critical']),
          mitigation: z.string(),
        })
      )
      .min(1)
      .max(8),
    riskScore: z.number().min(0).max(100).describe('Overall risk score (higher = more risky)'),
  }),

  competitivePosition: z.object({
    competitiveAdvantage: z.array(z.string()).min(0).max(5).describe('Our competitive advantages'),
    competitiveDisadvantage: z
      .array(z.string())
      .min(0)
      .max(5)
      .describe('Our competitive disadvantages'),
    winProbability: z
      .number()
      .min(0)
      .max(100)
      .describe('Estimated probability of winning (0-100%)'),
  }),

  implementationFeasibility: z.object({
    score: z.number().min(0).max(100),
    assessment: z.string(),
    keyConstraints: z.array(z.string()).min(0).max(8),
    criticalDependencies: z.array(z.string()).min(0).max(8),
  }),

  nextSteps: z
    .array(
      z.object({
        step: z.string(),
        priority: z.enum(['immediate', 'short-term', 'medium-term']),
        owner: z.string().optional(),
        deadline: z.string().optional(),
      })
    )
    .min(1)
    .max(10)
    .describe('Recommended next steps'),

  alternativeApproaches: z
    .array(
      z.object({
        approach: z.string(),
        description: z.string(),
        pros: z.array(z.string()),
        cons: z.array(z.string()),
      })
    )
    .optional()
    .describe('Alternative approaches if primary recommendation is not pursued'),

  executiveSummaryForStakeholders: z
    .string()
    .min(100)
    .describe('Non-technical executive summary for senior stakeholders'),
});

type DecisionOutput = z.infer<typeof decisionOutputSchema>;

// ===== Synthesizer Implementation =====

export class DecisionSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'decision';
  readonly sectionTitle = 'BID/NO-BID Entscheidung';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, context } = input;

    // Step 1: Query RAG for ALL section data to aggregate
    // Use higher maxResults to get comprehensive data from all sections
    const ragResults = await this.queryRAG(leadId, undefined, {
      maxResults: 30,
      minConfidence: 10, // Lower confidence to capture more data
    });

    if (ragResults.length === 0) {
      throw new Error(
        'No RAG data available for decision synthesis. Complete other sections first.'
      );
    }

    // Step 2: Build context from RAG chunks
    const ragContext = ragResults
      .map(
        (chunk, idx) =>
          `[Chunk ${idx + 1}] (Confidence: ${chunk.similarity.toFixed(0)}%, Agent: ${chunk.agentName || 'unknown'})\n${chunk.content}`
      )
      .join('\n\n');

    // Step 3: Generate final decision
    const systemPrompt = `You are an expert business strategist and decision advisor specializing in digital transformation projects.

Aggregate ALL section insights and provide a comprehensive BID/NO-BID recommendation:

1. Recommendation - BID, NO-BID, or CONDITIONAL-BID with confidence score and detailed reasoning
2. Overall Score - Project attractiveness score (0-100)
3. Decision Factors - Key factors with scores, weights, and assessments
4. Strengths & Opportunities - What makes this project attractive
5. Weaknesses & Threats - What concerns exist
6. Strategic Fit - How well project aligns with company strategy
7. Financial Assessment - Budget fit, profitability, revenue, margin
8. Risk Assessment - Overall risk level, top risks, risk score
9. Competitive Position - Our advantages/disadvantages, win probability
10. Implementation Feasibility - Feasibility score, constraints, dependencies
11. Next Steps - Prioritized action items with owners and deadlines
12. Alternative Approaches - If primary recommendation is not pursued
13. Executive Summary - Non-technical summary for senior stakeholders

Consider ALL data from previous sections:
- Overview insights
- Technology stack assessment
- Website analysis results
- CMS architecture and comparison
- Hosting requirements
- Integration complexity
- Migration complexity
- Cost estimates and budget fit
- Timeline feasibility

Make a data-driven, objective recommendation. Be honest about risks and weaknesses.
CONDITIONAL-BID is appropriate when risks can be mitigated with specific conditions.

Use a balanced scoring approach: 70+ = Strong BID, 40-69 = Conditional, <40 = NO-BID`;

    const userPrompt = `Lead ID: ${leadId}
User Context: ${context.userName} (${context.userRole})

=== AGGREGATED RAG DATA FROM ALL SECTIONS ===
${ragContext}
=== END AGGREGATED DATA ===

Synthesize all section insights into a final BID/NO-BID recommendation.
Be comprehensive, data-driven, and honest about strengths and weaknesses.

Output must be valid JSON matching the schema.`;

    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.2);

    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse);
    const decisionOutput: DecisionOutput = decisionOutputSchema.parse(rawResult);

    const confidence = this.calculateConfidence(ragResults);
    const sources = this.extractSources(ragResults);

    // Step 4: Save to database
    await this.saveSectionData(leadId, decisionOutput, {
      agentName: 'decision-synthesizer',
      generatedAt: new Date(),
      sources,
      confidence,
    });

    return {
      success: true,
      sectionId: this.sectionId,
      content: decisionOutput,
      metadata: {
        generatedAt: new Date(),
        agentName: 'decision-synthesizer',
        sources,
        confidence,
      },
    };
  }
}

// Singleton instance
export const decisionSynthesizer = new DecisionSynthesizer();
