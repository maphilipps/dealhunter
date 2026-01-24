import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { DeepScanClient } from './client';

import { db } from '@/lib/db';
import { qualifications, preQualifications } from '@/lib/db/schema';
import { getAuditNavigation } from '@/lib/deep-scan/experts';

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [lead] = await db
    .select({
      id: qualifications.id,
      customerName: qualifications.customerName,
      websiteUrl: qualifications.websiteUrl,
      preQualificationId: qualifications.preQualificationId,
    })
    .from(qualifications)
    .where(eq(qualifications.id, id))
    .limit(1);

  if (!lead) {
    notFound();
  }

  // Get suggested URLs from RFP
  let suggestedUrls: { url: string; description?: string }[] = [];
  if (lead.preQualificationId) {
    const [rfp] = await db
      .select({ extractedRequirements: preQualifications.extractedRequirements })
      .from(preQualifications)
      .where(eq(preQualifications.id, lead.preQualificationId))
      .limit(1);

    if (rfp?.extractedRequirements) {
      try {
        const extracted = JSON.parse(rfp.extractedRequirements) as Record<string, unknown>;
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

  // Get existing audit navigation (if any)
  const navigation = await getAuditNavigation(id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Audit</h1>
        <p className="text-muted-foreground">
          {lead.customerName || 'Lead'} - {lead.websiteUrl || 'Keine URL'}
        </p>
      </div>

      <DeepScanClient
        leadId={id}
        websiteUrl={lead.websiteUrl || ''}
        suggestedUrls={suggestedUrls}
        existingNavigation={navigation}
      />
    </div>
  );
}
