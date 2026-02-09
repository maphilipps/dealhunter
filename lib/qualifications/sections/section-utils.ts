import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import type { RawRAGResult } from '@/lib/rag/raw-retrieval-service';
import { queryRawChunks } from '@/lib/rag/raw-retrieval-service';
import { formatSourceCitation } from '@/lib/rag/citations';
import { excerptText } from '@/lib/qualifications/sources';
import { generateQueryEmbedding } from '@/lib/ai/embedding-config';

export async function deletePreQualSectionArtifacts(options: {
  preQualificationId: string;
  sectionId: string;
}) {
  const { preQualificationId, sectionId } = options;

  // Delete visualizations for this section (avoid findFirst returning stale data).
  await db
    .delete(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        eq(dealEmbeddings.chunkType, 'visualization'),
        sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
      )
    );

  // Delete findings for this section (idempotency + clean retries).
  await db
    .delete(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        eq(dealEmbeddings.agentName, 'prequal_section_agent'),
        eq(dealEmbeddings.chunkType, sectionId)
      )
    );

  // Delete dashboard highlight for this section.
  await db
    .delete(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        eq(dealEmbeddings.chunkType, 'dashboard_highlight'),
        eq(dealEmbeddings.agentName, `dashboard_${sectionId}`)
      )
    );
}

export async function collectEvidenceChunks(options: {
  preQualificationId: string;
  queries: Array<{ query: string; topK?: number }>;
  maxTotal?: number;
}): Promise<{ chunks: RawRAGResult[]; byId: Map<string, RawRAGResult> }> {
  const { preQualificationId, queries, maxTotal = 28 } = options;

  const results = await Promise.all(
    queries.map(async q => {
      const chunks = await queryRawChunks({
        preQualificationId,
        question: q.query,
        maxResults: q.topK ?? 8,
      });
      return chunks;
    })
  );

  const byId = new Map<string, RawRAGResult>();
  for (const batch of results) {
    for (const c of batch) {
      if (!byId.has(c.chunkId)) byId.set(c.chunkId, c);
    }
  }

  const chunks = [...byId.values()].sort((a, b) => b.similarity - a.similarity).slice(0, maxTotal);

  // Rebuild map to match truncated list.
  const truncated = new Map<string, RawRAGResult>();
  for (const c of chunks) truncated.set(c.chunkId, c);

  return { chunks, byId: truncated };
}

export function buildEvidenceContextForExtraction(chunks: RawRAGResult[]): string {
  if (chunks.length === 0) return 'Keine relevanten Dokument-Chunks gefunden.';

  const lines: string[] = [];
  lines.push('EVIDENCE CHUNKS (verwende NUR diese ChunkIds als Quellen):');
  lines.push('');

  for (const c of chunks) {
    const citation = c.source
      ? formatSourceCitation(c.source)
      : c.webSource?.url
        ? c.webSource.url
        : 'unbekannte Quelle';
    lines.push(`- chunkId: ${c.chunkId}`);
    lines.push(`  citation: ${citation}`);
    lines.push(`  relevance: ${Math.round(c.similarity * 100)}%`);
    lines.push(`  excerpt: ${excerptText(c.content, 700)}`);
    lines.push('');
  }

  return lines.join('\n');
}

export async function generateEmbeddingsWithConcurrency(
  texts: string[],
  options?: { concurrency?: number }
): Promise<Array<number[] | null>> {
  const concurrency = Math.max(1, Math.min(8, options?.concurrency ?? 3));
  if (texts.length === 0) return [];

  const out: Array<number[] | null> = new Array(texts.length).fill(null);
  let nextIdx = 0;

  const worker = async () => {
    while (true) {
      const i = nextIdx++;
      if (i >= texts.length) return;
      out[i] = await generateQueryEmbedding(texts[i]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, () => worker()));
  return out;
}
