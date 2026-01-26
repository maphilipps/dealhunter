import { eq } from 'drizzle-orm';

import type { AuditRagWriteTools, FindingInput, VisualizationInput } from './experts/types';

import {
  createBatchRagWriteTool,
  createRagWriteTool,
  createVisualizationWriteTool,
} from '@/lib/agent-tools';
import { generateQueryEmbedding } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

/**
 * Create RAG Write Tools for a specific deep scan expert
 * Allows experts to store findings and visualizations directly
 */
export function createExpertRagTools(
  qualificationId: string,
  expertName: string
): AuditRagWriteTools {
  const agentName = `audit_${expertName}_expert`;

  return {
    // Store a single finding
    storeFinding: async (input: FindingInput) => {
      const embedding = await generateQueryEmbedding(input.content);

      const existingChunks = await db.query.dealEmbeddings.findMany({
        where: (de, { and, eq }) =>
          and(
            eq(de.qualificationId, qualificationId),
            eq(de.agentName, agentName),
            eq(de.chunkType, input.chunkType)
          ),
        columns: { chunkIndex: true },
      });

      const nextIndex =
        existingChunks.length > 0
          ? Math.max(...existingChunks.map(c => c.chunkIndex)) + 1
          : 0;

      await db.insert(dealEmbeddings).values({
        qualificationId,
        preQualificationId: null,
        agentName,
        chunkType: input.chunkType,
        chunkIndex: nextIndex,
        chunkCategory: input.category,
        content: input.content,
        confidence: input.confidence,
        requiresValidation: input.requiresValidation ?? false,
        embedding,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      });

      return {
        success: true,
        message: `Stored ${input.category} finding [${input.chunkType}#${nextIndex}]`,
      };
    },

    // Store a visualization
    storeVisualization: async (input: VisualizationInput) => {
      await db.insert(dealEmbeddings).values({
        qualificationId,
        preQualificationId: null,
        agentName,
        chunkType: 'visualization',
        chunkIndex: 0,
        chunkCategory: 'elaboration',
        content: JSON.stringify(input.visualization),
        confidence: input.confidence,
        embedding: null,
        metadata: JSON.stringify({
          sectionId: input.sectionId,
          isVisualization: true,
          elementCount: Object.keys(input.visualization.elements).length,
        }),
      });

      return {
        success: true,
        message: `Stored visualization for section "${input.sectionId}"`,
        sectionId: input.sectionId,
      };
    },

    // Batch store findings
    storeFindingsBatch: async (findings: FindingInput[]) => {
      const embeddings = await Promise.all(findings.map(f => generateQueryEmbedding(f.content)));

      const existingChunks = await db.query.dealEmbeddings.findMany({
        where: (de, { and, eq }) =>
          and(eq(de.qualificationId, qualificationId), eq(de.agentName, agentName)),
        columns: { chunkType: true, chunkIndex: true },
      });

      const indexMap = new Map<string, number>();
      for (const chunk of existingChunks) {
        const current = indexMap.get(chunk.chunkType) ?? -1;
        if (chunk.chunkIndex > current) {
          indexMap.set(chunk.chunkType, chunk.chunkIndex);
        }
      }

      const values = findings.map((finding, i) => {
        const currentMax = indexMap.get(finding.chunkType) ?? -1;
        const newIndex = currentMax + 1;
        indexMap.set(finding.chunkType, newIndex);

        return {
          qualificationId,
          preQualificationId: null,
          agentName,
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
        message: `Stored ${findings.length} findings`,
        storedCount: findings.length,
      };
    },

    aiTools: {
      storeFinding: createRagWriteTool({ qualificationId, agentName }),
      storeVisualization: createVisualizationWriteTool({ qualificationId, agentName }),
      storeFindingsBatch: createBatchRagWriteTool({ qualificationId, agentName }),
    },
  };
}
