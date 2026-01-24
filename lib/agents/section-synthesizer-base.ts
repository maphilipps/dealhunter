/**
 * Section Synthesizer Base Class
 *
 * Abstract base for all section synthesizers.
 * Provides common functionality for RAG querying, content generation, and confidence calculation.
 *
 * Phase 4.3: Audit-Aware
 * - Detects if audit data exists for the lead
 * - Prioritizes audit data in RAG queries (1.2x similarity boost)
 * - Indicates audit data usage in result metadata
 */

import { generateText } from 'ai';

import { openai } from '@/lib/ai/providers';
import { queryRagForLead, type LeadRAGResult } from '@/lib/rag/lead-retrieval-service';

const AUDIT_AGENT_NAME = 'audit_ingestion';
const AUDIT_SIMILARITY_BOOST = 1.2; // Boost audit data similarity by 20%

/**
 * Section Result
 */
export interface SectionResult {
  sectionId: string;
  content: unknown; // JSON content (validated by subclass schema)
  metadata: {
    generatedAt: Date;
    agentName: string;
    sources: Array<{ text: string; score: number }>;
    confidence: number;
    hasAuditData?: boolean; // Phase 4.3: Indicates if audit data was available
    auditChunksUsed?: number; // Phase 4.3: Number of audit chunks used
  };
}

/**
 * Abstract Section Synthesizer Base
 */
export abstract class SectionSynthesizerBase {
  abstract sectionId: string;
  abstract synthesize(leadId: string): Promise<SectionResult>;

  /**
   * Check if lead has audit data in RAG
   */
  protected async checkAuditDataAvailable(leadId: string): Promise<boolean> {
    const { hasAuditData } = await import('@/lib/audit/audit-rag-ingestion');
    return hasAuditData(leadId);
  }

  /**
   * Query RAG system for lead-specific context
   *
   * Phase 4.3: Audit-Aware
   * - Queries both regular and audit data
   * - Boosts audit data similarity scores
   * - Prioritizes audit data when available
   */
  protected async queryRAG(
    leadId: string,
    question: string,
    options?: { prioritizeAudit?: boolean }
  ): Promise<LeadRAGResult[]> {
    const prioritizeAudit = options?.prioritizeAudit ?? true;

    // Query all RAG data for this lead
    const results = await queryRagForLead({
      leadId,
      question,
      maxResults: 15, // Fetch more to allow for audit prioritization
    });

    if (!prioritizeAudit) {
      return results.slice(0, 10);
    }

    // Phase 4.3: Boost audit data similarity scores
    const boostedResults = results.map(result => {
      if (result.agentName === AUDIT_AGENT_NAME) {
        // Boost audit data similarity (capped at 1.0)
        return {
          ...result,
          similarity: Math.min(1.0, result.similarity * AUDIT_SIMILARITY_BOOST),
        };
      }
      return result;
    });

    // Re-sort by boosted similarity
    boostedResults.sort((a, b) => b.similarity - a.similarity);

    // Return top 10 results
    return boostedResults.slice(0, 10);
  }

  /**
   * Count audit chunks in RAG results
   */
  protected countAuditChunks(results: LeadRAGResult[]): number {
    return results.filter(r => r.agentName === AUDIT_AGENT_NAME).length;
  }

  /**
   * Generate content using AI
   */
  protected async generateContent(
    userPrompt: string,
    systemPrompt: string,
    temperature = 0.3
  ): Promise<string> {
    const result = await generateText({
      model: openai('gpt-4o-2024-11-20'),
      temperature,
      maxRetries: 2,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return result.text;
  }

  /**
   * Calculate confidence based on RAG results
   */
  protected calculateConfidence(ragResults: LeadRAGResult[]): number {
    if (ragResults.length === 0) return 0.5;

    // Average similarity of top 5 results
    const topResults = ragResults.slice(0, 5);
    const avgScore = topResults.reduce((sum, r) => sum + r.similarity, 0) / topResults.length;

    // Normalize to 0-1 range (similarity is typically 0-1)
    return Math.min(Math.max(avgScore, 0), 1);
  }

  /**
   * Extract sources from RAG results
   */
  protected extractSources(ragResults: LeadRAGResult[]): Array<{ text: string; score: number }> {
    return ragResults.slice(0, 5).map(r => ({
      text: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
      score: r.similarity,
    }));
  }
}
