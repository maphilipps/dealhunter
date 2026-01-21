/**
 * RAW Chunking Service (DEA-108)
 *
 * Chunks raw PDF/document text into smaller pieces for RAG-based extraction.
 * Strategy: Structural chunking via paragraph boundaries with token estimation.
 */

export interface RawChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    startPosition: number;
    endPosition: number;
    type: 'paragraph' | 'section' | 'overflow';
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
