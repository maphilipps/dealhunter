/**
 * CMS Comparison Section Synthesizer
 *
 * Compares available CMS options for the project and provides a recommendation.
 */

import { z } from 'zod';

import type { SectionSynthesizerInput, SectionSynthesizerOutput } from './base';
import { SectionSynthesizerBase } from './base';

// ===== Zod Output Schema =====

const cmsOptionSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().min(10),
  category: z.enum(['open-source', 'proprietary', 'headless', 'saas']),

  strengths: z.array(z.string()).min(2).max(8).describe('Key strengths and benefits'),

  weaknesses: z.array(z.string()).min(1).max(8).describe('Limitations and drawbacks'),

  fitScore: z.number().min(0).max(100).describe('How well this CMS fits the project (0-100)'),

  costEstimate: z.object({
    implementation: z.string().optional().describe('Estimated implementation cost range'),
    licensing: z.string().optional().describe('Annual licensing costs'),
    maintenance: z.string().optional().describe('Annual maintenance costs'),
  }),

  technicalFit: z.object({
    scalability: z.enum(['low', 'medium', 'high']),
    flexibility: z.enum(['low', 'medium', 'high']),
    performanceScore: z.number().min(0).max(100),
    securityScore: z.number().min(0).max(100),
  }),
});

const cmsComparisonOutputSchema = z.object({
  summary: z.string().min(50).describe('Executive summary of CMS comparison analysis'),

  cmsOptions: z.array(cmsOptionSchema).min(2).max(6).describe('CMS options analyzed'),

  recommendation: z.object({
    primaryChoice: z.string().describe('Recommended CMS name'),
    reasoning: z.string().min(100).describe('Detailed reasoning for recommendation'),
    alternativeChoice: z.string().optional().describe('Fallback option if primary is not feasible'),
    implementationApproach: z.string().describe('High-level approach for implementation'),
  }),

  comparisonMatrix: z
    .array(
      z.object({
        criterion: z.string(),
        weight: z.number().min(0).max(100).optional(),
        scores: z.record(z.string(), z.number().min(0).max(100)),
        notes: z.string().optional(),
      })
    )
    .describe('Structured comparison across key criteria'),

  industryAffinity: z
    .object({
      industryMatch: z.string().describe('How well CMS options match industry requirements'),
      industryExamples: z
        .array(z.string())
        .optional()
        .describe('Similar industry projects using these CMS systems'),
    })
    .optional(),

  risks: z
    .array(
      z.object({
        cmsName: z.string(),
        risk: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        mitigation: z.string(),
      })
    )
    .min(0)
    .max(10),

  decisionFactors: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe('Key factors influencing the CMS selection'),
});

type CMSComparisonOutput = z.infer<typeof cmsComparisonOutputSchema>;

// ===== Synthesizer Implementation =====

export class CMSComparisonSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'cms-comparison';
  readonly sectionTitle = 'CMS-Vergleich';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, context } = input;

    // Step 1: Query RAG for CMS requirements and existing data
    const ragResults = await this.queryRAG(leadId, undefined, {
      maxResults: 15,
      minConfidence: 25,
    });

    if (ragResults.length === 0) {
      throw new Error('No RAG data available for CMS comparison. Run a Deep Scan first.');
    }

    // Step 2: Build context from RAG chunks
    const ragContext = ragResults
      .map(
        (chunk, idx) =>
          `[Chunk ${idx + 1}] (Confidence: ${chunk.similarity.toFixed(0)}%, Agent: ${chunk.agentName || 'unknown'})\n${chunk.content}`
      )
      .join('\n\n');

    // Step 3: Generate CMS comparison analysis
    const systemPrompt = `You are an expert CMS consultant specializing in Drupal, WordPress, and modern CMS systems.

Compare available CMS options for this project and provide:
1. CMS Options - At least 2-3 viable options with pros/cons
2. Fit Scores - How well each CMS matches project requirements (0-100)
3. Cost Estimates - Implementation, licensing, and maintenance costs
4. Technical Fit - Scalability, flexibility, performance, security
5. Comparison Matrix - Structured comparison across key criteria
6. Recommendation - Primary and alternative choices with reasoning
7. Risks - Potential risks per CMS option with mitigation strategies

Consider:
- Project requirements (content volume, complexity, integrations)
- Current technology stack
- Budget constraints
- Industry-specific needs
- Team skills and experience
- Long-term maintenance and scalability

Be objective and data-driven. Drupal CMS 2.0 (Starshot) should be considered for modern Drupal projects.`;

    const userPrompt = `Lead ID: ${leadId}
User Context: ${context.userName} (${context.userRole})

=== RAG DATA CONTEXT START ===
${ragContext}
=== RAG DATA CONTEXT END ===

Analyze the project requirements and compare suitable CMS options.
Provide a clear recommendation with detailed reasoning.

Output must be valid JSON matching the schema.`;

    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse) as Record<string, unknown>;
    const comparisonOutput: CMSComparisonOutput = cmsComparisonOutputSchema.parse(rawResult);

    const confidence = this.calculateConfidence(ragResults);
    const sources = this.extractSources(ragResults);

    // Step 4: Save to database
    await this.saveSectionData(leadId, comparisonOutput, {
      agentName: 'cms-comparison-synthesizer',
      generatedAt: new Date(),
      sources,
      confidence,
    });

    return {
      success: true,
      sectionId: this.sectionId,
      content: comparisonOutput,
      metadata: {
        generatedAt: new Date(),
        agentName: 'cms-comparison-synthesizer',
        sources,
        confidence,
      },
    };
  }
}

// Singleton instance
export const cmsComparisonSynthesizer = new CMSComparisonSynthesizer();
