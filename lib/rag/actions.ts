'use server';

/**
 * RAG Data Visibility Server Actions (DEA-10)
 *
 * Server Actions for fetching RAG data for visualization.
 * All actions follow the ActionResult<T> pattern with Zod validation.
 */

import { count, eq, like, sql, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import type {
  ActionResult,
  RAGStats,
  AgentStats,
  AgentOutputsResult,
  AgentOutputsFilter,
  RawChunksResult,
  RawChunksFilter,
  SectionDataResult,
  SectionDataFilter,
  SimilaritySearchResult,
  SimilaritySearchParams,
  SimilarityResult,
} from './types';

import { generateQueryEmbedding } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import {
  dealEmbeddings,
  rawChunks,
  pitchSectionData,
  pitches,
  preQualifications,
  users,
} from '@/lib/db/schema';

// ============================================================================
// Validation Schemas
// ============================================================================

const getRAGStatsSchema = z.object({
  preQualificationId: z.string().min(1, 'PreQualification ID is required'),
});

const getAgentOutputsSchema = z.object({
  preQualificationId: z.string().min(1, 'PreQualification ID is required'),
  agentName: z.string().optional(),
  chunkType: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

const getRawChunksSchema = z.object({
  preQualificationId: z.string().min(1, 'PreQualification ID is required'),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

const getSectionDataSchema = z.object({
  pitchId: z.string().min(1, 'Qualification ID is required'),
  sectionId: z.string().optional(),
});

const searchSimilarSchema = z.object({
  preQualificationId: z.string().optional(), // Now optional - can search by pitchId instead
  pitchId: z.string().optional(), // New: search in dealEmbeddings
  query: z.string().min(1, 'Query is required'),
  threshold: z.number().min(0).max(1).default(0.5),
  maxResults: z.number().int().positive().max(50).default(10),
  includeRawChunks: z.boolean().default(true),
});

// ============================================================================
// Helper Functions
// ============================================================================

async function getSessionUser(): Promise<
  { ok: true; userId: string; role: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Nicht authentifiziert' };
  return { ok: true, userId: session.user.id, role: session.user.role };
}

async function assertCanAccessPreQualification(
  preQualificationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionUser();
  if (!session.ok) return session;
  if (session.role === 'admin') return { ok: true };

  const [row] = await db
    .select({ id: preQualifications.id })
    .from(preQualifications)
    .where(
      and(
        eq(preQualifications.id, preQualificationId),
        eq(preQualifications.userId, session.userId)
      )
    )
    .limit(1);

  return row ? { ok: true } : { ok: false, error: 'Keine Berechtigung' };
}

async function assertCanAccessPitch(
  pitchId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionUser();
  if (!session.ok) return session;
  if (session.role === 'admin') return { ok: true };

  // Only BL users can access pitches; scoped to their business unit.
  if (session.role !== 'bl') return { ok: false, error: 'Keine Berechtigung' };

  const [[me], [pitch]] = await Promise.all([
    db
      .select({ businessUnitId: users.businessUnitId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
    db
      .select({ businessUnitId: pitches.businessUnitId })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1),
  ]);

  if (!me || !me.businessUnitId) return { ok: false, error: 'Keine Berechtigung' };
  if (!pitch) return { ok: false, error: 'Lead nicht gefunden' };
  return pitch.businessUnitId === me.businessUnitId
    ? { ok: true }
    : { ok: false, error: 'Keine Berechtigung' };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
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
 * Safely parse JSON with a fallback
 */
function safeParseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get aggregated RAG statistics for a Qualification
 */
export async function getRAGStats(
  input: z.infer<typeof getRAGStatsSchema>
): Promise<ActionResult<RAGStats>> {
  const parsed = getRAGStatsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { preQualificationId } = parsed.data;
  const access = await assertCanAccessPreQualification(preQualificationId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    // Get total embeddings count
    const [embeddingCount] = await db
      .select({ count: count() })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.preQualificationId, preQualificationId));

    // Get total raw chunks count
    const [rawChunkCount] = await db
      .select({ count: count() })
      .from(rawChunks)
      .where(eq(rawChunks.preQualificationId, preQualificationId));

    // Get qualification ID for this prequalification to query section data
    const [qualification] = await db
      .select({ id: pitches.id })
      .from(pitches)
      .where(eq(pitches.preQualificationId, preQualificationId))
      .limit(1);

    let sectionCount = 0;
    if (qualification) {
      const [sectionDataCount] = await db
        .select({ count: count() })
        .from(pitchSectionData)
        .where(eq(pitchSectionData.pitchId, qualification.id));
      sectionCount = sectionDataCount.count;
    }

    // Get agent stats with aggregation
    const agentStatsRows = await db
      .select({
        agentName: dealEmbeddings.agentName,
        chunkCount: count(),
        lastUpdated: sql<unknown>`MAX(${dealEmbeddings.createdAt})`,
      })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.preQualificationId, preQualificationId))
      .groupBy(dealEmbeddings.agentName);

    // Get chunk types per agent
    const chunkTypeRows = await db
      .select({
        agentName: dealEmbeddings.agentName,
        chunkType: dealEmbeddings.chunkType,
      })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.preQualificationId, preQualificationId))
      .groupBy(dealEmbeddings.agentName, dealEmbeddings.chunkType);

    // Build agent stats
    const agentChunkTypes = new Map<string, Set<string>>();
    for (const row of chunkTypeRows) {
      if (!agentChunkTypes.has(row.agentName)) {
        agentChunkTypes.set(row.agentName, new Set());
      }
      agentChunkTypes.get(row.agentName)!.add(row.chunkType);
    }

    const agentStats: AgentStats[] = agentStatsRows.map(row => ({
      agentName: row.agentName,
      chunkCount: row.chunkCount,
      chunkTypes: Array.from(agentChunkTypes.get(row.agentName) || []),
      lastUpdated: (() => {
        if (!row.lastUpdated) return null;
        const d = new Date(row.lastUpdated as any);
        return Number.isFinite(d.getTime()) ? d : null;
      })(),
    }));

    // Get chunk type distribution
    const chunkTypeDistRows = await db
      .select({
        chunkType: dealEmbeddings.chunkType,
        count: count(),
      })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.preQualificationId, preQualificationId))
      .groupBy(dealEmbeddings.chunkType);

    const chunkTypeDistribution: Record<string, number> = {};
    for (const row of chunkTypeDistRows) {
      chunkTypeDistribution[row.chunkType] = row.count;
    }

    return {
      success: true,
      data: {
        totalEmbeddings: embeddingCount.count,
        totalRawChunks: rawChunkCount.count,
        totalSectionData: sectionCount,
        agentStats,
        chunkTypeDistribution,
      },
    };
  } catch (error) {
    console.error('[RAG Actions] getRAGStats failed:', error);
    return { success: false, error: 'Failed to fetch RAG stats' };
  }
}

/**
 * Get paginated agent outputs (dealEmbeddings)
 */
export async function getAgentOutputs(
  input: AgentOutputsFilter
): Promise<ActionResult<AgentOutputsResult>> {
  const parsed = getAgentOutputsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { preQualificationId, agentName, chunkType, search, page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;
  const access = await assertCanAccessPreQualification(preQualificationId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    // Build where conditions
    const conditions = [eq(dealEmbeddings.preQualificationId, preQualificationId)];

    if (agentName) {
      conditions.push(eq(dealEmbeddings.agentName, agentName));
    }

    if (chunkType) {
      conditions.push(eq(dealEmbeddings.chunkType, chunkType));
    }

    if (search) {
      conditions.push(like(dealEmbeddings.content, `%${search}%`));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(dealEmbeddings)
      .where(whereClause);

    // Get items (without embedding vector)
    const items = await db
      .select({
        id: dealEmbeddings.id,
        agentName: dealEmbeddings.agentName,
        chunkType: dealEmbeddings.chunkType,
        chunkIndex: dealEmbeddings.chunkIndex,
        content: dealEmbeddings.content,
        metadata: dealEmbeddings.metadata,
        createdAt: dealEmbeddings.createdAt,
      })
      .from(dealEmbeddings)
      .where(whereClause)
      .orderBy(desc(dealEmbeddings.createdAt))
      .limit(pageSize)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        items: items.map(item => ({
          ...item,
          metadata: safeParseJSON<Record<string, unknown>>(item.metadata, {}),
          createdAt: item.createdAt ?? new Date(),
        })),
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    console.error('[RAG Actions] getAgentOutputs failed:', error);
    return { success: false, error: 'Failed to fetch agent outputs' };
  }
}

/**
 * Get paginated raw chunks
 */
export async function getRawChunks(input: RawChunksFilter): Promise<ActionResult<RawChunksResult>> {
  const parsed = getRawChunksSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { preQualificationId, search, page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;
  const access = await assertCanAccessPreQualification(preQualificationId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    // Build where conditions
    const conditions = [eq(rawChunks.preQualificationId, preQualificationId)];

    if (search) {
      conditions.push(like(rawChunks.content, `%${search}%`));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get total count
    const [totalResult] = await db.select({ count: count() }).from(rawChunks).where(whereClause);

    // Get items (without embedding vector)
    const items = await db
      .select({
        id: rawChunks.id,
        chunkIndex: rawChunks.chunkIndex,
        content: rawChunks.content,
        tokenCount: rawChunks.tokenCount,
        metadata: rawChunks.metadata,
        createdAt: rawChunks.createdAt,
      })
      .from(rawChunks)
      .where(whereClause)
      .orderBy(rawChunks.chunkIndex)
      .limit(pageSize)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        items: items.map(item => ({
          ...item,
          metadata: safeParseJSON<{
            startPosition?: number;
            endPosition?: number;
            type?: string;
            source?: {
              kind: 'pdf';
              fileName: string;
              pass?: 'text' | 'tables' | 'images';
              page: number;
              paragraphStart: number;
              paragraphEnd: number;
              heading: string | null;
            };
          }>(item.metadata, {}),
          createdAt: item.createdAt ?? new Date(),
        })),
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    console.error('[RAG Actions] getRawChunks failed:', error);
    return { success: false, error: 'Failed to fetch raw chunks' };
  }
}

/**
 * Get pitch section data
 */
export async function getSectionData(
  input: SectionDataFilter
): Promise<ActionResult<SectionDataResult>> {
  const parsed = getSectionDataSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { pitchId, sectionId } = parsed.data;
  const access = await assertCanAccessPitch(pitchId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    // Build where conditions
    const conditions = [eq(pitchSectionData.pitchId, pitchId)];

    if (sectionId) {
      conditions.push(eq(pitchSectionData.sectionId, sectionId));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get items
    const items = await db
      .select()
      .from(pitchSectionData)
      .where(whereClause)
      .orderBy(pitchSectionData.sectionId);

    return {
      success: true,
      data: {
        items: items.map(item => ({
          id: item.id,
          sectionId: item.sectionId,
          content: safeParseJSON<Record<string, unknown>>(item.content, {}),
          confidence: item.confidence,
          sources: safeParseJSON<string[]>(item.sources, []),
          createdAt: item.createdAt ?? new Date(),
          updatedAt: item.updatedAt ?? new Date(),
        })),
        total: items.length,
      },
    };
  } catch (error) {
    console.error('[RAG Actions] getSectionData failed:', error);
    return { success: false, error: 'Failed to fetch section data' };
  }
}

/**
 * Search for similar chunks using cosine similarity
 * Supports both Qualification-based search (dealEmbeddings, rawChunks) and Lead-based search (dealEmbeddings)
 */
export async function searchSimilar(
  input: SimilaritySearchParams
): Promise<ActionResult<SimilaritySearchResult>> {
  const parsed = searchSimilarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { preQualificationId, pitchId, query, threshold, maxResults, includeRawChunks } =
    parsed.data;
  const startTime = Date.now();

  // Need either preQualificationId or pitchId
  if (!preQualificationId && !pitchId) {
    return { success: false, error: 'Either preQualificationId or pitchId is required' };
  }

  if (preQualificationId) {
    const access = await assertCanAccessPreQualification(preQualificationId);
    if (!access.ok) return { success: false, error: access.error };
  }
  if (pitchId) {
    const access = await assertCanAccessPitch(pitchId);
    if (!access.ok) return { success: false, error: access.error };
  }

  try {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query);

    if (!queryEmbedding) {
      return {
        success: true,
        data: {
          results: [],
          queryEmbeddingGenerated: false,
          searchTime: Date.now() - startTime,
        },
      };
    }

    const results: SimilarityResult[] = [];

    // Search in dealEmbeddings if pitchId provided
    if (pitchId) {
      const qualificationChunks = await db
        .select({
          id: dealEmbeddings.id,
          agentName: dealEmbeddings.agentName,
          chunkType: dealEmbeddings.chunkType,
          chunkIndex: dealEmbeddings.chunkIndex,
          content: dealEmbeddings.content,
          embedding: dealEmbeddings.embedding,
          metadata: dealEmbeddings.metadata,
        })
        .from(dealEmbeddings)
        .where(eq(dealEmbeddings.pitchId, pitchId));

      for (const chunk of qualificationChunks) {
        const chunkEmbedding = chunk.embedding;
        if (!chunkEmbedding || chunkEmbedding.length === 0) continue;

        const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

        if (similarity >= threshold) {
          results.push({
            id: chunk.id,
            source: 'lead',
            agentName: chunk.agentName,
            chunkType: chunk.chunkType,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            similarity,
            metadata: safeParseJSON<Record<string, unknown>>(chunk.metadata, {}),
          });
        }
      }
    }

    // Search in dealEmbeddings if preQualificationId provided
    if (preQualificationId) {
      const agentChunks = await db
        .select({
          id: dealEmbeddings.id,
          agentName: dealEmbeddings.agentName,
          chunkType: dealEmbeddings.chunkType,
          chunkIndex: dealEmbeddings.chunkIndex,
          content: dealEmbeddings.content,
          embedding: dealEmbeddings.embedding,
          metadata: dealEmbeddings.metadata,
        })
        .from(dealEmbeddings)
        .where(eq(dealEmbeddings.preQualificationId, preQualificationId));

      for (const chunk of agentChunks) {
        const chunkEmbedding = chunk.embedding;
        if (!chunkEmbedding || chunkEmbedding.length === 0) continue;

        const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

        if (similarity >= threshold) {
          results.push({
            id: chunk.id,
            source: 'agent',
            agentName: chunk.agentName,
            chunkType: chunk.chunkType,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            similarity,
            metadata: safeParseJSON<Record<string, unknown>>(chunk.metadata, {}),
          });
        }
      }

      // Search raw chunks if requested
      if (includeRawChunks) {
        const rawChunkItems = await db
          .select({
            id: rawChunks.id,
            chunkIndex: rawChunks.chunkIndex,
            content: rawChunks.content,
            embedding: rawChunks.embedding,
            metadata: rawChunks.metadata,
          })
          .from(rawChunks)
          .where(eq(rawChunks.preQualificationId, preQualificationId));

        for (const chunk of rawChunkItems) {
          const chunkEmbedding = chunk.embedding;
          if (!chunkEmbedding || chunkEmbedding.length === 0) continue;

          const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

          if (similarity >= threshold) {
            results.push({
              id: chunk.id,
              source: 'raw',
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              similarity,
              metadata: safeParseJSON<Record<string, unknown>>(chunk.metadata, {}),
            });
          }
        }
      }
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    const limitedResults = results.slice(0, maxResults);

    return {
      success: true,
      data: {
        results: limitedResults,
        queryEmbeddingGenerated: true,
        searchTime: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('[RAG Actions] searchSimilar failed:', error);
    return { success: false, error: 'Failed to perform similarity search' };
  }
}

/**
 * Get Qualification ID for a lead (helper for client components)
 */
export async function getRfpIdForLead(pitchId: string): Promise<ActionResult<string | null>> {
  const access = await assertCanAccessPitch(pitchId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    const [lead] = await db
      .select({ preQualificationId: pitches.preQualificationId })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

    return {
      success: true,
      data: lead?.preQualificationId ?? null,
    };
  } catch (error) {
    console.error('[RAG Actions] getRfpIdForLead failed:', error);
    return { success: false, error: 'Failed to get Qualification ID' };
  }
}

// ============================================================================
// Lead Embeddings Actions (for Audit Ingestion)
// Now using unified dealEmbeddings table with pitchId filter
// ============================================================================

const getLeadEmbeddingsSchema = z.object({
  pitchId: z.string().min(1, 'Qualification ID is required'),
  agentName: z.string().optional(),
  chunkType: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export interface LeadEmbeddingItem {
  id: string;
  agentName: string;
  chunkType: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface LeadEmbeddingsResult {
  items: LeadEmbeddingItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get paginated lead embeddings (for audit data)
 */
export async function getLeadEmbeddings(
  input: z.infer<typeof getLeadEmbeddingsSchema>
): Promise<ActionResult<LeadEmbeddingsResult>> {
  const parsed = getLeadEmbeddingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { pitchId, agentName, chunkType, search, page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;
  const access = await assertCanAccessPitch(pitchId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    // Build where conditions
    const conditions = [eq(dealEmbeddings.pitchId, pitchId)];

    if (agentName) {
      conditions.push(eq(dealEmbeddings.agentName, agentName));
    }

    if (chunkType) {
      conditions.push(eq(dealEmbeddings.chunkType, chunkType));
    }

    if (search) {
      conditions.push(like(dealEmbeddings.content, `%${search}%`));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(dealEmbeddings)
      .where(whereClause);

    // Get items
    const items = await db
      .select({
        id: dealEmbeddings.id,
        agentName: dealEmbeddings.agentName,
        chunkType: dealEmbeddings.chunkType,
        chunkIndex: dealEmbeddings.chunkIndex,
        content: dealEmbeddings.content,
        metadata: dealEmbeddings.metadata,
        createdAt: dealEmbeddings.createdAt,
      })
      .from(dealEmbeddings)
      .where(whereClause)
      .orderBy(desc(dealEmbeddings.createdAt))
      .limit(pageSize)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        items: items.map(item => ({
          ...item,
          metadata: safeParseJSON<Record<string, unknown>>(item.metadata, {}),
          createdAt: item.createdAt ?? new Date(),
        })),
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    console.error('[RAG Actions] getLeadEmbeddings failed:', error);
    return { success: false, error: 'Failed to fetch lead embeddings' };
  }
}

/**
 * Get lead embeddings stats
 */
export async function getLeadEmbeddingsStats(
  pitchId: string
): Promise<
  ActionResult<{ total: number; byAgent: Record<string, number>; byType: Record<string, number> }>
> {
  const access = await assertCanAccessPitch(pitchId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.pitchId, pitchId));

    // Get counts by agent
    const agentCounts = await db
      .select({
        agentName: dealEmbeddings.agentName,
        count: count(),
      })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.pitchId, pitchId))
      .groupBy(dealEmbeddings.agentName);

    // Get counts by type
    const typeCounts = await db
      .select({
        chunkType: dealEmbeddings.chunkType,
        count: count(),
      })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.pitchId, pitchId))
      .groupBy(dealEmbeddings.chunkType);

    const byAgent: Record<string, number> = {};
    for (const row of agentCounts) {
      byAgent[row.agentName] = row.count;
    }

    const byType: Record<string, number> = {};
    for (const row of typeCounts) {
      byType[row.chunkType] = row.count;
    }

    return {
      success: true,
      data: {
        total: totalResult.count,
        byAgent,
        byType,
      },
    };
  } catch (error) {
    console.error('[RAG Actions] getLeadEmbeddingsStats failed:', error);
    return { success: false, error: 'Failed to fetch lead embeddings stats' };
  }
}

/**
 * Get unique agent names for lead embeddings
 */
export async function getLeadEmbeddingAgents(pitchId: string): Promise<ActionResult<string[]>> {
  const access = await assertCanAccessPitch(pitchId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    const agents = await db
      .selectDistinct({ agentName: dealEmbeddings.agentName })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.pitchId, pitchId))
      .orderBy(dealEmbeddings.agentName);

    return {
      success: true,
      data: agents.map(a => a.agentName),
    };
  } catch (error) {
    console.error('[RAG Actions] getLeadEmbeddingAgents failed:', error);
    return { success: false, error: 'Failed to get agent names' };
  }
}

/**
 * Get unique chunk types for lead embeddings
 */
export async function getLeadEmbeddingTypes(pitchId: string): Promise<ActionResult<string[]>> {
  const access = await assertCanAccessPitch(pitchId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    const types = await db
      .selectDistinct({ chunkType: dealEmbeddings.chunkType })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.pitchId, pitchId))
      .orderBy(dealEmbeddings.chunkType);

    return {
      success: true,
      data: types.map(t => t.chunkType),
    };
  } catch (error) {
    console.error('[RAG Actions] getLeadEmbeddingTypes failed:', error);
    return { success: false, error: 'Failed to get chunk types' };
  }
}

/**
 * Get unique agent names for a Qualification (for filter dropdowns)
 */
export async function getAgentNames(preQualificationId: string): Promise<ActionResult<string[]>> {
  const access = await assertCanAccessPreQualification(preQualificationId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    const agents = await db
      .selectDistinct({ agentName: dealEmbeddings.agentName })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.preQualificationId, preQualificationId))
      .orderBy(dealEmbeddings.agentName);

    return {
      success: true,
      data: agents.map(a => a.agentName),
    };
  } catch (error) {
    console.error('[RAG Actions] getAgentNames failed:', error);
    return { success: false, error: 'Failed to get agent names' };
  }
}

/**
 * Get unique chunk types for a Qualification (for filter dropdowns)
 */
export async function getChunkTypes(preQualificationId: string): Promise<ActionResult<string[]>> {
  const access = await assertCanAccessPreQualification(preQualificationId);
  if (!access.ok) return { success: false, error: access.error };

  try {
    const types = await db
      .selectDistinct({ chunkType: dealEmbeddings.chunkType })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.preQualificationId, preQualificationId))
      .orderBy(dealEmbeddings.chunkType);

    return {
      success: true,
      data: types.map(t => t.chunkType),
    };
  } catch (error) {
    console.error('[RAG Actions] getChunkTypes failed:', error);
    return { success: false, error: 'Failed to get chunk types' };
  }
}
