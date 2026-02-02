/**
 * Audit RAG Ingestion Service
 *
 * Orchestrates the ingestion of audit data into the RAG system.
 * Each file (JSON/MD/TXT) is stored as a single raw chunk with embedding.
 */

import { eq, and } from 'drizzle-orm';

import { parseAuditDirectory, getAuditStats } from './audit-file-parser';

import { isEmbeddingEnabled } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { pitches, dealEmbeddings } from '@/lib/db/schema';
import { estimateTokens } from '@/lib/rag/raw-chunk-service';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

const AGENT_NAME = 'audit_ingestion';
// Use character limit (~1.5-2 chars/token for JSON, 8192 max = ~12000 chars, use 10000 to be safe)
const MAX_CHARS_PER_CHUNK = 10000;

/**
 * Split content into chunks that fit within character limit
 */
function splitContentForEmbedding(content: string): string[] {
  // If content fits, return as-is
  if (content.length <= MAX_CHARS_PER_CHUNK) {
    return [content];
  }

  const chunks: string[] = [];

  /**
   * Helper: Split a large text by lines, then by characters if needed
   */
  function splitLargeText(text: string): string[] {
    if (text.length <= MAX_CHARS_PER_CHUNK) {
      return [text];
    }

    const result: string[] = [];
    const lines = text.split('\n');
    let lineChunk = '';

    for (const line of lines) {
      const potentialLineChunk = lineChunk ? `${lineChunk}\n${line}` : line;

      if (potentialLineChunk.length > MAX_CHARS_PER_CHUNK) {
        // Push current chunk if exists
        if (lineChunk) {
          result.push(lineChunk);
        }
        // Handle the new line - might be larger than MAX itself
        if (line.length > MAX_CHARS_PER_CHUNK) {
          // Split by characters
          for (let i = 0; i < line.length; i += MAX_CHARS_PER_CHUNK) {
            result.push(line.slice(i, i + MAX_CHARS_PER_CHUNK));
          }
          lineChunk = '';
        } else {
          lineChunk = line;
        }
      } else {
        lineChunk = potentialLineChunk;
      }
    }

    // Push remaining
    if (lineChunk) {
      result.push(lineChunk);
    }

    return result;
  }

  // Split by paragraphs/sections
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';

  for (const para of paragraphs) {
    // If paragraph itself is too large, split it first
    if (para.length > MAX_CHARS_PER_CHUNK) {
      // Flush current chunk
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      // Split and add the large paragraph
      const splitParts = splitLargeText(para);
      chunks.push(...splitParts);
      continue;
    }

    // Try to add paragraph to current chunk
    const potentialChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;

    if (potentialChunk.length > MAX_CHARS_PER_CHUNK) {
      // Flush current chunk and start new one with this paragraph
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = para;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [content.slice(0, MAX_CHARS_PER_CHUNK)];
}

export interface IngestionResult {
  success: boolean;
  pitchId: string;
  projectName: string;
  stats: {
    filesProcessed: number;
    chunksCreated: number;
    totalTokens: number;
    embeddingsGenerated: number;
  };
  error?: string;
}

export interface IngestionProgress {
  phase: 'parsing' | 'chunking' | 'embedding' | 'storing' | 'done';
  current: number;
  total: number;
  message: string;
}

/**
 * Find an existing qualification for the audit project by name
 */
export async function findLeadByName(projectName: string): Promise<string | null> {
  const normalizedName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const existingQualifications = await db.select().from(pitches);

  for (const qualification of existingQualifications) {
    const qualificationCustomer = (qualification.customerName || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (
      qualificationCustomer.includes(normalizedName) ||
      normalizedName.includes(qualificationCustomer)
    ) {
      return qualification.id;
    }
  }

  return null;
}

/**
 * Verify a qualification exists by ID
 */
export async function verifyLeadExists(pitchId: string): Promise<boolean> {
  const result = await db
    .select({ id: pitches.id })
    .from(pitches)
    .where(eq(pitches.id, pitchId))
    .limit(1);

  return result.length > 0;
}

/**
 * Get all pitches for selection
 */
export async function getAllLeads(): Promise<Array<{ id: string; customerName: string }>> {
  return db.select({ id: pitches.id, customerName: pitches.customerName }).from(pitches);
}

/**
 * Delete existing audit chunks for a lead (idempotent)
 */
async function deleteExistingAuditChunks(pitchId: string): Promise<number> {
  const existing = await db
    .select({ id: dealEmbeddings.id })
    .from(dealEmbeddings)
    .where(and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.agentName, AGENT_NAME)));

  if (existing.length > 0) {
    await db
      .delete(dealEmbeddings)
      .where(and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.agentName, AGENT_NAME)));
  }

  return existing.length;
}

/**
 * Ingest audit data into the RAG system
 *
 * Each file is stored as a single raw chunk with its full content.
 *
 * @param auditPath - Path to the audit directory
 * @param pitchId - Qualification ID to associate data with (required)
 * @param onProgress - Optional callback for progress updates
 * @returns Ingestion result with statistics
 */
export async function ingestAuditToRAG(
  auditPath: string,
  pitchId: string,
  onProgress?: (progress: IngestionProgress) => void
): Promise<IngestionResult> {
  // Check if embeddings are enabled
  if (!isEmbeddingEnabled()) {
    return {
      success: false,
      pitchId: '',
      projectName: '',
      stats: { filesProcessed: 0, chunksCreated: 0, totalTokens: 0, embeddingsGenerated: 0 },
      error: 'Embeddings are not enabled. Set OPENAI_EMBEDDING_API_KEY in your environment.',
    };
  }

  // Verify qualification exists
  const qualificationExists = await verifyLeadExists(pitchId);
  if (!qualificationExists) {
    return {
      success: false,
      pitchId: '',
      projectName: '',
      stats: { filesProcessed: 0, chunksCreated: 0, totalTokens: 0, embeddingsGenerated: 0 },
      error: `Qualification not found: ${pitchId}`,
    };
  }

  try {
    // 1. Parse audit directory
    onProgress?.({ phase: 'parsing', current: 0, total: 1, message: 'Parsing audit files...' });

    const audit = await parseAuditDirectory(auditPath);
    const auditStats = getAuditStats(audit);

    // 2. Delete existing audit chunks (idempotent)
    await deleteExistingAuditChunks(pitchId);

    // 3. Store all files as raw chunks (split if too large)
    let chunksCreated = 0;
    let totalTokens = 0;
    let embeddingsGenerated = 0;
    let globalChunkIndex = 0;

    for (let i = 0; i < audit.files.length; i++) {
      const file = audit.files[i];

      onProgress?.({
        phase: 'embedding',
        current: i,
        total: audit.files.length,
        message: `Processing ${file.filename}...`,
      });

      const content = file.content;

      // Skip empty files
      if (!content || content.trim().length === 0) {
        continue;
      }
      const tokenCount = estimateTokens(content);
      totalTokens += tokenCount;

      // Determine chunk type based on file type
      const chunkType =
        file.sourceType === 'json'
          ? `audit_${file.metadata.category}`
          : `audit_${file.metadata.category}_raw`;

      // Split content if too large for embedding model
      const contentChunks = splitContentForEmbedding(content);

      for (let chunkIdx = 0; chunkIdx < contentChunks.length; chunkIdx++) {
        const chunkContent = contentChunks[chunkIdx];
        const chunkTokens = estimateTokens(chunkContent);

        // Generate embedding
        const rawChunk = {
          chunkIndex: chunkIdx,
          content: chunkContent,
          tokenCount: chunkTokens,
          metadata: {
            type: 'section' as const,
            startPosition: 0,
            endPosition: chunkContent.length,
          },
        };

        const withEmbedding = await generateRawChunkEmbeddings([rawChunk]);

        await db.insert(dealEmbeddings).values({
          pitchId,
          agentName: AGENT_NAME,
          chunkType,
          chunkIndex: globalChunkIndex++,
          content: chunkContent,
          embedding: withEmbedding?.[0]?.embedding ?? null,
          metadata: JSON.stringify({
            sourceFile: file.filename,
            sourceType: file.sourceType,
            category: file.metadata.category,
            projectName: file.metadata.projectName,
            fileSize: file.metadata.fileSize,
            chunkPart:
              contentChunks.length > 1 ? `${chunkIdx + 1}/${contentChunks.length}` : undefined,
          }),
        });

        chunksCreated++;
        if (withEmbedding?.[0]?.embedding) {
          embeddingsGenerated++;
        }
      }
    }

    onProgress?.({
      phase: 'done',
      current: chunksCreated,
      total: chunksCreated,
      message: 'Ingestion complete!',
    });

    return {
      success: true,
      pitchId,
      projectName: audit.projectName,
      stats: {
        filesProcessed: auditStats.totalFiles,
        chunksCreated,
        totalTokens,
        embeddingsGenerated,
      },
    };
  } catch (error) {
    console.error('[Audit Ingestion] Failed:', error);
    return {
      success: false,
      pitchId: '',
      projectName: '',
      stats: { filesProcessed: 0, chunksCreated: 0, totalTokens: 0, embeddingsGenerated: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a qualification has audit data in the RAG system
 */
export async function hasAuditData(pitchId: string): Promise<boolean> {
  const result = await db
    .select({ id: dealEmbeddings.id })
    .from(dealEmbeddings)
    .where(and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.agentName, AGENT_NAME)))
    .limit(1);

  return result.length > 0;
}

/**
 * Get audit chunk count for a qualification
 */
export async function getAuditChunkCount(pitchId: string): Promise<number> {
  const result = await db
    .select({ id: dealEmbeddings.id })
    .from(dealEmbeddings)
    .where(and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.agentName, AGENT_NAME)));

  return result.length;
}
