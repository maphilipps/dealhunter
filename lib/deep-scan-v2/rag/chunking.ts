import { RAG_DEFAULTS } from '../constants';

export interface TextChunk {
  content: string;
  tokenCount: number;
  sectionTitle?: string;
}

// Rough token estimation: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitByTokenLimit(text: string, title?: string): TextChunk[] {
  const maxTokens = RAG_DEFAULTS.maxChunkTokens;
  const tokens = estimateTokens(text);

  if (tokens <= maxTokens) {
    return [{ content: text, tokenCount: tokens, sectionTitle: title }];
  }

  // Split by paragraphs
  const paragraphs = text.split(/\n\n+/);
  const result: TextChunk[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    const combined = buffer ? `${buffer}\n\n${para}` : para;
    if (estimateTokens(combined) > maxTokens && buffer) {
      result.push({
        content: buffer,
        tokenCount: estimateTokens(buffer),
        sectionTitle: title,
      });
      buffer = para;
    } else {
      buffer = combined;
    }
  }

  if (buffer.trim()) {
    result.push({
      content: buffer,
      tokenCount: estimateTokens(buffer),
      sectionTitle: title,
    });
  }

  return result;
}

export function chunkMarkdown(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const sections = text.split(/^(#{1,3}\s.+)$/gm);

  let currentTitle: string | undefined;
  let currentContent = '';

  for (const section of sections) {
    if (/^#{1,3}\s/.test(section.trim())) {
      // Flush previous section if it has content
      if (currentContent.trim()) {
        chunks.push(...splitByTokenLimit(currentContent.trim(), currentTitle));
      }
      currentTitle = section.trim().replace(/^#{1,3}\s/, '');
      currentContent = '';
    } else {
      currentContent += section;
    }
  }

  // Flush remaining
  if (currentContent.trim()) {
    chunks.push(...splitByTokenLimit(currentContent.trim(), currentTitle));
  }

  return chunks;
}

export function chunkPlainText(text: string): TextChunk[] {
  return splitByTokenLimit(text);
}
