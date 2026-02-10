import { z } from 'zod';

import { excerptText } from '@/lib/qualifications/sources';
import { formatSourceCitation } from '@/lib/rag/citations';
import type { RawRAGResult } from '@/lib/rag/raw-retrieval-service';

export type SourcePanelItem = {
  citation: string;
  excerpt?: string;
  /**
   * Similarity score in [0..1] (or percentage in [0..100] for backwards-compat).
   * UI should treat <= 1 as ratio, > 1 as percent.
   */
  score?: number;
};

export type CitedExcerptItem = {
  excerpt: string;
  citation?: string;
  score?: number;
};

export type JsonRenderTree = {
  root: string | null;
  elements: Record<
    string,
    {
      key: string;
      type: string;
      props: Record<string, unknown>;
      children?: string[];
    }
  >;
};

export const sourcesPanelPropsSchema = z.object({
  title: z.string().optional(),
  sources: z
    .array(
      z.object({
        citation: z.string().min(1),
        excerpt: z.string().optional(),
        score: z.number().min(0).max(100).optional(),
      })
    )
    .min(1),
});

export const citedExcerptsPropsSchema = z.object({
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        excerpt: z.string().min(1),
        citation: z.string().optional(),
        score: z.number().min(0).max(100).optional(),
      })
    )
    .min(1),
});

const chartDatumSchema = z.object({
  label: z.string().min(1),
  value: z.number().finite(),
});

const chartCommonPropsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  data: z.array(chartDatumSchema).min(1),
  format: z.enum(['number', 'percent', 'currency']).optional(),
  height: z.number().int().min(160).max(800).optional(),
  color: z.string().optional(),
});

export const barChartPropsSchema = chartCommonPropsSchema;
export const areaChartPropsSchema = chartCommonPropsSchema;

export function validatePropsForElementType(type: string, props: unknown): string | null {
  switch (type) {
    case 'SourcesPanel': {
      const parsed = sourcesPanelPropsSchema.safeParse(props);
      return parsed.success ? null : parsed.error.message;
    }
    case 'CitedExcerpts': {
      const parsed = citedExcerptsPropsSchema.safeParse(props);
      return parsed.success ? null : parsed.error.message;
    }
    case 'BarChart': {
      const parsed = barChartPropsSchema.safeParse(props);
      return parsed.success ? null : parsed.error.message;
    }
    case 'AreaChart': {
      const parsed = areaChartPropsSchema.safeParse(props);
      return parsed.success ? null : parsed.error.message;
    }
    default:
      return null;
  }
}

function normalizeCitation(citation: string): string {
  return String(citation || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAndDedupeSources(
  sources: SourcePanelItem[],
  maxSources: number = 10
): SourcePanelItem[] {
  const sorted = [...(sources || [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const out: SourcePanelItem[] = [];
  const seen = new Set<string>();

  for (const s of sorted) {
    const citation = normalizeCitation(s.citation);
    if (!citation) continue;
    if (seen.has(citation)) continue;
    seen.add(citation);
    out.push({
      citation,
      ...(s.excerpt ? { excerpt: String(s.excerpt) } : {}),
      ...(typeof s.score === 'number' ? { score: s.score } : {}),
    });
    if (out.length >= maxSources) break;
  }

  return out;
}

export function buildSourcesFromRawChunks(
  chunks: RawRAGResult[],
  options?: { maxSources?: number; maxExcerptChars?: number }
): SourcePanelItem[] {
  const maxExcerptChars = options?.maxExcerptChars ?? 350;
  const raw = (chunks || [])
    .map(chunk => {
      const citation = chunk.source
        ? formatSourceCitation(chunk.source)
        : chunk.webSource?.url || (chunk.metadata as any)?.webSource?.url || '';
      const normalized = normalizeCitation(citation);
      if (!normalized) return null;

      return {
        citation: normalized,
        excerpt: excerptText(chunk.content, maxExcerptChars),
        score: chunk.similarity,
      } satisfies SourcePanelItem;
    })
    .filter(Boolean) as SourcePanelItem[];

  return normalizeAndDedupeSources(raw, options?.maxSources ?? 10);
}

export function injectSourcesPanel(
  tree: JsonRenderTree,
  sources: SourcePanelItem[],
  options?: { subSectionTitle?: string; panelTitle?: string; maxSources?: number }
): JsonRenderTree {
  const normalized = normalizeAndDedupeSources(sources, options?.maxSources ?? 10);
  if (!tree?.root || !tree.elements?.[tree.root] || normalized.length === 0) return tree;

  // Idempotency: if tree already contains a SourcesPanel, don't inject another.
  for (const el of Object.values(tree.elements)) {
    if (el?.type === 'SourcesPanel') return tree;
  }

  const existingKeys = new Set(Object.keys(tree.elements));
  const uniqueKey = (base: string) => {
    let k = base;
    let i = 2;
    while (existingKeys.has(k)) {
      k = `${base}_${i++}`;
    }
    existingKeys.add(k);
    return k;
  };

  const subKey = uniqueKey('__auto_sources_sub');
  const panelKey = uniqueKey('__auto_sources_panel');

  const elements: JsonRenderTree['elements'] = { ...tree.elements };
  const rootKey = tree.root;
  const rootEl = elements[rootKey];
  const rootChildren = Array.isArray(rootEl.children) ? [...rootEl.children] : [];
  rootChildren.push(subKey);
  elements[rootKey] = { ...rootEl, children: rootChildren };

  elements[subKey] = {
    key: subKey,
    type: 'SubSection',
    props: { title: options?.subSectionTitle ?? 'Quellen' },
    children: [panelKey],
  };

  elements[panelKey] = {
    key: panelKey,
    type: 'SourcesPanel',
    props: {
      title: options?.panelTitle ?? 'Quellen',
      sources: normalized,
    },
  };

  return { ...tree, elements };
}

function isAlignmentRow(line: string): boolean {
  // Examples:
  // | :--- | :--- |
  // |---|---|
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitMarkdownRow(line: string): string[] {
  const cleaned = String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '');
  if (!cleaned) return [];

  return cleaned.split('|').map(cell =>
    cell
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/`/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function looksLikeMarkdownTable(text: string): boolean {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  return /\|\s*:?-{3,}:?\s*\|/m.test(normalized);
}

export function parseMarkdownTable(text: string): {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string>>;
} | null {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i];
    const sep = lines[i + 1];
    if (!header.includes('|')) continue;
    if (!isAlignmentRow(sep)) continue;

    const headerCells = splitMarkdownRow(header);
    if (headerCells.length === 0) continue;

    const columns = headerCells.map((label, idx) => ({
      key: `col${idx}`,
      label: label || `Spalte ${idx + 1}`,
    }));

    const rows: Array<Record<string, string>> = [];
    for (let j = i + 2; j < lines.length; j++) {
      const rowLine = lines[j];
      if (!rowLine.includes('|')) break;
      if (/^\s*$/.test(rowLine)) break;
      if (isAlignmentRow(rowLine)) continue;

      const cells = splitMarkdownRow(rowLine);
      if (cells.length === 0) continue;

      const row: Record<string, string> = {};
      for (let c = 0; c < columns.length; c++) {
        row[columns[c].key] = cells[c] ?? '';
      }

      const hasAnyValue = Object.values(row).some(v => String(v).trim().length > 0);
      if (hasAnyValue) rows.push(row);
    }

    if (rows.length === 0) return null;
    return { columns, rows };
  }

  return null;
}
