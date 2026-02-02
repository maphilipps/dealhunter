/**
 * RAG Write Tool for AI SDK (Agent-Native RAG)
 *
 * Allows agents to store findings directly in the knowledge base
 * for other agents to discover via semantic search.
 *
 * This enables agent-native architecture where agents are responsible
 * for their own output rather than relying on a central orchestrator.
 */

import { tool } from 'ai';
import { z } from 'zod';

import { generateQueryEmbedding } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

export interface RagWriteToolContext {
  pitchId?: string;
  preQualificationId?: string;
  agentName: string;
}

// Zod schema for finding input
const findingSchema = z.object({
  category: z
    .enum(['fact', 'elaboration', 'recommendation', 'risk', 'estimate'])
    .describe('Type of finding'),
  chunkType: z
    .string()
    .describe(
      'Semantic type for filtering (e.g., "tech_stack", "performance", "migration_risk", "content_architecture")'
    ),
  content: z
    .string()
    .describe('The finding content - be specific and detailed for good semantic search'),
  confidence: z.number().min(0).max(100).describe('How confident are you in this finding (0-100)'),
  requiresValidation: z
    .boolean()
    .optional()
    .describe('Flag if this needs human review before acting on it'),
  metadata: z.object({}).passthrough().optional(),
});

type FindingInput = z.infer<typeof findingSchema>;

/**
 * Create a RAG write tool scoped to a specific deal
 *
 * Usage in agent:
 * ```typescript
 * const result = await streamText({
 *   model: 'claude-sonnet-4.5',
 *   tools: {
 *     store_finding: createRagWriteTool({
 *       preQualificationId: 'xyz',
 *       agentName: 'quick_scan'
 *     }),
 *   },
 *   prompt: 'Analyze the tech stack...'
 * });
 * ```
 */
export function createRagWriteTool(context: RagWriteToolContext) {
  if (!context.pitchId && !context.preQualificationId) {
    throw new Error('Either pitchId or preQualificationId must be provided');
  }

  return tool({
    description: `Store analysis finding in knowledge base for other agents to discover.

Use this to persist:
- Facts discovered during analysis (tech stack, page count, CMS version)
- Recommendations based on findings (migration approach, optimization suggestions)
- Risk assessments (security issues, accessibility problems, performance bottlenecks)
- Cost/time estimates (migration hours, effort breakdown)
- Elaborations on technical details (architecture decisions, component analysis)

Other agents can query these findings via the RAG search tool.
Each finding gets a vector embedding for semantic similarity search.

Examples:
- Category 'fact': "The website uses Drupal 9.5.11 with a custom theme"
- Category 'recommendation': "Consider using Drupal's Layout Builder for flexible page layouts"
- Category 'risk': "jQuery 1.x version has known security vulnerabilities"
- Category 'estimate': "Content migration estimated at 120 hours based on 450 pages"`,

    inputSchema: findingSchema,

    execute: async ({
      category,
      chunkType,
      content,
      confidence,
      requiresValidation,
      metadata,
    }: FindingInput) => {
      // Generate embedding for semantic search
      const embedding = await generateQueryEmbedding(content);

      // Count existing chunks of this type to determine index
      const existingChunks = await db.query.dealEmbeddings.findMany({
        where: (de, { and, eq }) =>
          and(
            context.pitchId
              ? eq(de.pitchId, context.pitchId)
              : eq(de.preQualificationId, context.preQualificationId!),
            eq(de.agentName, context.agentName),
            eq(de.chunkType, chunkType)
          ),
        columns: { chunkIndex: true },
      });

      const nextIndex =
        existingChunks.length > 0 ? Math.max(...existingChunks.map(c => c.chunkIndex)) + 1 : 0;

      await db.insert(dealEmbeddings).values({
        pitchId: context.pitchId ?? null,
        preQualificationId: context.preQualificationId ?? null,
        agentName: context.agentName,
        chunkType,
        chunkIndex: nextIndex,
        chunkCategory: category,
        content,
        confidence,
        requiresValidation: requiresValidation ?? false,
        embedding,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });

      return {
        success: true,
        message: `Stored ${category} finding [${chunkType}#${nextIndex}] in knowledge base`,
        chunkIndex: nextIndex,
      };
    },
  });
}

// Zod schema for batch findings input
const batchFindingsSchema = z.object({
  findings: z.array(findingSchema).min(1).max(20).describe('Array of findings to store (max 20)'),
});

type BatchFindingsInput = z.infer<typeof batchFindingsSchema>;

/**
 * Batch version for storing multiple findings at once
 * More efficient when an agent has multiple findings to persist
 */
export function createBatchRagWriteTool(context: RagWriteToolContext) {
  if (!context.pitchId && !context.preQualificationId) {
    throw new Error('Either pitchId or preQualificationId must be provided');
  }

  return tool({
    description: `Store multiple findings at once in the knowledge base.

Use this when you have several findings to persist - it's more efficient than multiple single calls.
Each finding will get its own embedding for semantic search.`,

    inputSchema: batchFindingsSchema,

    execute: async ({ findings }: BatchFindingsInput) => {
      // Generate embeddings for all findings in parallel
      const embeddings = await Promise.all(findings.map(f => generateQueryEmbedding(f.content)));

      // Get current chunk indices by type
      const existingChunks = await db.query.dealEmbeddings.findMany({
        where: (de, { and, eq }) =>
          and(
            context.pitchId
              ? eq(de.pitchId, context.pitchId)
              : eq(de.preQualificationId, context.preQualificationId!),
            eq(de.agentName, context.agentName)
          ),
        columns: { chunkType: true, chunkIndex: true },
      });

      // Build index map
      const indexMap = new Map<string, number>();
      for (const chunk of existingChunks) {
        const current = indexMap.get(chunk.chunkType) ?? -1;
        if (chunk.chunkIndex > current) {
          indexMap.set(chunk.chunkType, chunk.chunkIndex);
        }
      }

      // Prepare values with incremented indices
      const values = findings.map((finding, i) => {
        const currentMax = indexMap.get(finding.chunkType) ?? -1;
        const newIndex = currentMax + 1;
        indexMap.set(finding.chunkType, newIndex);

        return {
          pitchId: context.pitchId ?? null,
          preQualificationId: context.preQualificationId ?? null,
          agentName: context.agentName,
          chunkType: finding.chunkType,
          chunkIndex: newIndex,
          chunkCategory: finding.category,
          content: finding.content,
          confidence: finding.confidence,
          requiresValidation: finding.requiresValidation ?? false,
          embedding: embeddings[i],
          metadata: finding.metadata ? JSON.stringify(finding.metadata) : null,
        };
      });

      await db.insert(dealEmbeddings).values(values);

      return {
        success: true,
        message: `Stored ${findings.length} findings in knowledge base`,
        storedCount: findings.length,
      };
    },
  });
}
