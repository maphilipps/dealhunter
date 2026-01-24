/**
 * RAG Data Visibility Types (DEA-10)
 *
 * TypeScript interfaces for the RAG Data visibility feature.
 * Used by Server Actions and UI components.
 */

// ============================================================================
// Stats Types
// ============================================================================

export interface AgentStats {
  agentName: string;
  chunkCount: number;
  chunkTypes: string[];
  lastUpdated: Date | null;
}

export interface RAGStats {
  totalEmbeddings: number;
  totalRawChunks: number;
  totalSectionData: number;
  agentStats: AgentStats[];
  chunkTypeDistribution: Record<string, number>;
}

// ============================================================================
// Embedding Types
// ============================================================================

export interface AgentOutput {
  id: string;
  agentName: string;
  chunkType: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  // Note: embedding vector is NOT included (too large for client)
}

export interface AgentOutputsResult {
  items: AgentOutput[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AgentOutputsFilter {
  rfpId: string;
  agentName?: string;
  chunkType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// Raw Chunk Types
// ============================================================================

export interface RawChunkItem {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    startPosition?: number;
    endPosition?: number;
    type?: string;
  };
  createdAt: Date;
}

export interface RawChunksResult {
  items: RawChunkItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RawChunksFilter {
  rfpId: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// Section Data Types
// ============================================================================

export interface SectionDataItem {
  id: string;
  sectionId: string;
  content: Record<string, unknown>;
  confidence: number | null;
  sources: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SectionDataResult {
  items: SectionDataItem[];
  total: number;
}

export interface SectionDataFilter {
  leadId: string;
  sectionId?: string;
}

// ============================================================================
// Similarity Search Types
// ============================================================================

export interface SimilarityResult {
  id: string;
  source: 'agent' | 'raw' | 'lead';
  agentName?: string;
  chunkType?: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface SimilaritySearchParams {
  rfpId?: string;
  leadId?: string;
  query: string;
  threshold?: number;
  maxResults?: number;
  includeRawChunks?: boolean;
}

export interface SimilaritySearchResult {
  results: SimilarityResult[];
  queryEmbeddingGenerated: boolean;
  searchTime: number;
}

// ============================================================================
// Action Result Types
// ============================================================================

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };
