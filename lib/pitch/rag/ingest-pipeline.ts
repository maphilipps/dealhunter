import { chunkMarkdown, chunkPlainText } from './chunking';
import { upsertKnowledgeChunk } from './knowledge-service';
import type { KnowledgeChunkMetadata } from '../types';

export async function ingestDocument(params: {
  content: string;
  fileName: string;
  fileId?: string;
  sourceType: 'upload' | 'reference' | 'baseline' | 'template';
  metadata?: Partial<KnowledgeChunkMetadata>;
}): Promise<{ chunkCount: number; chunkIds: string[] }> {
  const isMarkdown = params.fileName.endsWith('.md');
  const chunks = isMarkdown ? chunkMarkdown(params.content) : chunkPlainText(params.content);

  const chunkIds: string[] = [];

  // TODO: Batch embedding generation for performance (currently N separate API calls)
  for (const chunk of chunks) {
    const id = await upsertKnowledgeChunk({
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      sourceType: params.sourceType,
      sourceFileName: params.fileName,
      sourceFileId: params.fileId,
      metadata: params.metadata ?? {},
    });
    chunkIds.push(id);
  }

  return { chunkCount: chunkIds.length, chunkIds };
}
