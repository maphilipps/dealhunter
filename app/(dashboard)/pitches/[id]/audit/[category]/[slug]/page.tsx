import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';
import { pitches, dealEmbeddings } from '@/lib/db/schema';

interface PageProps {
  params: Promise<{
    id: string;
    category: string;
    slug: string;
  }>;
}

export default async function AuditDetailPage({ params }: PageProps) {
  const { id, category, slug } = await params;

  // Fetch lead
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

  // Fetch audit data for this category/slug
  const chunks = await db
    .select({
      agentName: dealEmbeddings.agentName,
      chunkType: dealEmbeddings.chunkType,
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
      confidence: dealEmbeddings.confidence,
      createdAt: dealEmbeddings.createdAt,
    })
    .from(dealEmbeddings)
    .where(
      and(eq(dealEmbeddings.pitchId, id), eq(dealEmbeddings.chunkType, slug.replace(/-/g, '_')))
    )
    .orderBy(dealEmbeddings.chunkIndex);

  if (chunks.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h1>
          <p className="text-muted-foreground">{lead.customerName}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Keine Daten verfügbar für diese Sektion.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </h1>
        <p className="text-muted-foreground">{lead.customerName}</p>
      </div>

      {chunks.map((chunk, index) => {
        let parsedContent: unknown;
        try {
          parsedContent = JSON.parse(chunk.content);
        } catch {
          parsedContent = chunk.content;
        }

        return (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {chunk.chunkType.replace(/_/g, ' ').toUpperCase()}
                </CardTitle>
                {chunk.confidence !== null && (
                  <Badge variant={chunk.confidence >= 70 ? 'default' : 'secondary'}>
                    {chunk.confidence}% Konfidenz
                  </Badge>
                )}
              </div>
              <CardDescription>
                {chunk.agentName.replace(/_/g, ' ')} •{' '}
                {chunk.createdAt ? new Date(chunk.createdAt).toLocaleDateString('de-DE') : 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {typeof parsedContent === 'string' ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap">{parsedContent}</pre>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="overflow-auto rounded bg-muted p-4">
                    {JSON.stringify(parsedContent, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
