/**
 * Expert Agent Base Infrastructure
 *
 * Shared utilities for all expert agents (Timing, Deliverables, TechStack, Legal, Summary).
 * Provides RAG query and result storage functionality.
 */

import { eq, and } from 'drizzle-orm';

import type { ExpertAgentOutput } from './types';

import { generateQueryEmbedding, isEmbeddingEnabled } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { queryRawChunks, type RawRAGResult } from '@/lib/rag/raw-retrieval-service';

/**
 * Query RFP document for relevant content using RAG
 *
 * @param rfpId - The RFP ID to query
 * @param query - The semantic query to search for
 * @param maxResults - Maximum number of results (default: 5)
 * @returns Array of relevant chunks sorted by similarity
 */
export async function queryRfpDocument(
  rfpId: string,
  query: string,
  maxResults: number = 5
): Promise<RawRAGResult[]> {
  return queryRawChunks({
    preQualificationId: rfpId,
    question: query,
    maxResults,
  });
}

/**
 * Store agent result in rfpEmbeddings table for cross-agent knowledge sharing
 *
 * @param rfpId - The RFP ID to associate with
 * @param agentName - Name of the agent storing the result
 * @param content - The text content to store (will be embedded)
 * @param metadata - Optional additional metadata
 * @returns Success status
 */
export async function storeAgentResult(
  rfpId: string,
  agentName: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!isEmbeddingEnabled()) {
    return { success: true };
  }

  try {
    const embedding = await generateQueryEmbedding(content);

    if (!embedding) {
      return {
        success: false,
        error: 'Failed to generate embedding for agent result',
      };
    }

    // Get next chunk index for this agent+rfp combination (unified dealEmbeddings table)
    const existingChunks = await db
      .select({ chunkIndex: dealEmbeddings.chunkIndex })
      .from(dealEmbeddings)
      .where(
        and(eq(dealEmbeddings.preQualificationId, rfpId), eq(dealEmbeddings.agentName, agentName))
      );

    const nextChunkIndex =
      existingChunks.length > 0 ? Math.max(...existingChunks.map(c => c.chunkIndex)) + 1 : 0;

    await db.insert(dealEmbeddings).values({
      preQualificationId: rfpId,
      qualificationId: null,
      agentName,
      chunkType: `${agentName}_result`,
      chunkIndex: nextChunkIndex,
      content,
      embedding: JSON.stringify(embedding),
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    return { success: true };
  } catch (error) {
    console.error(`[${agentName}] Failed to store result:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a standardized expert agent output wrapper
 *
 * @param data - The agent's analysis data
 * @param confidence - Confidence score (0-100)
 * @param error - Optional error message if failed
 * @returns Standardized ExpertAgentOutput
 */
export function createAgentOutput<T>(
  data: T | null,
  confidence: number,
  error?: string
): ExpertAgentOutput<T> {
  return {
    success: data !== null && !error,
    data,
    confidence,
    error,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Format RAG results into context for LLM prompts
 *
 * @param results - RAG query results
 * @param label - Optional section label
 * @returns Formatted context string
 */
export function formatContextFromRAG(results: RawRAGResult[], label?: string): string {
  if (results.length === 0) {
    return '';
  }

  const header = label ? `### ${label}\n\n` : '';
  const chunks = results
    .map(r => `[Relevanz: ${Math.round(r.similarity * 100)}%]\n${r.content}`)
    .join('\n\n---\n\n');

  return `${header}${chunks}`;
}
