/**
 * Migration & Project Section Synthesizer
 *
 * Analyzes migration complexity, content migration requirements,
 * technical challenges, and estimated effort.
 */

import { z } from 'zod';

import type { SectionSynthesizerInput, SectionSynthesizerOutput } from './base';
import { SectionSynthesizerBase } from './base';

// ===== Zod Output Schema =====

const contentMigrationSchema = z.object({
  contentVolume: z.object({
    estimatedPages: z.number().optional(),
    estimatedAssets: z.number().optional(),
    estimatedUsers: z.number().optional(),
  }),

  contentTypes: z
    .array(
      z.object({
        type: z.string(),
        count: z.number().optional(),
        complexity: z.enum(['low', 'medium', 'high']),
        migrationApproach: z.string(),
      })
    )
    .describe('Content types to migrate'),

  dataMigration: z.object({
    strategy: z
      .enum(['automated', 'semi-automated', 'manual', 'hybrid'])
      .describe('Overall migration strategy'),
    tools: z.array(z.string()).optional().describe('Tools for migration'),
    estimatedEffort: z.string().optional().describe('PT estimate (e.g., "20-30 PT")'),
  }),

  dataQuality: z.object({
    assessment: z.string().describe('Assessment of current data quality'),
    cleanupRequired: z.boolean(),
    estimatedCleanupEffort: z.string().optional(),
  }),
});

const timelineSchema = z.object({
  totalDuration: z.string().describe('Total project duration (e.g., "6-8 months")'),

  phases: z
    .array(
      z.object({
        name: z.string(),
        duration: z.string(),
        description: z.string(),
        milestones: z.array(z.string()).optional(),
      })
    )
    .min(1),

  criticalPath: z.array(z.string()).describe('Critical path items that could delay project'),
});

const riskSchema = z.object({
  risk: z.string(),
  category: z.enum(['technical', 'data', 'timeline', 'budget', 'organizational', 'external']),
  likelihood: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  mitigation: z.string(),
  contingency: z.string().optional(),
});

const migrationOutputSchema = z.object({
  summary: z.string().min(50).describe('Executive summary of migration analysis'),

  migrationComplexity: z.object({
    overallScore: z.number().min(0).max(100).describe('Overall migration complexity (0-100)'),
    assessment: z.string().describe('Detailed assessment of migration complexity'),
    keyFactors: z
      .array(z.string())
      .min(1)
      .max(8)
      .describe('Key factors contributing to complexity'),
  }),

  contentMigration: contentMigrationSchema,

  technicalChallenges: z
    .array(
      z.object({
        challenge: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        solution: z.string(),
        estimatedEffort: z.string().optional(),
      })
    )
    .min(0)
    .max(10),

  migrationStrategy: z.object({
    approach: z
      .enum(['big-bang', 'phased', 'parallel', 'hybrid'])
      .describe('Overall migration approach'),
    reasoning: z.string().min(50),
    phases: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          dependencies: z.array(z.string()).optional(),
        })
      )
      .optional(),
  }),

  timeline: timelineSchema,

  risks: z.array(riskSchema).min(1).max(15).describe('Migration-specific risks'),

  successCriteria: z.array(z.string()).min(3).max(8).describe('Success criteria for migration'),

  estimatedTotalEffort: z.string().describe('Total PT for migration (e.g., "80-120 PT")'),

  recommendations: z
    .array(
      z.object({
        category: z.enum([
          'strategy',
          'technical',
          'organizational',
          'timeline',
          'risk-mitigation',
        ]),
        title: z.string(),
        description: z.string(),
        priority: z.enum(['low', 'medium', 'high', 'critical']),
      })
    )
    .min(1)
    .max(10),
});

type MigrationOutput = z.infer<typeof migrationOutputSchema>;

// ===== Synthesizer Implementation =====

export class MigrationSynthesizer extends SectionSynthesizerBase {
  readonly sectionId = 'migration';
  readonly sectionTitle = 'Migration & Projekt';

  async synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput> {
    const { leadId, context } = input;

    // Step 1: Query RAG for migration and project data
    const ragResults = await this.queryRAG(leadId, undefined, {
      maxResults: 20,
      minConfidence: 20,
    });

    if (ragResults.length === 0) {
      throw new Error('No RAG data available for migration analysis. Run a Deep Scan first.');
    }

    // Step 2: Build context from RAG chunks
    const ragContext = ragResults
      .map(
        (chunk, idx) =>
          `[Chunk ${idx + 1}] (Confidence: ${chunk.similarity.toFixed(0)}%, Agent: ${chunk.agentName || 'unknown'})\n${chunk.content}`
      )
      .join('\n\n');

    // Step 3: Generate migration analysis
    const systemPrompt = `You are an expert migration architect specializing in CMS migrations and complex digital transformations.

Analyze migration requirements and provide:
1. Migration Complexity - Overall score (0-100) with assessment and key factors
2. Content Migration - Volume, content types, data migration strategy, data quality
3. Technical Challenges - Specific challenges with severity, solutions, and effort
4. Migration Strategy - Approach (big-bang, phased, parallel, hybrid) with reasoning
5. Timeline - Total duration with phases, milestones, and critical path
6. Risks - Comprehensive risk assessment (technical, data, timeline, budget, org)
7. Success Criteria - Measurable criteria for migration success
8. Estimated Total Effort - Total PT for migration
9. Recommendations - Prioritized recommendations for strategy, technical, timeline, risks

Consider:
- Content volume and complexity
- Data quality and cleanup needs
- Technical dependencies and integrations
- Timeline constraints and budget
- Organizational change management
- Risk mitigation strategies

Be specific with effort estimates (e.g., "20-30 PT") and timeline (e.g., "6-8 months").`;

    const userPrompt = `Lead ID: ${leadId}
User Context: ${context.userName} (${context.userRole})

=== RAG DATA CONTEXT START ===
${ragContext}
=== RAG DATA CONTEXT END ===

Analyze the migration complexity and requirements based on the project data.
Provide a detailed migration strategy with timeline, risks, and recommendations.

Output must be valid JSON matching the schema.`;

    const responseText = await this.generateContent(userPrompt, systemPrompt, 0.3);

    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const rawResult = JSON.parse(cleanedResponse) as Record<string, unknown>;
    const migrationOutput: MigrationOutput = migrationOutputSchema.parse(rawResult);

    const confidence = this.calculateConfidence(ragResults);
    const sources = this.extractSources(ragResults);

    // Step 4: Save to database
    await this.saveSectionData(leadId, migrationOutput, {
      agentName: 'migration-synthesizer',
      generatedAt: new Date(),
      sources,
      confidence,
    });

    return {
      success: true,
      sectionId: this.sectionId,
      content: migrationOutput,
      metadata: {
        generatedAt: new Date(),
        agentName: 'migration-synthesizer',
        sources,
        confidence,
      },
    };
  }
}

// Singleton instance
export const migrationSynthesizer = new MigrationSynthesizer();
