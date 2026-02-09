import { formatSourceCitation } from '@/lib/rag/citations';
import type { RawRAGResult } from '@/lib/rag/raw-retrieval-service';

export type RfpPdfSourceRef = {
  kind: 'rfp_pdf';
  chunkId: string;
  fileName: string;
  page: number;
  paragraphStart: number;
  paragraphEnd: number;
  heading: string | null;
  excerpt: string;
};

export type WebSourceRef = {
  kind: 'web';
  url: string;
  title?: string;
  accessedAt: string; // ISO timestamp
  excerpt?: string;
};

export type InternalReferenceSourceRef = {
  kind: 'internal_reference';
  referenceId: string;
  projectName: string;
  customerName: string;
};

export type AssumptionSourceRef = {
  kind: 'assumption';
  label: string;
  rationale: string;
};

export type SourceRef =
  | RfpPdfSourceRef
  | WebSourceRef
  | InternalReferenceSourceRef
  | AssumptionSourceRef;

export function excerptText(text: string, maxChars: number = 650): string {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 1)}…`;
}

export function chunkToRfpPdfSourceRef(chunk: RawRAGResult): RfpPdfSourceRef | null {
  const s: any = (chunk as any).source;
  if (!s || typeof s !== 'object' || s.kind !== 'pdf') return null;

  // Enforce required shape for "rfp_pdf" sources.
  return {
    kind: 'rfp_pdf',
    chunkId: chunk.chunkId,
    fileName: s.fileName,
    page: s.page,
    paragraphStart: s.paragraphStart,
    paragraphEnd: s.paragraphEnd,
    heading: s.heading ?? null,
    excerpt: excerptText(chunk.content),
  };
}

export function chunkToWebSourceRef(chunk: RawRAGResult): WebSourceRef | null {
  const ws: any = (chunk as any).webSource ?? (chunk as any).metadata?.webSource;
  if (!ws || typeof ws !== 'object' || typeof ws.url !== 'string' || ws.url.trim() === '')
    return null;

  return {
    kind: 'web',
    url: ws.url,
    ...(ws.title ? { title: String(ws.title) } : {}),
    accessedAt: ws.accessedAt ? String(ws.accessedAt) : new Date().toISOString(),
    excerpt: excerptText(chunk.content),
  };
}

export function formatInlineSourceRef(source: SourceRef): string {
  switch (source.kind) {
    case 'rfp_pdf': {
      const para =
        source.paragraphStart === source.paragraphEnd
          ? `Absatz ${source.paragraphStart}`
          : `Absatz ${source.paragraphStart}-${source.paragraphEnd}`;
      const heading = source.heading ? `, "${source.heading}"` : '';
      return `Quelle: ${source.fileName}, S. ${source.page}, ${para}${heading}`;
    }
    case 'web':
      return `Quelle: ${source.url}`;
    case 'internal_reference':
      return `Quelle: Intern Ref #${source.referenceId}`;
    case 'assumption':
      return `Annahme: ${source.label}`;
  }
}

/**
 * Standard inline block for export-safe claim citations.
 * Example: "... (Quelle: foo.pdf, S. 12, Absatz 3-4 | Annahme: 1 PT = 8h)"
 */
export function formatInlineSourcesBlock(sources: SourceRef[]): string {
  const deduped = dedupeSourceRefs(sources);
  if (deduped.length === 0) return '';
  return ` (${deduped.map(formatInlineSourceRef).join(' | ')})`;
}

export function sourceRefKey(source: SourceRef): string {
  switch (source.kind) {
    case 'rfp_pdf':
      return `rfp_pdf:${source.fileName}:${source.page}:${source.paragraphStart}-${source.paragraphEnd}:${source.heading ?? ''}`;
    case 'web':
      return `web:${source.url}`;
    case 'internal_reference':
      return `internal_reference:${source.referenceId}`;
    case 'assumption':
      return `assumption:${source.label}`;
  }
}

export function dedupeSourceRefs(sources: SourceRef[]): SourceRef[] {
  const out: SourceRef[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    const k = sourceRefKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function formatRfpChunkCitationForHumans(chunk: RawRAGResult): string | null {
  if (!chunk.source) return null;
  return formatSourceCitation(chunk.source);
}
