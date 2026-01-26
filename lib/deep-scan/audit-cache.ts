import { and, eq } from 'drizzle-orm';

import { buildAuditSectionId } from './experts/base';

import { db } from '@/lib/db';
import { dealEmbeddings, qualificationSectionData } from '@/lib/db/schema';

export async function cacheAuditPagesFromEmbeddings(leadId: string): Promise<{
  success: boolean;
  cachedSections: number;
}> {
  const sections = await db
    .select({
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
    })
    .from(dealEmbeddings)
    .where(
      and(eq(dealEmbeddings.qualificationId, leadId), eq(dealEmbeddings.chunkType, 'audit_section_json'))
    );

  if (sections.length === 0) {
    return { success: true, cachedSections: 0 };
  }

  let cachedCount = 0;

  for (const row of sections) {
    if (!row.metadata) continue;

    try {
      const meta = JSON.parse(row.metadata) as {
        category?: string;
        slug?: string;
        title?: string;
        visualization?: unknown;
      };

      if (!meta.category || !meta.slug || !meta.title) {
        continue;
      }

      const payload = JSON.stringify({
        category: meta.category,
        slug: meta.slug,
        title: meta.title,
        content: row.content,
        visualization: meta.visualization,
      });

      const sectionId = buildAuditSectionId(meta.category, meta.slug);

      const [existing] = await db
        .select({ id: qualificationSectionData.id })
        .from(qualificationSectionData)
        .where(
          and(
            eq(qualificationSectionData.qualificationId, leadId),
            eq(qualificationSectionData.sectionId, sectionId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(qualificationSectionData)
          .set({ content: payload, updatedAt: new Date() })
          .where(eq(qualificationSectionData.id, existing.id));
      } else {
        await db.insert(qualificationSectionData).values({
          qualificationId: leadId,
          sectionId,
          content: payload,
        });
      }

      cachedCount += 1;
    } catch {
      // Ignore malformed metadata
    }
  }

  return { success: true, cachedSections: cachedCount };
}
