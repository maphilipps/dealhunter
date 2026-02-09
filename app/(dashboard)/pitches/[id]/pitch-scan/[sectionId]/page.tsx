import { eq, and } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SectionRendererClient } from './section-renderer-client';

import { MessageResponse } from '@/components/ai-elements/message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';
import { dealEmbeddings, pitches } from '@/lib/db/schema';
import { getSectionLabel } from '@/lib/pitch-scan/section-ids';

type Finding = {
  problem: string;
  relevance: string;
  recommendation: string;
  estimatedImpact?: 'high' | 'medium' | 'low';
};

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
  findings: Finding[];
  [key: string]: unknown;
};

function isStructuredPhaseContent(content: unknown): content is StructuredPhaseContent {
  if (!content || typeof content !== 'object') return false;
  const c = content as Record<string, unknown>;
  if (typeof c.summary !== 'string' || c.summary.length === 0) return false;
  if (!Array.isArray(c.findings) || c.findings.length === 0) return false;
  return c.findings.every(f => {
    if (!f || typeof f !== 'object') return false;
    const ff = f as Record<string, unknown>;
    return (
      typeof ff.problem === 'string' &&
      typeof ff.relevance === 'string' &&
      typeof ff.recommendation === 'string'
    );
  });
}

export default async function SectionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>;
}) {
  const { id, sectionId } = await params;

  // Verify pitch exists
  const [lead] = await db
    .select({ id: pitches.id, customerName: pitches.customerName })
    .from(pitches)
    .where(eq(pitches.id, id))
    .limit(1);

  if (!lead) {
    notFound();
  }

  // Fetch section data from deal_embeddings where agentName matches sectionId.
  // Note: While a scan is running (or before first run), this can legitimately be empty.
  const chunks = await db
    .select({
      id: dealEmbeddings.id,
      chunkType: dealEmbeddings.chunkType,
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
      confidence: dealEmbeddings.confidence,
      createdAt: dealEmbeddings.createdAt,
    })
    .from(dealEmbeddings)
    .where(and(eq(dealEmbeddings.pitchId, id), eq(dealEmbeddings.agentName, sectionId)));

  const sectionLabelFromMetadata = (() => {
    for (const chunk of chunks) {
      if (!chunk.metadata) continue;
      try {
        const meta = JSON.parse(chunk.metadata) as Record<string, unknown>;
        const label = meta && typeof meta.label === 'string' ? meta.label : null;
        if (label) return label;
      } catch {
        // ignore parse errors
      }
    }
    return null;
  })();

  const sectionLabel = sectionLabelFromMetadata ?? getSectionLabel(sectionId);

  // Try to find a json-render tree in the chunks
  let renderTree: Record<string, unknown> | null = null;
  let confidence: number | null = null;
  let timestamp: Date | null = null;
  let markdownContent: MarkdownPhaseContent | null = null;
  let structuredContent: StructuredPhaseContent | null = null;

  for (const chunk of chunks) {
    if (chunk.chunkType === 'json_render' || chunk.chunkType === 'json-render') {
      try {
        renderTree = JSON.parse(chunk.content) as Record<string, unknown>;
      } catch {
        // ignore parse errors
      }
    }
    if (!markdownContent) {
      try {
        const parsed = JSON.parse(chunk.content) as unknown;
        if (isMarkdownContent(parsed)) markdownContent = parsed;
      } catch {
        // ignore
      }
    }
    if (!markdownContent && !structuredContent) {
      try {
        const parsed = JSON.parse(chunk.content) as unknown;
        if (isStructuredPhaseContent(parsed)) structuredContent = parsed;
      } catch {
        // ignore
      }
    }
    if (chunk.confidence != null) {
      confidence = chunk.confidence;
    }
    if (chunk.createdAt) {
      timestamp = chunk.createdAt;
    }
  }

  const hasData = renderTree || chunks.length > 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/pitches/${id}/pitch-scan`}
          className="hover:text-foreground transition-colors"
        >
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Pitch Scan
          </Button>
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{sectionLabel}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{sectionLabel}</h1>
          {timestamp && (
            <p className="text-sm text-muted-foreground mt-1">
              Erstellt am{' '}
              {timestamp.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
        {confidence != null && (
          <Badge variant="outline" className="tabular-nums">
            Konfidenz: {Math.round(confidence)}%
          </Badge>
        )}
      </div>

      {/* Content */}
      {!hasData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keine Daten vorhanden</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Für diese Sektion liegen noch keine Ergebnisse vor. Starte den Pitch Scan, um
              Ergebnisse zu generieren.
            </p>
            <Link href={`/pitches/${id}/pitch-scan`}>
              <Button variant="outline" size="sm" className="mt-4">
                Zurück zum Pitch Scan
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : renderTree ? (
        <SectionRendererClient tree={renderTree} />
      ) : markdownContent ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">{markdownContent.summary}</p>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MessageResponse>{markdownContent.markdown}</MessageResponse>
            </div>
          </CardContent>
        </Card>
      ) : structuredContent ? (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p>{structuredContent.summary}</p>
            </div>
            <div className="space-y-3">
              {structuredContent.findings.map((f, idx) => (
                <div key={idx} className="rounded-md border bg-card/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Finding {idx + 1}</p>
                    {f.estimatedImpact && (
                      <Badge variant="secondary" className="text-[10px]">
                        Impact: {f.estimatedImpact}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Problem</p>
                      <p>{f.problem}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Relevanz</p>
                      <p>{f.relevance}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Empfehlung</p>
                      <p>{f.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {chunks.map(chunk => (
                <div key={chunk.id} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {chunk.chunkType}
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm">{chunk.content}</pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
