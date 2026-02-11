import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import {
  chunkToRfpPdfSourceRef,
  chunkToWebSourceRef,
  dedupeSourceRefs,
  type SourceRef,
} from '@/lib/qualifications/sources';
import type { RawRAGResult } from '@/lib/rag/raw-retrieval-service';

import { generateEmbeddingsWithConcurrency } from './section-utils';

export const EvidenceFieldsSchema = z.union([
  z.object({
    evidenceChunkIds: z.array(z.string()).min(1),
    needsManualReview: z.literal(false),
  }),
  z.object({
    evidenceChunkIds: z.array(z.string()).length(0),
    needsManualReview: z.literal(true),
  }),
]);

export type EvidenceFields = z.infer<typeof EvidenceFieldsSchema>;

/**
 * Simplified evidence fields for LLM output schemas.
 * Use this instead of z.intersection with EvidenceFieldsSchema.
 * The strict union validation (min 1 if false, length 0 if true) is
 * overly strict for LLM output - runtime logic checks this anyway.
 */
export const EvidenceFieldsForLLM = z.object({
  evidenceChunkIds: z.array(z.string()),
  needsManualReview: z.boolean(),
});

export type StoredSectionFinding = {
  content: string;
  category: 'fact' | 'recommendation';
  metadata: Record<string, unknown>;
};

export function collectRfpSourcesFromChunkIds(
  chunkIds: string[],
  chunkById: Map<string, RawRAGResult>
): SourceRef[] {
  const out: SourceRef[] = [];
  for (const id of chunkIds) {
    const c = chunkById.get(id);
    if (!c) continue;

    const srcPdf = chunkToRfpPdfSourceRef(c);
    if (srcPdf) {
      out.push(srcPdf);
      continue;
    }

    const srcWeb = chunkToWebSourceRef(c);
    if (srcWeb) out.push(srcWeb);
  }
  return out;
}

export function buildEvidenceSources(options: {
  evidenceChunkIds: string[];
  needsManualReview: boolean;
  chunkById: Map<string, RawRAGResult>;
  manualReviewRationale: string;
}): SourceRef[] {
  const { evidenceChunkIds, needsManualReview, chunkById, manualReviewRationale } = options;

  const rfpSources = collectRfpSourcesFromChunkIds(evidenceChunkIds, chunkById);
  const sources: SourceRef[] = needsManualReview
    ? [
        ...rfpSources,
        {
          kind: 'assumption',
          label: 'Manuelle Prüfung erforderlich',
          rationale: manualReviewRationale,
        },
      ]
    : rfpSources;

  if (sources.length === 0 && evidenceChunkIds.length > 0) {
    sources.push({
      kind: 'assumption',
      label: 'Chunk ohne PDF-Locator',
      rationale:
        'Der gefundene Raw-Chunk hat keine Seiten-/Absatz-Lokatoren (includeLocators fehlt oder Parser konnte Quelle nicht ableiten).',
    });
  }

  return sources;
}

function extractBidderQuestionText(content: string): string {
  const normalized = String(content || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  return normalized.replace(/^Offene Frage:\s*/i, '').trim();
}

export async function storeDecisionGradeSectionArtifacts(options: {
  preQualificationId: string;
  sectionId: string;
  tree: { root: string; elements: Record<string, unknown> };
  confidence: number;
  dashboardHighlights: string[];
  findings: StoredSectionFinding[];
  minFindings?: number;
}) {
  const {
    preQualificationId,
    sectionId,
    tree,
    confidence,
    dashboardHighlights,
    findings,
    minFindings = 10,
  } = options;

  // Delete any stale visualization for this section first.
  await db
    .delete(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        eq(dealEmbeddings.chunkType, 'visualization'),
        sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
      )
    );

  await db.insert(dealEmbeddings).values({
    pitchId: null,
    preQualificationId,
    agentName: 'prequal_section_agent',
    chunkType: 'visualization',
    chunkIndex: 0,
    chunkCategory: 'elaboration',
    content: JSON.stringify(tree),
    confidence,
    embedding: null,
    metadata: JSON.stringify({
      sectionId,
      isVisualization: true,
      elementCount: Object.keys(tree.elements).length,
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
    }),
  });

  await db.insert(dealEmbeddings).values({
    pitchId: null,
    preQualificationId,
    agentName: `dashboard_${sectionId}`,
    chunkType: 'dashboard_highlight',
    chunkIndex: 0,
    chunkCategory: 'elaboration',
    content: JSON.stringify(dashboardHighlights.slice(0, 3)),
    confidence,
    embedding: null,
    metadata: JSON.stringify({ sectionId }),
  });

  const normalized: StoredSectionFinding[] = [...findings];
  const padSource: SourceRef = {
    kind: 'assumption',
    label: 'Decision-grade Mindesttiefe',
    rationale: 'Wenn Quellenlage dünn ist, werden manuelle Prüfaufgaben als Annahmen dokumentiert.',
  };

  while (normalized.length < minFindings) {
    normalized.push({
      content:
        `Manuelle Prüfung: Angaben im Originaldokument verifizieren und offene Punkte als Bieterfrage klären.` +
        ` (Annahme: ${padSource.label})`,
      category: 'recommendation',
      metadata: {
        sectionId,
        kind: 'manual_check',
        sources: [padSource],
      },
    });
  }

  const capped = normalized.slice(0, 20);
  const embeddings = await generateEmbeddingsWithConcurrency(
    capped.map(f => f.content),
    { concurrency: 3 }
  );

  const findingRows: (typeof dealEmbeddings.$inferInsert)[] = capped.map((finding, idx) => ({
    pitchId: null,
    preQualificationId,
    agentName: 'prequal_section_agent',
    chunkType: sectionId,
    chunkIndex: idx,
    chunkCategory: finding.category,
    content: finding.content,
    confidence,
    requiresValidation: false,
    embedding: embeddings[idx],
    metadata: JSON.stringify(finding.metadata),
  }));

  await db.insert(dealEmbeddings).values(findingRows);

  const bidderQuestions = capped
    .filter(f => f.metadata.kind === 'open_question')
    .map(f => {
      const metaSources = Array.isArray((f.metadata as { sources?: unknown }).sources)
        ? ((f.metadata as { sources: unknown[] }).sources as SourceRef[])
        : [];

      return {
        content: extractBidderQuestionText(f.content),
        sources: dedupeSourceRefs(metaSources),
      };
    })
    .filter(q => q.content.length > 0);

  if (bidderQuestions.length > 0) {
    const bidderEmbeddings = await generateEmbeddingsWithConcurrency(
      bidderQuestions.map(q => q.content),
      { concurrency: 2 }
    );

    const bidderRows: (typeof dealEmbeddings.$inferInsert)[] = bidderQuestions.map((q, idx) => ({
      pitchId: null,
      preQualificationId,
      agentName: 'prequal_section_agent',
      chunkType: 'bidder_question',
      chunkIndex: idx,
      chunkCategory: 'recommendation' as const,
      content: q.content,
      confidence,
      requiresValidation: false,
      embedding: bidderEmbeddings[idx],
      metadata: JSON.stringify({
        sectionId,
        kind: 'open_question',
        sources: q.sources,
        centralized: true,
      }),
    }));

    await db.insert(dealEmbeddings).values(bidderRows);
  }
}
