import { createHash } from 'crypto';

import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { knowledgeChunks } from '@/lib/db/schema';
import { generateEmbeddings } from '@/lib/ai/embedding-config';
import type { KnowledgeChunkMetadata } from '../types';

export async function upsertKnowledgeChunk(params: {
  content: string;
  tokenCount: number;
  sourceType: 'upload' | 'reference' | 'baseline' | 'template';
  sourceFileName?: string;
  sourceFileId?: string;
  metadata: Partial<KnowledgeChunkMetadata>;
}): Promise<string> {
  const contentHash = createHash('sha256').update(params.content).digest('hex');

  // Check for duplicate
  const [existing] = await db
    .select({ id: knowledgeChunks.id })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.contentHash, contentHash))
    .limit(1);

  if (existing) return existing.id;

  // Generate embedding
  const embeddings = await generateEmbeddings([params.content]);
  const embedding = embeddings?.[0] ?? null;

  const id = createId();
  await db.insert(knowledgeChunks).values({
    id,
    content: params.content,
    contentHash,
    tokenCount: params.tokenCount,
    sourceType: params.sourceType,
    sourceFileName: params.sourceFileName ?? null,
    sourceFileId: params.sourceFileId ?? null,
    embedding,
    cms: params.metadata.cms ?? null,
    industry: params.metadata.industry ?? null,
    documentType: params.metadata.documentType ?? null,
    confidence: params.metadata.confidence ?? 50,
    businessUnit: params.metadata.businessUnit ?? null,
  });

  return id;
}

export async function deleteKnowledgeChunk(id: string): Promise<void> {
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.id, id));
}
