/**
 * Hosting & Infrastructure Section Synthesizer
 *
 * Analyzes current and recommended hosting infrastructure including requirements,
 * costs, and technical constraints.
 */

import { z } from 'zod';

import type { SectionSynthesizerInput, SectionSynthesizerOutput } from './base';
import { SectionSynthesizerBase } from './base';

// ===== Zod Output Schema =====

const currentHostingSchema = z.object({
  provider: z.string().optional(),
  type: z.enum(['shared', 'vps', 'dedicated', 'cloud', 'managed', 'unknown']).optional(),
  location: z.string().optional(),
  assessment: z.string().describe('Assessment of current hosting setup'),
  limitations: z.array(z.string()).min(0).max(5),
});

const hostingRequirementsSchema = z.object({
  estimatedTraffic: z.string().optional().describe('Expected monthly visitors/page views'),
  storageNeeds: z.string().optional().describe('Estimated storage requirements'),
  bandwidthNeeds: z.string().optional(),
  scalabilityRequirements: z.enum(['low', 'medium', 'high', 'very-high']),
  availabilityTarget: z.string().optional().describe('Uptime SLA target (e.g., 99.9%)'),
  securityRequirements: z
    .array(z.string())
    .optional()
    .describe('Security and compliance requirements'),
});

const hostingOptionSchema = z.object({
  name: z.string().min(1),
  provider: z.string(),
  type: z.enum(['shared', 'vps', 'dedicated', 'cloud', 'managed', 'paas']),
  description: z.string().min(20),

  technicalSpecs: z.object({
    cpu: z.string().optional(),
    memory: z.string().optional(),
    storage: z.string().optional(),
    bandwidth: z.string().optional(),
  }),

  costEstimate: z.object({
    setup: z.string().optional(),
    monthly: z.string(),
    annual: z.string().optional(),
  }),

  strengths: z.array(z.string()).min(2).max(6),
  weaknesses: z.array(z.string()).min(1).max(6),

  fitScore: z.number().min(0).max(100).describe('How well this option fits requirements'),

  scalability: z.enum(['poor', 'adequate', 'good', 'excellent']),
  performance: z.enum(['poor', 'adequate', 'good', 'excellent']),
  security: z.enum(['poor', 'adequate', 'good', 'excellent']),
});

const hostingOutputSchema = z.object({
  summary: z.string().min(50).describe('Executive summary of hosting analysis'),

  currentHosting: currentHostingSchema.optional(),

  requirements: hostingRequirementsSchema,

  hostingOptions: z.array(hostingOptionSchema).min(1).max(5).describe('Analyzed hosting options'),

  recommendation: z.object({
    primaryChoice: z.string().describe('Recommended hosting solution'),
    reasoning: z.string().min(50).describe('Reasoning for recommendation'),
    alternativeChoice: z.string().optional(),
    migrationComplexity: z.enum(['low', 'medium', 'high']),
  }),

  azureArchitecture: z
    .object({
      isRecommended: z.boolean(),
      architecture: z
        .string()
        .optional()
        .describe('Recommended Azure architecture (if applicable)'),
      services: z.array(z.string()).optional().describe('Required Azure services'),
      estimatedMonthlyCost: z.string().optional(),
    })
    .optional(),

  highScaleConsiderations: z
    .object({
      isRequired: z.boolean(),
      strategies: z.array(z.string()).optional().describe('Scaling strategies for high traffic'),
      cdnRecommendation: z.string().optional(),
      cachingStrategy: z.string().optional(),
    })
    .optional(),

  technicalRisks: z
    .array(
      z.object({
        risk: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        mitigation: z.string(),
      })
    )
    .min(0)
    .max(8),

  complianceRequirements: z
    .array(z.string())
    .optional()
    .describe('Compliance standards to meet (GDPR, ISO, etc.)'),
});

type HostingOutput = z.infer<typeof hostingOutputSchema>;

// ===== Synthesizer Implementation =====

export class HostingSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'hosting';
  readonly sectionTitle = 'Hosting & Infrastruktur';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, context } = input;

    // Step 1: Query RAG for hosting and infrastructure data
    const ragResults = await this.queryRAG(leadId, undefined, {
      maxResults: 15,
      minConfidence: 20,
    });

    if (ragResults.length === 0) {
      throw new Error('No RAG data available for hosting analysis. Run a Deep Scan first.');
    }

    // Step 2: Build context from RAG chunks
    const ragContext = ragResults
      .map(
        (chunk, idx) =>
          `[Chunk ${idx + 1}] (Confidence: ${chunk.similarity.toFixed(0)}%, Agent: ${chunk.agentName || 'unknown'})\n${chunk.content}`
      )
      .join('\n\n');

    // Step 3: Generate hosting analysis
    const systemPrompt = `You are an expert infrastructure architect specializing in web hosting and cloud infrastructure.

Analyze hosting requirements and provide:
1. Current Hosting Assessment - Analyze current setup if detected
2. Requirements - Define hosting requirements (traffic, storage, scalability, security)
3. Hosting Options - Compare 2-4 suitable options with specs and costs
4. Recommendation - Primary and alternative choices with reasoning
5. Azure Architecture - If Azure is suitable, provide architecture details
6. High-Scale Considerations - Scaling strategies, CDN, caching for high traffic
7. Technical Risks - Infrastructure risks with mitigation strategies
8. Compliance - Required compliance standards (GDPR, ISO, etc.)

Consider:
- Project scale and growth trajectory
- Budget constraints
- Technical requirements (CMS, frameworks, databases)
- Security and compliance needs
- Team expertise and support requirements

Be specific with costs (e.g., "€500-800/month") and technical specs.`;

    const userPrompt = `Lead ID: ${leadId}
User Context: ${context.userName} (${context.userRole})

=== RAG DATA CONTEXT START ===
${ragContext}
=== RAG DATA CONTEXT END ===

Analyze hosting requirements based on the project data.
Provide detailed hosting options with cost estimates and a clear recommendation.

Output must be valid JSON matching the schema.`;

    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse);
    const hostingOutput: HostingOutput = hostingOutputSchema.parse(rawResult);

    const confidence = this.calculateConfidence(ragResults);
    const sources = this.extractSources(ragResults);

    // Step 4: Save to database
    await this.saveSectionData(leadId, hostingOutput, {
      agentName: 'hosting-synthesizer',
      generatedAt: new Date(),
      sources,
      confidence,
    });

    return {
      success: true,
      sectionId: this.sectionId,
      content: hostingOutput,
      metadata: {
        generatedAt: new Date(),
        agentName: 'hosting-synthesizer',
        sources,
        confidence,
      },
    };
  }
}

// Singleton instance
export const hostingSynthesizer = new HostingSynthesizer();
