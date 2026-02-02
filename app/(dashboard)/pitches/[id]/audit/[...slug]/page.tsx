import { eq, and } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { QuickScanRenderer, RenderTree } from '@/components/json-render/quick-scan-registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, dealEmbeddings } from '@/lib/db/schema';

// Type guard for json-render tree validation
function isValidRenderTree(value: unknown): value is RenderTree {
  if (!value || typeof value !== 'object') return false;
  const tree = value as Record<string, unknown>;
  return (
    (typeof tree.root === 'string' || tree.root === null) &&
    typeof tree.elements === 'object' &&
    tree.elements !== null
  );
}

export default async function AuditSectionPage({
  params,
}: {
  params: Promise<{ id: string; slug: string[] }>;
}) {
  const { id, slug } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Verify lead exists
  const [lead] = await db
    .select({ id: pitches.id, customerName: pitches.customerName })
    .from(pitches)
    .where(eq(pitches.id, id))
    .limit(1);

  if (!lead) {
    notFound();
  }

  // Parse slug: /audit/website-analyse/seitentypen -> category="website-analyse", sectionSlug="seitentypen"
  const [category, sectionSlug] = slug;

  if (!category || !sectionSlug) {
    // If only category, show category overview — build navigation from dealEmbeddings
    const auditChunks = await db
      .select({
        agentName: dealEmbeddings.agentName,
        chunkType: dealEmbeddings.chunkType,
      })
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.pitchId, id));

    const navMap = new Map<string, Set<string>>();
    for (const chunk of auditChunks) {
      if (!navMap.has(chunk.agentName)) {
        navMap.set(chunk.agentName, new Set());
      }
      navMap.get(chunk.agentName)!.add(chunk.chunkType);
    }

    const navigation = Array.from(navMap.entries()).map(([cat, slugs]) => ({
      category: cat,
      title: cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      items: Array.from(slugs).map(s => ({
        slug: s.replace(/_/g, '-'),
        title: s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      })),
    }));

    const categoryNav = navigation.find(n => n.category === category);

    if (!categoryNav) {
      notFound();
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/pitches/${id}/audit`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{categoryNav.title}</h1>
            <p className="text-muted-foreground">{lead.customerName}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categoryNav.items.map(item => (
            <Card key={item.slug} className="hover:border-primary transition-colors">
              <Link href={`/pitches/${id}/audit/${category}/${item.slug}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Get specific section from dealEmbeddings
  const sectionChunks = await db
    .select({
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
      chunkType: dealEmbeddings.chunkType,
      confidence: dealEmbeddings.confidence,
    })
    .from(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.pitchId, id),
        eq(dealEmbeddings.agentName, category),
        eq(dealEmbeddings.chunkType, sectionSlug.replace(/-/g, '_'))
      )
    )
    .orderBy(dealEmbeddings.chunkIndex);

  if (sectionChunks.length === 0) {
    notFound();
  }

  const sectionTitle = sectionSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  // Combine chunks into content
  const combinedContent =
    sectionChunks.length === 1
      ? sectionChunks[0].content
      : sectionChunks.map(c => c.content).join('\n\n');

  // Parse content
  let content: unknown = combinedContent;
  if (typeof combinedContent === 'string') {
    try {
      content = JSON.parse(combinedContent);
    } catch {
      // Keep as string
    }
  }

  // Check metadata for visualization tree
  let visualization: unknown = null;
  if (sectionChunks[0].metadata) {
    try {
      const meta = JSON.parse(sectionChunks[0].metadata);
      if (meta.visualizationTree) {
        visualization = meta.visualizationTree;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/pitches/${id}/audit/${category}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{sectionTitle}</h1>
          <p className="text-muted-foreground">{category}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analyse-Ergebnis</CardTitle>
          <CardDescription>Automatisch generiert durch Expert Agent</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Prefer json-render visualization if available */}
          {visualization && isValidRenderTree(visualization) ? (
            <QuickScanRenderer tree={visualization} />
          ) : (
            <SectionContent content={content} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Render section content based on type
function SectionContent({ content }: { content: unknown }) {
  if (typeof content === 'string') {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  if (Array.isArray(content)) {
    return (
      <div className="space-y-2">
        {content.map((item, i) => (
          <div key={i} className="p-3 border rounded-lg">
            {typeof item === 'object' ? (
              <pre className="text-sm overflow-auto">{JSON.stringify(item, null, 2)}</pre>
            ) : (
              <p>{String(item)}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;

    // Handle page types analysis
    if ('types' in obj && Array.isArray(obj.types)) {
      return <PageTypesContent types={obj.types as PageType[]} />;
    }

    // Handle components analysis
    if ('components' in obj && Array.isArray(obj.components)) {
      return <ComponentsContent components={obj.components as Component[]} />;
    }

    // Fallback: render as JSON
    return (
      <pre className="text-sm overflow-auto bg-muted p-4 rounded">
        {JSON.stringify(obj, null, 2)}
      </pre>
    );
  }

  return <p className="text-muted-foreground">Keine Daten verfügbar</p>;
}

interface PageType {
  name: string;
  count: number;
  examples: string[];
  description: string;
}

function PageTypesContent({ types }: { types: PageType[] }) {
  return (
    <div className="space-y-4">
      {types.map(type => (
        <div key={type.name} className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">{type.name}</h4>
            <Badge variant="secondary">{type.count} Seiten</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{type.description}</p>
          {type.examples.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {type.examples.map((ex, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {ex}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface Component {
  name: string;
  category: string;
  frequency: string;
  description: string;
}

function ComponentsContent({ components }: { components: Component[] }) {
  const frequencyLabels: Record<string, string> = {
    every_page: 'Jede Seite',
    most_pages: 'Meiste Seiten',
    some_pages: 'Einige Seiten',
    rare: 'Selten',
  };

  const categoryLabels: Record<string, string> = {
    layout: 'Layout',
    navigation: 'Navigation',
    content: 'Content',
    media: 'Media',
    form: 'Formular',
    interactive: 'Interaktiv',
    other: 'Sonstige',
  };

  return (
    <div className="space-y-4">
      {components.map(comp => (
        <div key={comp.name} className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">{comp.name}</h4>
            <div className="flex gap-2">
              <Badge variant="outline">{categoryLabels[comp.category] || comp.category}</Badge>
              <Badge variant="secondary">{frequencyLabels[comp.frequency] || comp.frequency}</Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{comp.description}</p>
        </div>
      ))}
    </div>
  );
}
