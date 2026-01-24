/**
 * Section Synthesizer Base Class (Sprint 1.3)
 *
 * Abstract base class for section-specific content synthesizers.
 * Each Lead section (overview, technology, website-analysis, etc.) has a dedicated
 * synthesizer that extends this base class.
 *
 * Workflow:
 * 1. Query RAG for lead-specific data
 * 2. Generate structured content via AI
 * 3. Save to qualificationSectionData table
 *
 * Pattern: Template Method - Base class defines workflow, subclasses implement specifics.
 */

import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

import type { ToolContext } from '@/lib/agent-tools/types';
import { db } from '@/lib/db';
import { qualificationSectionData } from '@/lib/db/schema';
import { getRAGQueryTemplate } from '@/lib/qualifications/navigation-config';
import {
  queryRagForLead,
  type LeadRAGQuery,
  type LeadRAGResult,
} from '@/lib/rag/lead-retrieval-service';

// Lazy-initialized OpenAI client
let openaiInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
    });
  }
  return openaiInstance;
}

// ========================================
// Types
// ========================================

export interface SectionSynthesizerInput {
  leadId: string;
  context: ToolContext;
  forceRegenerate?: boolean; // Force regeneration even if data exists
}

export interface SectionSynthesizerOutput {
  success: boolean;
  sectionId: string;
  content?: unknown; // Section-specific structured data
  confidence?: number; // 0-100
  error?: string;
  metadata?: SectionMetadata;
}

export interface SectionMetadata {
  generatedAt: Date; // Will be mapped to createdAt in DB
  agentName: string; // Will be stored in sources JSON in DB
  sources: Array<{
    agentName: string;
    chunkId: string;
    relevance: number;
  }>;
  confidence: number;
}

export interface RAGQueryOptions {
  maxResults?: number;
  agentNameFilter?: string | string[];
  minConfidence?: number;
}

// ========================================
// Abstract Base Class
// ========================================

/**
 * Abstract base class for section synthesizers
 *
 * Subclasses must implement:
 * - sectionId: Unique section identifier (e.g., 'technology', 'overview')
 * - sectionTitle: Human-readable section name
 * - synthesize(): Core synthesis logic
 */
export abstract class SectionSynthesizerBase {
  /**
   * Unique section identifier (e.g., 'technology', 'website-analysis')
   * Must match IDs in QUALIFICATION_NAVIGATION_SECTIONS
   */
  abstract readonly sectionId: string;

  /**
   * Human-readable section name (e.g., 'Aktuelle Technologie')
   */
  abstract readonly sectionTitle: string;

  /**
   * Core synthesis logic - must be implemented by subclass
   *
   * @param input - Contains leadId, context, and options
   * @returns Structured section data or error
   */
  abstract synthesize(input: SectionSynthesizerInput): Promise<SectionSynthesizerOutput>;

  // ========================================
  // Protected Helper Methods
  // ========================================

  /**
   * Query RAG for lead-specific data
   *
   * Uses section's RAG query template from navigation config
   * or custom question.
   *
   * @param leadId - Lead ID
   * @param customQuestion - Optional custom query (overrides template)
   * @param options - RAG query options
   * @returns Array of RAG results sorted by relevance
   */
  protected async queryRAG(
    leadId: string,
    customQuestion?: string,
    options?: RAGQueryOptions
  ): Promise<LeadRAGResult[]> {
    // Get default query template from navigation config
    const defaultTemplate = getRAGQueryTemplate(this.sectionId);
    const question =
      customQuestion || defaultTemplate || `Provide information for ${this.sectionId}`;

    const query: LeadRAGQuery = {
      qualificationId: leadId,
      sectionId: this.sectionId,
      question,
      maxResults: options?.maxResults || 10,
      agentNameFilter: options?.agentNameFilter,
      minConfidence: options?.minConfidence || 30,
    };

    const results = await queryRagForLead(query);

    // Sort by relevance (similarity score)
    return results.sort((a: LeadRAGResult, b: LeadRAGResult) => b.similarity - a.similarity);
  }

  /**
   * Generate content using AI
   *
   * @param userPrompt - User prompt with context and instructions
   * @param systemPrompt - Optional system prompt (defaults to adesso expert prompt)
   * @param temperature - AI temperature (default: 0.3 for structured output)
   * @returns AI-generated content as string
   */
  protected async generateContent(
    userPrompt: string,
    systemPrompt?: string,
    temperature = 0.3
  ): Promise<string> {
    const openai = getOpenAIClient();

    const defaultSystemPrompt = `Du bist ein erfahrener Consultant bei adesso SE.
Analysiere die bereitgestellten Informationen GRÜNDLICH und erstelle eine strukturierte, fundierte Zusammenfassung.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG:
- Alle Texte auf Deutsch
- Fokus auf geschäftsrelevante Insights
- Konkrete, umsetzbare Empfehlungen
- Nutze vorhandene Daten, ergänze mit Expertenwissen wenn nötig`;

    const completion = await openai.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt || defaultSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 4000,
    });

    return completion.choices[0]?.message?.content || '';
  }

  /**
   * Save section data to database
   *
   * Upserts qualificationSectionData entry with generated content and metadata.
   *
   * @param leadId - Lead ID
   * @param content - Structured section content (will be JSON.stringified)
   * @param metadata - Generation metadata
   */
  protected async saveSectionData(
    leadId: string,
    content: unknown,
    metadata: SectionMetadata
  ): Promise<void> {
    // Check if section data already exists
    const [existing] = await db
      .select()
      .from(qualificationSectionData)
      .where(
        and(
          eq(qualificationSectionData.qualificationId, leadId),
          eq(qualificationSectionData.sectionId, this.sectionId)
        )
      )
      .limit(1);

    const dataToSave = {
      qualificationId: leadId,
      sectionId: this.sectionId,
      content: JSON.stringify(content),
      sources: JSON.stringify({
        agentName: metadata.agentName,
        generatedAt: metadata.generatedAt.toISOString(),
        chunks: metadata.sources,
      }),
      confidence: metadata.confidence,
      createdAt: metadata.generatedAt,
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing entry
      await db
        .update(qualificationSectionData)
        .set(dataToSave)
        .where(eq(qualificationSectionData.id, existing.id));
    } else {
      // Insert new entry
      await db.insert(qualificationSectionData).values(dataToSave);
    }
  }

  /**
   * Load existing section data from database
   *
   * @param leadId - Lead ID
   * @returns Existing section data or null
   */
  protected async loadExistingSectionData(leadId: string): Promise<{
    content: unknown;
    metadata: SectionMetadata;
  } | null> {
    const [existing] = await db
      .select()
      .from(qualificationSectionData)
      .where(
        and(
          eq(qualificationSectionData.qualificationId, leadId),
          eq(qualificationSectionData.sectionId, this.sectionId)
        )
      )
      .limit(1);

    if (!existing) return null;

    // Parse sources JSON which contains agentName, generatedAt, and chunks
    const sourcesData = existing.sources
      ? (JSON.parse(existing.sources) as { agentName?: string; chunks?: unknown[] })
      : { chunks: [] };

    return {
      content: JSON.parse(existing.content) as Record<string, unknown>,
      metadata: {
        generatedAt: existing.createdAt || new Date(),
        agentName: sourcesData.agentName || 'unknown',
        sources: (sourcesData.chunks || []) as {
          agentName: string;
          chunkId: string;
          relevance: number;
        }[],
        confidence: existing.confidence || 0,
      },
    };
  }

  /**
   * Calculate confidence score from RAG results
   *
   * @param ragResults - RAG query results
   * @returns Confidence score (0-100)
   */
  protected calculateConfidence(ragResults: LeadRAGResult[]): number {
    if (ragResults.length === 0) return 0;

    // Average similarity of top 5 results
    const topResults = ragResults.slice(0, 5);
    const avgSimilarity = topResults.reduce((sum, r) => sum + r.similarity, 0) / topResults.length;

    // Scale to 0-100
    return Math.round(avgSimilarity * 100);
  }

  /**
   * Extract sources metadata from RAG results
   *
   * @param ragResults - RAG query results
   * @returns Array of source metadata
   */
  protected extractSources(
    ragResults: LeadRAGResult[]
  ): Array<{ agentName: string; chunkId: string; relevance: number }> {
    return ragResults.slice(0, 10).map(r => ({
      agentName: r.agentName || 'unknown',
      chunkId: r.chunkId || 'unknown',
      relevance: Math.round(r.similarity * 100),
    }));
  }

  /**
   * Format RAG results for AI prompt
   *
   * @param ragResults - RAG query results
   * @param maxResults - Max number of results to include (default: 10)
   * @returns Formatted string for prompt
   */
  protected formatRAGResultsForPrompt(ragResults: LeadRAGResult[], maxResults = 10): string {
    return ragResults
      .slice(0, maxResults)
      .map(
        (r, i) =>
          `[${i + 1}] Relevanz: ${Math.round(r.similarity * 100)}% | Agent: ${r.agentName || 'unknown'}
Inhalt: ${r.content.substring(0, 500)}${r.content.length > 500 ? '...' : ''}`
      )
      .join('\n\n---\n\n');
  }
}
