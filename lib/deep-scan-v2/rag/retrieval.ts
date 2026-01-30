import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { generateQueryEmbedding } from '@/lib/ai/embedding-config';
import type { KnowledgeChunk, KnowledgeChunkMetadata } from '../types';
import { RAG_DEFAULTS } from '../constants';

export async function queryKnowledge(params: {
  query: string;
  filters?: Partial<KnowledgeChunkMetadata>;
  topK?: number;
  minConfidence?: number;
}): Promise<KnowledgeChunk[]> {
  const topK = params.topK ?? RAG_DEFAULTS.topK;
  const minConfidence = params.minConfidence ?? RAG_DEFAULTS.minConfidence;

  const queryEmbedding = await generateQueryEmbedding(params.query);
  if (!queryEmbedding) {
    console.warn('[RAG] Embedding generation failed, returning empty results');
    return [];
  }

  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const results = await db.execute(sql`
    SELECT
      id, content, token_count, source_type, source_file_name,
      cms, industry, document_type, confidence, business_unit,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM knowledge_chunks
    WHERE embedding IS NOT NULL
      AND confidence >= ${minConfidence}
      ${params.filters?.cms ? sql`AND cms = ${params.filters.cms}` : sql``}
      ${params.filters?.industry ? sql`AND industry = ${params.filters.industry}` : sql``}
      ${params.filters?.documentType ? sql`AND document_type = ${params.filters.documentType}` : sql``}
      ${params.filters?.businessUnit ? sql`AND business_unit = ${params.filters.businessUnit}` : sql``}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  return (results.rows as any[]).map(row => ({
    id: row.id,
    content: row.content,
    tokenCount: row.token_count,
    sourceType: row.source_type,
    sourceFileName: row.source_file_name,
    metadata: {
      cms: row.cms,
      industry: row.industry,
      documentType: row.document_type,
      confidence: row.confidence,
      businessUnit: row.business_unit,
    },
    similarity: row.similarity,
  }));
}
