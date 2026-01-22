/**
 * Lead RAG Retrieval Service (DEA-143)
 *
 * Extends the RAG retrieval service with lead-specific functionality:
 * - Lead → RFP ID mapping
 * - Multi-agent query support
 * - Batch queries for section loading
 * - Confidence score aggregation
 * - Source tracking
 */

import { eq } from 'drizzle-orm';

import { queryRAG, type RAGQuery, type RAGResult } from './retrieval-service';

import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getRAGQueryTemplate } from '@/lib/leads/navigation-config';

export interface LeadRAGQuery {
  leadId: string;
  sectionId?: string; // Optional: if provided, uses section's RAG template
  question: string;
  agentNameFilter?: string | string[]; // Filter by specific agent(s)
  maxResults?: number; // default: 5
}

export interface LeadRAGResult extends RAGResult {
  sources: Array<{
    agentName: string;
    chunkId: string;
    chunkType: string;
    relevance: number;
  }>;
}

export interface SectionQueryResult {
  sectionId: string;
  results: LeadRAGResult[];
  confidence: number; // 0-100
  status: 'success' | 'no_data' | 'error';
  errorMessage?: string;
}

/**
 * Query RAG knowledge base for a specific lead
 *
 * Maps Lead ID → RFP ID and performs RAG query
 * Optionally filters by section and agent name
 *
 * @param query - Lead RAG query parameters
 * @returns Array of relevant chunks with source tracking
 */
export async function queryRagForLead(query: LeadRAGQuery): Promise<LeadRAGResult[]> {
  try {
    // 1. Map Lead → RFP ID
    const lead = await db.select({ rfpId: leads.rfpId }).from(leads).where(eq(leads.id, query.leadId));

    if (lead.length === 0) {
      console.warn(`[Lead-RAG] Lead ${query.leadId} not found`);
      return [];
    }

    const rfpId = lead[0].rfpId;

    // 2. Build question from section template if sectionId provided
    let question = query.question;
    if (query.sectionId) {
      const template = getRAGQueryTemplate(query.sectionId);
      if (template) {
        // If question is empty, use template; otherwise append template context
        question = query.question ? `${query.question}\n\nContext: ${template}` : template;
      }
    }

    // 3. Perform RAG query
    const ragQuery: RAGQuery = {
      rfpId,
      question,
      maxResults: query.maxResults,
    };

    const results = await queryRAG(ragQuery);

    // 4. Filter by agent name if specified
    let filteredResults = results;
    if (query.agentNameFilter) {
      const agentNames = Array.isArray(query.agentNameFilter)
        ? query.agentNameFilter
        : [query.agentNameFilter];

      filteredResults = results.filter((result) => agentNames.includes(result.agentName));

      // If agent filter yields no results, fall back to all results
      if (filteredResults.length === 0) {
        console.warn(
          `[Lead-RAG] Agent filter [${agentNames.join(', ')}] yielded no results, falling back to all results`
        );
        filteredResults = results;
      }
    }

    // 5. Add source tracking
    const resultsWithSources: LeadRAGResult[] = filteredResults.map((result) => ({
      ...result,
      sources: [
        {
          agentName: result.agentName,
          chunkId: result.chunkId,
          chunkType: result.chunkType,
          relevance: result.similarity,
        },
      ],
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
  const queries = sectionIds.map(async (sectionId) => {
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
        leadId,
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
  const queries = agentNames.map(async (agentName) => {
    const agentResults = await queryRagForLead({
      leadId,
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
  const uniqueAgents = new Set(results.map((r) => r.agentName)).size;
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
export function aggregateSources(
  results: LeadRAGResult[]
): Array<{
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
export function formatLeadContext(results: LeadRAGResult[], includeMetadata: boolean = false): string {
  if (results.length === 0) {
    return '';
  }

  return results
    .map((result) => {
      const metadataPrefix = includeMetadata
        ? `[Agent: ${result.agentName} | Type: ${result.chunkType} | Relevance: ${Math.round(result.similarity * 100)}%]\n`
        : '';

      return `${metadataPrefix}${result.content}`;
    })
    .join('\n\n---\n\n');
}
