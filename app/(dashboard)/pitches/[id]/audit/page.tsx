import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { AuditClient } from './client';

import { db } from '@/lib/db';
import { pitches, preQualifications, dealEmbeddings } from '@/lib/db/schema';

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [lead] = await db
    .select({
      id: pitches.id,
      customerName: pitches.customerName,
      websiteUrl: pitches.websiteUrl,
      preQualificationId: pitches.preQualificationId,
    })
    .from(pitches)
    .where(eq(pitches.id, id))
    .limit(1);

  if (!lead) {
    notFound();
  }

  // Get suggested URLs from Pre-Qualification
  let suggestedUrls: { url: string; description?: string }[] = [];
  if (lead.preQualificationId) {
    const [preQualification] = await db
      .select({ extractedRequirements: preQualifications.extractedRequirements })
      .from(preQualifications)
      .where(eq(preQualifications.id, lead.preQualificationId))
      .limit(1);

    if (preQualification?.extractedRequirements) {
      try {
        const extracted = JSON.parse(preQualification.extractedRequirements) as Record<
          string,
          unknown
        >;
        if (extracted.websiteUrls && Array.isArray(extracted.websiteUrls)) {
          suggestedUrls = (
            extracted.websiteUrls as Array<{ url: string; description?: string }>
          ).map(u => ({
            url: u.url,
            description: u.description,
          }));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Get existing audit navigation from deal_embeddings (replaces v1 deep-scan getAuditNavigation)
  const auditChunks = await db
    .select({
      agentName: dealEmbeddings.agentName,
      chunkType: dealEmbeddings.chunkType,
    })
    .from(dealEmbeddings)
    .where(eq(dealEmbeddings.pitchId, id));

  // Group chunks by agentName to build navigation
  const navMap = new Map<string, Set<string>>();
  for (const chunk of auditChunks) {
    if (!navMap.has(chunk.agentName)) {
      navMap.set(chunk.agentName, new Set());
    }
    navMap.get(chunk.agentName)!.add(chunk.chunkType);
  }

  const navigation = Array.from(navMap.entries()).map(([category, slugs]) => ({
    category,
    title: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    items: Array.from(slugs).map(slug => ({
      slug: slug.replace(/_/g, '-'),
      title: slug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Audit</h1>
        <p className="text-muted-foreground">
          {lead.customerName || 'Lead'} - {lead.websiteUrl || 'Keine URL'}
        </p>
      </div>

      <AuditClient
        leadId={id}
        websiteUrl={lead.websiteUrl || ''}
        suggestedUrls={suggestedUrls}
        existingNavigation={navigation}
      />
    </div>
  );
}
