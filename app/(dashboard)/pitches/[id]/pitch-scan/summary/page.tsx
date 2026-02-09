import { eq, and, inArray } from 'drizzle-orm';
import { ArrowLeft, ArrowRight, FileSearch } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MessageResponse } from '@/components/ai-elements/message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';
import { dealEmbeddings, pitches, auditScanRuns } from '@/lib/db/schema';
import { PHASE_DEFINITIONS } from '@/lib/pitch-scan/constants';
import {
  PITCH_SCAN_SECTIONS,
  PITCH_SCAN_SECTION_LABELS,
  type BuiltInSectionId,
} from '@/lib/pitch-scan/section-ids';

// ─── Type Guards (same as [sectionId]/page.tsx) ─────────────────────────────

type MarkdownPhaseContent = {
  summary: string;
  markdown: string;
};

function isMarkdownContent(content: unknown): content is MarkdownPhaseContent {
  if (!content || typeof content !== 'object') return false;
  const c = content as Record<string, unknown>;
  return (
    typeof c.summary === 'string' &&
    c.summary.length > 0 &&
    typeof c.markdown === 'string' &&
    c.markdown.length > 0
  );
}

type StructuredPhaseContent = {
  summary: string;
  findings: Array<{
    problem: string;
    relevance: string;
    recommendation: string;
    estimatedImpact?: 'high' | 'medium' | 'low';
  }>;
  [key: string]: unknown;
};

function isStructuredPhaseContent(content: unknown): content is StructuredPhaseContent {
  if (!content || typeof content !== 'object') return false;
  const c = content as Record<string, unknown>;
  if (typeof c.summary !== 'string' || c.summary.length === 0) return false;
  if (!Array.isArray(c.findings) || c.findings.length === 0) return false;
  return c.findings.every((f: unknown) => {
    if (!f || typeof f !== 'object') return false;
    const ff = f as Record<string, unknown>;
    return (
      typeof ff.problem === 'string' &&
      typeof ff.relevance === 'string' &&
      typeof ff.recommendation === 'string'
    );
  });
}

// ─── Parsed section data ────────────────────────────────────────────────────

interface ParsedSection {
  sectionId: string;
  label: string;
  summary: string | null;
  markdown: string | null;
  confidence: number | null;
}

function parseChunks(
  sectionId: string,
  label: string,
  chunks: Array<{ content: string; confidence: number | null }>
): ParsedSection {
  let summary: string | null = null;
  let markdown: string | null = null;
  let confidence: number | null = null;

  for (const chunk of chunks) {
    if (confidence === null && chunk.confidence != null) {
      confidence = chunk.confidence;
    }
    try {
      const parsed = JSON.parse(chunk.content) as unknown;
      if (!summary && isMarkdownContent(parsed)) {
        summary = parsed.summary;
        markdown = parsed.markdown;
      } else if (!summary && isStructuredPhaseContent(parsed)) {
        summary = parsed.summary;
      }
    } catch {
      // ignore parse errors
    }
  }

  return { sectionId, label, summary, markdown, confidence };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function PitchScanSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Verify pitch exists
  const [lead] = await db
    .select({
      id: pitches.id,
      customerName: pitches.customerName,
      websiteUrl: pitches.websiteUrl,
    })
    .from(pitches)
    .where(eq(pitches.id, id))
    .limit(1);

  if (!lead) {
    notFound();
  }

  // Get latest completed run for timestamp
  const [latestRun] = await db
    .select({ completedAt: auditScanRuns.completedAt })
    .from(auditScanRuns)
    .where(and(eq(auditScanRuns.pitchId, id), eq(auditScanRuns.status, 'completed')))
    .orderBy(auditScanRuns.completedAt)
    .limit(1);

  // Fetch all section data at once
  const allSectionIds = Object.values(PITCH_SCAN_SECTIONS);
  const allChunks = await db
    .select({
      agentName: dealEmbeddings.agentName,
      content: dealEmbeddings.content,
      confidence: dealEmbeddings.confidence,
    })
    .from(dealEmbeddings)
    .where(and(eq(dealEmbeddings.pitchId, id), inArray(dealEmbeddings.agentName, allSectionIds)));

  // Group chunks by agentName
  const chunksBySection = new Map<string, Array<{ content: string; confidence: number | null }>>();
  for (const chunk of allChunks) {
    const existing = chunksBySection.get(chunk.agentName) ?? [];
    existing.push({ content: chunk.content, confidence: chunk.confidence });
    chunksBySection.set(chunk.agentName, existing);
  }

  // No data at all
  if (chunksBySection.size === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/pitches/${id}/pitch-scan`}>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              Pitch Scan
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Noch keine Ergebnisse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Es wurden noch keine Scan-Ergebnisse generiert. Starte den Pitch Scan, um eine
              Zusammenfassung zu erhalten.
            </p>
            <Link href={`/pitches/${id}/pitch-scan`}>
              <Button variant="outline" size="sm" className="mt-4">
                Zum Pitch Scan
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse sections in DAG order, documentation first
  const documentationId = PITCH_SCAN_SECTIONS.DOCUMENTATION;
  const documentationChunks = chunksBySection.get(documentationId);
  const documentationSection = documentationChunks
    ? parseChunks(documentationId, PITCH_SCAN_SECTION_LABELS[documentationId], documentationChunks)
    : null;

  // All other sections in phase order (excluding documentation)
  const otherSections: ParsedSection[] = [];
  for (const phase of PHASE_DEFINITIONS) {
    if (phase.id === documentationId) continue;
    const chunks = chunksBySection.get(phase.id);
    if (!chunks) continue;
    otherSections.push(
      parseChunks(
        phase.id,
        PITCH_SCAN_SECTION_LABELS[phase.id as BuiltInSectionId] ?? phase.label,
        chunks
      )
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/pitches/${id}/pitch-scan`}>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Pitch Scan
          </Button>
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Zusammenfassung</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pitch Scan — Zusammenfassung</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {lead.customerName && <span>{lead.customerName}</span>}
          {lead.websiteUrl && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span>{lead.websiteUrl}</span>
            </>
          )}
          {latestRun?.completedAt && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span>
                Scan vom{' '}
                {latestRun.completedAt.toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Executive Summary (Documentation) — full content */}
      {documentationSection && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5" />
                {documentationSection.label}
              </CardTitle>
              {documentationSection.confidence != null && (
                <Badge variant="outline" className="tabular-nums">
                  {Math.round(documentationSection.confidence)}%
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {documentationSection.markdown ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MessageResponse>{documentationSection.markdown}</MessageResponse>
              </div>
            ) : documentationSection.summary ? (
              <p className="text-sm text-muted-foreground">{documentationSection.summary}</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* All other sections — summary + link to details */}
      {otherSections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Sektionen</h2>
          <div className="grid gap-4">
            {otherSections.map(section => (
              <Card key={section.sectionId}>
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{section.label}</h3>
                      {section.confidence != null && (
                        <Badge variant="outline" className="tabular-nums text-xs">
                          {Math.round(section.confidence)}%
                        </Badge>
                      )}
                    </div>
                    {section.summary ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {section.summary}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Keine Zusammenfassung verfuegbar
                      </p>
                    )}
                  </div>
                  <Link href={`/pitches/${id}/pitch-scan/${section.sectionId}`}>
                    <Button variant="ghost" size="sm" className="shrink-0 gap-1">
                      Details
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t pt-4">
        <Link href={`/pitches/${id}/pitch-scan`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurueck zum Scan-Hub
          </Button>
        </Link>
      </div>
    </div>
  );
}
