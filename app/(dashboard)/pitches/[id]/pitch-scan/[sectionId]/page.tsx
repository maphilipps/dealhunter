import { eq, and } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SectionRendererClient } from './section-renderer-client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';
import { dealEmbeddings, pitches } from '@/lib/db/schema';
import { getSectionLabel, isBuiltInSection } from '@/lib/pitch-scan/section-ids';

export default async function SectionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>;
}) {
  const { id, sectionId } = await params;

  // Validate sectionId - allow both built-in and dynamic sections
  const isValid = isBuiltInSection(sectionId);
  // For now, only validate built-in sections. Dynamic sections will be handled later.
  if (!isValid) {
    // TODO: Check if it's a valid dynamic section from the checkpoint
    notFound();
  }

  const sectionLabel = getSectionLabel(sectionId);

  // Verify pitch exists
  const [lead] = await db
    .select({ id: pitches.id, customerName: pitches.customerName })
    .from(pitches)
    .where(eq(pitches.id, id))
    .limit(1);

  if (!lead) {
    notFound();
  }

  // Fetch section data from deal_embeddings where agentName matches sectionId
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

  // Try to find a json-render tree in the chunks
  let renderTree: Record<string, unknown> | null = null;
  let confidence: number | null = null;
  let timestamp: Date | null = null;

  for (const chunk of chunks) {
    if (chunk.chunkType === 'json_render' || chunk.chunkType === 'json-render') {
      try {
        renderTree = JSON.parse(chunk.content) as Record<string, unknown>;
      } catch {
        // ignore parse errors
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
