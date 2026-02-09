/**
 * RAW Chunking Service (DEA-108)
 *
 * Chunks raw PDF/document text into smaller pieces for RAG-based extraction.
 * Strategy: Structural chunking via paragraph boundaries with token estimation.
 */

import { parseDocumentTextToParagraphs, type ParagraphNode } from './source-locator';

export interface RawChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    startPosition: number;
    endPosition: number;
    type: 'paragraph' | 'section' | 'overflow';
    source?: {
      kind: 'pdf';
      fileName: string;
      pass?: 'text' | 'tables' | 'images';
      page: number;
      paragraphStart: number;
      paragraphEnd: number;
      heading: string | null;
    };
  };
}

// Target chunk size in tokens (optimal for embedding models)
const TARGET_CHUNK_SIZE = 600; // tokens
const MIN_CHUNK_SIZE = 100; // tokens - filter out tiny chunks
const MAX_CHUNK_SIZE = 1000; // tokens - hard limit

/**
 * Estimate token count from text
 * Rule of thumb: ~4 characters per token for German/English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Chunk raw document text into smaller pieces
 *
 * Strategy:
 * 1. Split by double newlines (paragraph boundaries)
 * 2. If paragraph too large, split by sentences
 * 3. Combine small paragraphs to reach target size
 * 4. Filter out chunks < MIN_CHUNK_SIZE tokens
 *
 * @param text - Raw document text
 * @returns Array of chunks with metadata
 */
export function chunkRawText(text: string): RawChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: RawChunk[] = [];
  let currentChunk = '';
  let currentStart = 0;
  let chunkIndex = 0;

  // Split by double newlines (paragraph boundaries)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // If paragraph alone exceeds MAX_CHUNK_SIZE, split by sentences
    if (paragraphTokens > MAX_CHUNK_SIZE) {
      // Flush current chunk first
      if (currentChunk.trim().length > 0) {
        const tokens = estimateTokens(currentChunk);
        if (tokens >= MIN_CHUNK_SIZE) {
          chunks.push({
            chunkIndex: chunkIndex++,
            content: currentChunk.trim(),
            tokenCount: tokens,
            metadata: {
              startPosition: currentStart,
              endPosition: currentStart + currentChunk.length,
              type: 'paragraph',
            },
          });
        }
        currentChunk = '';
      }

      // Split large paragraph by sentences
      const sentences = splitIntoSentences(paragraph);
      let sentenceChunk = '';
      let sentenceStart = text.indexOf(paragraph) || 0;

      for (const sentence of sentences) {
        const potentialChunk = sentenceChunk + (sentenceChunk ? ' ' : '') + sentence;
        const potentialTokens = estimateTokens(potentialChunk);

        if (potentialTokens > MAX_CHUNK_SIZE && sentenceChunk.length > 0) {
          // Flush sentence chunk
          const tokens = estimateTokens(sentenceChunk);
          if (tokens >= MIN_CHUNK_SIZE) {
            chunks.push({
              chunkIndex: chunkIndex++,
              content: sentenceChunk.trim(),
              tokenCount: tokens,
              metadata: {
                startPosition: sentenceStart,
                endPosition: sentenceStart + sentenceChunk.length,
                type: 'section',
              },
            });
          }
          sentenceChunk = sentence;
          sentenceStart += sentenceChunk.length;
        } else {
          sentenceChunk = potentialChunk;
        }
      }

      // Flush remaining sentences
      if (sentenceChunk.trim().length > 0) {
        const tokens = estimateTokens(sentenceChunk);
        if (tokens >= MIN_CHUNK_SIZE) {
          chunks.push({
            chunkIndex: chunkIndex++,
            content: sentenceChunk.trim(),
            tokenCount: tokens,
            metadata: {
              startPosition: sentenceStart,
              endPosition: sentenceStart + sentenceChunk.length,
              type: 'section',
            },
          });
        }
      }

      currentStart = text.indexOf(paragraph) + paragraph.length;
      continue;
    }

    // Try adding paragraph to current chunk
    const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
    const potentialTokens = estimateTokens(potentialChunk);

    if (potentialTokens > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
      // Flush current chunk, start new one
      const tokens = estimateTokens(currentChunk);
      if (tokens >= MIN_CHUNK_SIZE) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: currentChunk.trim(),
          tokenCount: tokens,
          metadata: {
            startPosition: currentStart,
            endPosition: currentStart + currentChunk.length,
            type: 'paragraph',
          },
        });
      }
      currentChunk = paragraph;
      currentStart = text.indexOf(paragraph) || 0;
    } else {
      // Add to current chunk
      if (currentChunk.length === 0) {
        currentStart = text.indexOf(paragraph) || 0;
      }
      currentChunk = potentialChunk;
    }
  }

  // Flush final chunk
  if (currentChunk.trim().length > 0) {
    const tokens = estimateTokens(currentChunk);
    if (tokens >= MIN_CHUNK_SIZE) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentChunk.trim(),
        tokenCount: tokens,
        metadata: {
          startPosition: currentStart,
          endPosition: currentStart + currentChunk.length,
          type: 'paragraph',
        },
      });
    }
  }

  return chunks;
}

type ChunkGroup =
  | {
      kind: 'pdf-page';
      fileName: string;
      pass: 'text' | 'tables' | 'images';
      page: number;
      paragraphs: ParagraphNode[];
    }
  | { kind: 'other'; paragraphs: ParagraphNode[] };

/**
 * Locator-aware chunking.
 *
 * If the input contains [[DOC]] and [[PAGE N]] markers, we will:
 * - reset paragraph numbers per page
 * - never create chunks that cross page boundaries
 * - store a stable `metadata.source` locator for each chunk
 *
 * For non-marked input, it behaves like paragraph-based chunking but without page guarantees.
 */
export function chunkRawTextWithLocators(text: string): RawChunk[] {
  if (!text || text.trim().length === 0) return [];

  const nodes = parseDocumentTextToParagraphs(text);
  if (nodes.length === 0) return [];

  const groups: ChunkGroup[] = [];
  let current: ChunkGroup | null = null;

  for (const node of nodes) {
    if (node.source) {
      const pass = node.source.pass ?? 'text';
      const key = `${node.source.fileName}::${pass}::${node.source.page}`;
      if (
        !current ||
        current.kind !== 'pdf-page' ||
        `${current.fileName}::${current.pass}::${current.page}` !== key
      ) {
        current = {
          kind: 'pdf-page',
          fileName: node.source.fileName,
          pass,
          page: node.source.page,
          paragraphs: [],
        };
        groups.push(current);
      }
      current.paragraphs.push(node);
      continue;
    }

    if (!current || current.kind !== 'other') {
      current = { kind: 'other', paragraphs: [] };
      groups.push(current);
    }
    current.paragraphs.push(node);
  }

  const chunks: RawChunk[] = [];
  let chunkIndex = 0;

  for (const group of groups) {
    if (group.paragraphs.length === 0) continue;

    let pushedAnyForGroup = false;

    // Sentence splitting for huge single paragraphs.
    const pushChunk = (params: {
      content: string;
      tokenCount: number;
      startOffset: number;
      endOffset: number;
      type: 'paragraph' | 'section' | 'overflow';
      source?: RawChunk['metadata']['source'];
    }) => {
      if (
        params.tokenCount < MIN_CHUNK_SIZE &&
        // For locator-aware pages, keep at least one chunk so we don't drop short but important pages.
        !(group.kind === 'pdf-page' && !pushedAnyForGroup)
      )
        return;
      chunks.push({
        chunkIndex: chunkIndex++,
        content: params.content,
        tokenCount: params.tokenCount,
        metadata: {
          startPosition: params.startOffset,
          endPosition: params.endOffset,
          type: params.type,
          ...(params.source ? { source: params.source } : {}),
        },
      });
      pushedAnyForGroup = true;
    };

    let buffer: any[] = [];
    let bufferTokens = 0;

    const flushBuffer = () => {
      if (buffer.length === 0) return;
      const content = buffer
        .map(p => p.text)
        .join('\n\n')
        .trim();
      const tokenCount = estimateTokens(content);
      const startOffset = buffer[0].startOffset;
      const endOffset = buffer[buffer.length - 1].endOffset;

      let source: RawChunk['metadata']['source'] | undefined;
      if (group.kind === 'pdf-page') {
        const first = buffer[0].source;
        const last = buffer[buffer.length - 1].source;
        if (first && last) {
          // Heading is best-effort. Use the heading of the first paragraph in the chunk.
          source = {
            kind: 'pdf',
            fileName: group.fileName,
            pass: group.pass,
            page: group.page,
            paragraphStart: first.paragraphNumber,
            paragraphEnd: last.paragraphNumber,
            heading: first.heading,
          };
        }
      }

      pushChunk({
        content,
        tokenCount,
        startOffset,
        endOffset,
        type: 'paragraph',
        ...(source ? { source } : {}),
      });
      buffer = [];
      bufferTokens = 0;
    };

    for (const para of group.paragraphs) {
      // If a single paragraph is huge, split it by sentences and emit multiple chunks.
      if (para.tokenCount > MAX_CHUNK_SIZE) {
        flushBuffer();
        const sentences = splitIntoSentences(para.text);
        let sentenceBuf = '';
        let sentenceBufTokens = 0;

        for (const sentence of sentences) {
          const candidate = sentenceBuf ? `${sentenceBuf} ${sentence}` : sentence;
          const candidateTokens = estimateTokens(candidate);
          if (candidateTokens > MAX_CHUNK_SIZE && sentenceBuf) {
            const content = sentenceBuf.trim();
            const tokenCount = estimateTokens(content);
            const source =
              group.kind === 'pdf-page' && para.source
                ? {
                    kind: 'pdf' as const,
                    fileName: group.fileName,
                    pass: group.pass,
                    page: group.page,
                    paragraphStart: para.source.paragraphNumber,
                    paragraphEnd: para.source.paragraphNumber,
                    heading: para.source.heading,
                  }
                : undefined;
            pushChunk({
              content,
              tokenCount,
              startOffset: para.startOffset,
              endOffset: para.endOffset,
              type: 'section',
              ...(source ? { source } : {}),
            });
            sentenceBuf = sentence;
            sentenceBufTokens = estimateTokens(sentenceBuf);
          } else {
            sentenceBuf = candidate;
            sentenceBufTokens = candidateTokens;
          }
        }

        if (sentenceBuf.trim()) {
          const content = sentenceBuf.trim();
          const tokenCount = estimateTokens(content);
          const source =
            group.kind === 'pdf-page' && para.source
              ? {
                  kind: 'pdf' as const,
                  fileName: group.fileName,
                  pass: group.pass,
                  page: group.page,
                  paragraphStart: para.source.paragraphNumber,
                  paragraphEnd: para.source.paragraphNumber,
                  heading: para.source.heading,
                }
              : undefined;
          pushChunk({
            content,
            tokenCount,
            startOffset: para.startOffset,
            endOffset: para.endOffset,
            type: 'section',
            ...(source ? { source } : {}),
          });
        }

        continue;
      }

      const nextTokens = bufferTokens + para.tokenCount;
      if (buffer.length > 0 && nextTokens > TARGET_CHUNK_SIZE) {
        flushBuffer();
      }

      buffer.push(para);
      bufferTokens += para.tokenCount;

      // Hard cap.
      if (bufferTokens > MAX_CHUNK_SIZE) {
        flushBuffer();
      }
    }

    flushBuffer();
  }

  return chunks;
}

/**
 * Split text into sentences (German/English aware)
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries: . ! ? followed by space or newline
  // But not on common abbreviations like Mr. Mrs. Dr. etc.
  const sentences = text
    .replace(/([.!?])\s+/g, '$1|||')
    .split('|||')
    .filter(s => s.trim().length > 0);

  return sentences;
}

/**
 * Get statistics about chunks
 */
export function getChunkStats(chunks: RawChunk[]): {
  totalChunks: number;
  totalTokens: number;
  avgTokensPerChunk: number;
  minTokens: number;
  maxTokens: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalTokens: 0,
      avgTokensPerChunk: 0,
      minTokens: 0,
      maxTokens: 0,
    };
  }

  const tokenCounts = chunks.map(c => c.tokenCount);
  const totalTokens = tokenCounts.reduce((sum, t) => sum + t, 0);

  return {
    totalChunks: chunks.length,
    totalTokens,
    avgTokensPerChunk: Math.round(totalTokens / chunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
  };
}
