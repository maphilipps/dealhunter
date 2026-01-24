/**
 * Integrations Section Synthesizer
 *
 * Analyzes third-party integrations currently in use or required for the project.
 */

import { z } from 'zod';

import type { SectionSynthesizerInput, SectionSynthesizerOutput } from './base';
import { SectionSynthesizerBase } from './base';

// ===== Zod Output Schema =====

const integrationSchema = z.object({
  name: z.string().min(1),
  category: z.enum([
    'crm',
    'marketing-automation',
    'analytics',
    'payment',
    'erp',
    'dam',
    'search',
    'cdn',
    'social-media',
    'email',
    'authentication',
    'other',
  ]),
  description: z.string().min(10),
  status: z
    .enum(['current', 'required', 'recommended', 'optional'])
    .describe('Whether integration exists, is required, or recommended'),

  technicalDetails: z.object({
    integrationMethod: z
      .enum(['api', 'webhook', 'plugin', 'custom', 'saas', 'embedded'])
      .optional(),
    dataFlow: z.enum(['unidirectional', 'bidirectional', 'event-driven']).optional(),
    frequency: z.enum(['realtime', 'periodic', 'batch', 'on-demand']).optional(),
  }),

  complexity: z.enum(['low', 'medium', 'high', 'very-high']),
  estimatedEffort: z.string().optional().describe('PT estimation (e.g., "5-8 PT")'),

  costs: z
    .object({
      setup: z.string().optional(),
      monthly: z.string().optional(),
      annual: z.string().optional(),
    })
    .optional(),

  dependencies: z
    .array(z.string())
    .optional()
    .describe('Other integrations or systems this depends on'),

  risks: z.array(z.string()).min(0).max(5).describe('Integration-specific risks'),
});

const systemLandscapeSchema = z.object({
  description: z.string().describe('Overview of the complete system landscape'),
  coreSystemsCount: z.number().min(0),
  integrationComplexity: z.enum(['low', 'medium', 'high', 'very-high']),
  dataFlowDiagram: z.string().optional().describe('Textual description of data flows'),
});

const integrationsOutputSchema = z.object({
  summary: z.string().min(50).describe('Executive summary of integrations landscape'),

  systemLandscape: systemLandscapeSchema,

  integrations: z
    .array(integrationSchema)
    .min(0)
    .describe('List of all integrations (current, required, recommended)'),

  integrationsByCategory: z
    .record(z.string(), z.number())
    .describe('Count of integrations per category'),

  criticalIntegrations: z.array(z.string()).describe('Names of business-critical integrations'),

  implementationPriority: z
    .array(
      z.object({
        integrationName: z.string(),
        priority: z.enum(['p0', 'p1', 'p2', 'p3']),
        reasoning: z.string(),
      })
    )
    .describe('Prioritized implementation order'),

  architecturalRecommendations: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        benefit: z.string(),
      })
    )
    .min(1)
    .max(5),

  totalComplexityScore: z
    .number()
    .min(0)
    .max(100)
    .describe('Overall integration complexity (0-100)'),

  estimatedTotalEffort: z
    .string()
    .optional()
    .describe('Total PT for all integrations (e.g., "40-60 PT")'),

  risks: z
    .array(
      z.object({
        risk: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        affectedIntegrations: z.array(z.string()).optional(),
        mitigation: z.string(),
      })
    )
    .min(0)
    .max(10),
});

type IntegrationsOutput = z.infer<typeof integrationsOutputSchema>;

// ===== Synthesizer Implementation =====

export class IntegrationsSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'integrations';
  readonly sectionTitle = 'Integrationen';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, context } = input;

    // Step 1: Query RAG for integrations data
    const ragResults = await this.queryRAG(leadId, undefined, {
      maxResults: 15,
      minConfidence: 20,
    });

    if (ragResults.length === 0) {
      throw new Error('No RAG data available for integrations analysis. Run a Deep Scan first.');
    }

    // Step 2: Build context from RAG chunks
    const ragContext = ragResults
      .map(
        (chunk, idx) =>
          `[Chunk ${idx + 1}] (Confidence: ${chunk.similarity.toFixed(0)}%, Agent: ${chunk.agentName || 'unknown'})\n${chunk.content}`
      )
      .join('\n\n');

    // Step 3: Generate integrations analysis
    const systemPrompt = `You are an expert integration architect specializing in enterprise system integration.

Analyze third-party integrations and provide:
1. System Landscape - Overview of the complete integration landscape
2. Integrations List - Current, required, and recommended integrations with details
3. Integration Details - Category, complexity, effort, costs, technical details
4. Integrations by Category - Count per category (CRM, Marketing, Analytics, etc.)
5. Critical Integrations - Business-critical systems
6. Implementation Priority - Prioritized order (P0-P3) with reasoning
7. Architectural Recommendations - Best practices for integration architecture
8. Total Complexity Score - Overall integration complexity (0-100)
9. Estimated Total Effort - Total PT for all integrations
10. Risks - Integration-specific risks with mitigation

Consider:
- Business requirements and criticality
- Technical complexity and data flows
- Costs (setup, monthly, annual)
- Dependencies between integrations
- Security and compliance requirements

Be specific with effort estimates and prioritization.`;

    const userPrompt = `Lead ID: ${leadId}
User Context: ${context.userName} (${context.userRole})

=== RAG DATA CONTEXT START ===
${ragContext}
=== RAG DATA CONTEXT END ===

Analyze the integration requirements based on the project data.
Identify current integrations (if detected) and recommend required/optional integrations.

Output must be valid JSON matching the schema.`;

    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse);
    const integrationsOutput: IntegrationsOutput = integrationsOutputSchema.parse(rawResult);

    const confidence = this.calculateConfidence(ragResults);
    const sources = this.extractSources(ragResults);

    // Step 4: Save to database
    await this.saveSectionData(leadId, integrationsOutput, {
      agentName: 'integrations-synthesizer',
      generatedAt: new Date(),
      sources,
      confidence,
    });

    return {
      success: true,
      sectionId: this.sectionId,
      content: integrationsOutput,
      metadata: {
        generatedAt: new Date(),
        agentName: 'integrations-synthesizer',
        sources,
        confidence,
      },
    };
  }
}

// Singleton instance
export const integrationsSynthesizer = new IntegrationsSynthesizer();
