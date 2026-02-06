/**
 * Lead RAG Retrieval Service (DEA-143)
 *
 * Extends the RAG retrieval service with lead-specific functionality:
 * - Lead → Qualification ID mapping
 * - Multi-agent query support
 * - Batch queries for section loading
 * - Confidence score aggregation
 * - Source tracking
 */

import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm';

import { generateQueryEmbedding } from './embedding-service';
import type { RAGResult } from './retrieval-service';

import { db } from '@/lib/db';
import type { ChunkCategory } from '@/lib/db/schema';
import { dealEmbeddings } from '@/lib/db/schema';
import { getRAGQueryTemplate } from '@/lib/pitches/navigation-config';

const SIMILARITY_THRESHOLD = 0.3; // text-embedding-3-large has lower similarity scores

export interface LeadRAGQuery {
  pitchId: string;
  sectionId?: string; // Optional: if provided, uses section's RAG template
  question: string;
  agentNameFilter?: string | string[]; // Filter by specific agent(s)
  maxResults?: number; // default: 5
  // Category-based filtering (DEA-140)
  chunkCategories?: ChunkCategory[]; // Filter by chunk category (fact, elaboration, etc.)
  minConfidence?: number; // Minimum confidence score (0-100)
  onlyValidated?: boolean; // Only return validated chunks
}

export interface LeadRAGResult extends RAGResult {
  sources: Array<{
    agentName: string;
    chunkId: string;
    chunkType: string;
    relevance: number;
  }>;
  // Category info (DEA-140)
  chunkCategory?: ChunkCategory | null;
  chunkConfidence?: number | null;
  isValidated?: boolean;
}

export interface SectionQueryResult {
  sectionId: string;
  results: LeadRAGResult[];
  confidence: number; // 0-100
  status: 'success' | 'no_data' | 'error';
  errorMessage?: string;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Query RAG knowledge base for a specific lead
 *
 * DIRECTLY queries lead_embeddings table (not rfp_embeddings)
 * because audit data is stored per lead, not per Qualification.
 *
 * @param query - Lead RAG query parameters
 * @returns Array of relevant chunks with source tracking
 */
export async function queryRagForLead(query: LeadRAGQuery): Promise<LeadRAGResult[]> {
  try {
    // 1. Build question from section template if sectionId provided
    let question = query.question;
    if (query.sectionId) {
      const template = getRAGQueryTemplate(query.sectionId);
      if (template) {
        question = query.question ? `${query.question}\n\nContext: ${template}` : template;
      }
    }

    console.log(
      `[Lead-RAG] Query for qualification ${query.pitchId}: "${question.substring(0, 50)}..."`
    );

    // 2. Build filter conditions
    const conditions = [eq(dealEmbeddings.pitchId, query.pitchId)];

    // Category filter (DEA-140)
    if (query.chunkCategories && query.chunkCategories.length > 0) {
      conditions.push(inArray(dealEmbeddings.chunkCategory, query.chunkCategories));
    }

    // Confidence filter (DEA-140)
    if (query.minConfidence !== undefined && query.minConfidence > 0) {
      conditions.push(gte(dealEmbeddings.confidence, query.minConfidence));
    }

    // Validated filter (DEA-140)
    if (query.onlyValidated) {
      conditions.push(isNotNull(dealEmbeddings.validatedAt));
    }

    // Fetch all chunks for this LEAD directly from lead_embeddings
    const chunks = await db
      .select()
      .from(dealEmbeddings)
      .where(and(...conditions));

    console.log(
      `[Lead-RAG] Found ${chunks.length} chunks in lead_embeddings` +
        (query.chunkCategories ? ` (categories: ${query.chunkCategories.join(', ')})` : '')
    );

    if (chunks.length === 0) {
      return [];
    }

    // 3. Try to generate query embedding for similarity ranking
    const queryEmbedding = await generateQueryEmbedding(question);

    let resultsWithSimilarity: Array<{
      chunkId: string;
      agentName: string;
      chunkType: string;
      content: string;
      similarity: number;
      metadata: Record<string, unknown>;
      // Category info (DEA-140)
      chunkCategory: ChunkCategory | null;
      confidence: number | null;
      validatedAt: Date | null;
    }>;

    if (queryEmbedding) {
      // 4a. Calculate similarity for each chunk (embedding-based)
      resultsWithSimilarity = chunks
        .filter(chunk => chunk.embedding !== null)
        .map(chunk => {
          const chunkEmbedding = chunk.embedding!;
          const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
          const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {};

          return {
            chunkId: chunk.id,
            agentName: chunk.agentName,
            chunkType: chunk.chunkType,
            content: chunk.content,
            similarity,
            metadata,
            // Category info (DEA-140)
            chunkCategory: chunk.chunkCategory,
            confidence: chunk.confidence,
            validatedAt: chunk.validatedAt,
          };
        })
        .filter(result => result.similarity > SIMILARITY_THRESHOLD);

      console.log(
        `[Lead-RAG] ${resultsWithSimilarity.length} chunks above threshold ${SIMILARITY_THRESHOLD}`
      );
    } else {
      // 4b. FALLBACK: No embeddings available, return all chunks with default similarity
      console.warn('[Lead-RAG] No embeddings available, using fallback (all chunks)');
      resultsWithSimilarity = chunks.map(chunk => {
        const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {};
        return {
          chunkId: chunk.id,
          agentName: chunk.agentName,
          chunkType: chunk.chunkType,
          content: chunk.content,
          similarity: 0.75, // Default similarity for fallback
          metadata,
          // Category info (DEA-140)
          chunkCategory: chunk.chunkCategory,
          confidence: chunk.confidence,
          validatedAt: chunk.validatedAt,
        };
      });
      console.log(`[Lead-RAG] Fallback: returning all ${resultsWithSimilarity.length} chunks`);
    }

    // 5. Filter by agent name if specified
    let filteredResults = resultsWithSimilarity;
    if (query.agentNameFilter) {
      const agentNames = Array.isArray(query.agentNameFilter)
        ? query.agentNameFilter
        : [query.agentNameFilter];

      filteredResults = resultsWithSimilarity.filter(result =>
        agentNames.includes(result.agentName)
      );

      if (filteredResults.length === 0) {
        console.warn(
          `[Lead-RAG] Agent filter [${agentNames.join(', ')}] yielded no results, falling back to all results`
        );
        filteredResults = resultsWithSimilarity;
      }
    }

    // 6. Sort by similarity DESC
    filteredResults.sort((a, b) => b.similarity - a.similarity);

    // 7. Limit results
    const maxResults = query.maxResults || 5;
    const limitedResults = filteredResults.slice(0, maxResults);

    // 8. Add source tracking and map category info
    const resultsWithSources: LeadRAGResult[] = limitedResults.map(result => ({
      chunkId: result.chunkId,
      agentName: result.agentName,
      chunkType: result.chunkType,
      content: result.content,
      similarity: result.similarity,
      metadata: result.metadata,
      sources: [
        {
          agentName: result.agentName,
          chunkId: result.chunkId,
          chunkType: result.chunkType,
          relevance: result.similarity,
        },
      ],
      // Category info (DEA-140) - map to interface fields
      chunkCategory: result.chunkCategory,
      chunkConfidence: result.confidence,
      isValidated: result.validatedAt !== null,
    }));

    return resultsWithSources;
  } catch (error) {
    console.error('[Lead-RAG] Query failed:', error);
    return [];
  }
}

/**
 * Batch query multiple sections in parallel
 *
 * Useful for loading multiple sections at once
 * Returns results grouped by section with confidence scores
 *
 * @param leadId - Lead ID
 * @param sectionIds - Array of section IDs to query
 * @param maxResultsPerSection - Max results per section (default: 5)
 * @returns Map of section ID to query results
 */
export async function batchQuerySections(
  leadId: string,
  sectionIds: string[],
  maxResultsPerSection: number = 5
): Promise<Map<string, SectionQueryResult>> {
  const results = new Map<string, SectionQueryResult>();

  // Run queries in parallel
  const queries = sectionIds.map(async sectionId => {
    try {
      // Get section template
      const template = getRAGQueryTemplate(sectionId);
      if (!template) {
        return {
          sectionId,
          result: {
            sectionId,
            results: [],
            confidence: 0,
            status: 'error' as const,
            errorMessage: `No RAG template found for section ${sectionId}`,
          },
        };
      }

      // Query RAG
      const queryResults = await queryRagForLead({
        pitchId: leadId,
        sectionId,
        question: template,
        maxResults: maxResultsPerSection,
      });

      // Calculate confidence score
      const confidence = calculateConfidenceScore(queryResults);

      return {
        sectionId,
        result: {
          sectionId,
          results: queryResults,
          confidence,
          status: queryResults.length > 0 ? ('success' as const) : ('no_data' as const),
        },
      };
    } catch (error) {
      console.error(`[Lead-RAG] Batch query failed for section ${sectionId}:`, error);
      return {
        sectionId,
        result: {
          sectionId,
          results: [],
          confidence: 0,
          status: 'error' as const,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  const allResults = await Promise.all(queries);

  for (const { sectionId, result } of allResults) {
    results.set(sectionId, result);
  }

  return results;
}

/**
 * Query multiple agents for the same question
 *
 * Useful for getting diverse perspectives on the same topic
 *
 * @param leadId - Lead ID
 * @param question - Question to ask
 * @param agentNames - Array of agent names to query
 * @param maxResultsPerAgent - Max results per agent (default: 3)
 * @returns Combined results grouped by agent
 */
export async function queryMultipleAgents(
  leadId: string,
  question: string,
  agentNames: string[],
  maxResultsPerAgent: number = 3
): Promise<Map<string, LeadRAGResult[]>> {
  const results = new Map<string, LeadRAGResult[]>();

  // Run queries in parallel
  const queries = agentNames.map(async agentName => {
    const agentResults = await queryRagForLead({
      pitchId: leadId,
      question,
      agentNameFilter: agentName,
      maxResults: maxResultsPerAgent,
    });
    return { agentName, results: agentResults };
  });

  const allResults = await Promise.all(queries);

  for (const { agentName, results: agentResults } of allResults) {
    results.set(agentName, agentResults);
  }

  return results;
}

/**
 * Calculate confidence score based on query results
 *
 * Confidence factors:
 * - Number of results (more results = higher confidence)
 * - Average similarity score (higher similarity = higher confidence)
 * - Result diversity (multiple agents = higher confidence)
 *
 * @param results - Query results
 * @returns Confidence score (0-100)
 */
export function calculateConfidenceScore(results: LeadRAGResult[]): number {
  if (results.length === 0) {
    return 0;
  }

  // Factor 1: Result count (0-40 points)
  // 1 result = 20 points, 5+ results = 40 points
  const countScore = Math.min(40, (results.length / 5) * 40);

  // Factor 2: Average similarity (0-40 points)
  // Average similarity directly mapped to points (0.0-1.0 → 0-40)
  const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
  const similarityScore = avgSimilarity * 40;

  // Factor 3: Agent diversity (0-20 points)
  // More unique agents = higher confidence
  const uniqueAgents = new Set(results.map(r => r.agentName)).size;
  const diversityScore = Math.min(20, (uniqueAgents / 3) * 20);

  const totalScore = countScore + similarityScore + diversityScore;

  return Math.round(Math.min(100, totalScore));
}

/**
 * Get aggregated sources from multiple results
 *
 * Deduplicates and ranks sources by relevance
 *
 * @param results - Query results
 * @returns Sorted array of unique sources
 */
export function aggregateSources(results: LeadRAGResult[]): Array<{
  agentName: string;
  chunkId: string;
  chunkType: string;
  relevance: number;
}> {
  const sourceMap = new Map<
    string,
    {
      agentName: string;
      chunkId: string;
      chunkType: string;
      relevance: number;
    }
  >();

  for (const result of results) {
    for (const source of result.sources) {
      // Use chunkId as key for deduplication
      const existingSource = sourceMap.get(source.chunkId);

      // Keep the highest relevance score if duplicate
      if (!existingSource || source.relevance > existingSource.relevance) {
        sourceMap.set(source.chunkId, source);
      }
    }
  }

  // Sort by relevance descending
  return Array.from(sourceMap.values()).sort((a, b) => b.relevance - a.relevance);
}

/**
 * Format results into a context string for AI prompts
 *
 * @param results - Query results
 * @param includeMetadata - Whether to include agent/chunk metadata
 * @returns Formatted context string
 */
export function formatLeadContext(
  results: LeadRAGResult[],
  includeMetadata: boolean = false
): string {
  if (results.length === 0) {
    return '';
  }

  return results
    .map(result => {
      const metadataPrefix = includeMetadata
        ? `[Agent: ${result.agentName} | Type: ${result.chunkType} | Relevance: ${Math.round(result.similarity * 100)}%]\n`
        : '';

      return `${metadataPrefix}${result.content}`;
    })
    .join('\n\n---\n\n');
}
