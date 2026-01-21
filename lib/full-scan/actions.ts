'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, websiteAudits } from '@/lib/db/schema';
import { crawlWebsite } from './website-crawler';

export interface StartFullScanInput {
  leadId: string;
}

export interface StartFullScanResult {
  success: boolean;
  auditId?: string;
  error?: string;
}

/**
 * DEA-39: Start Full-Scan for a Lead
 *
 * This function:
 * 1. Validates that the lead exists and has a website URL
 * 2. Creates a websiteAudit record
 * 3. Crawls the website and detects tech stack
 * 4. Updates the audit with results
 *
 * @param input - Lead ID to scan
 * @returns Audit ID if successful
 */
export async function startFullScan(input: StartFullScanInput): Promise<StartFullScanResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const { leadId } = input;

    // Validate input
    if (!leadId) {
      return {
        success: false,
        error: 'Lead ID ist erforderlich',
      };
    }

    // Get Lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
      return {
        success: false,
        error: 'Lead nicht gefunden',
      };
    }

    // Validate website URL
    if (!lead.websiteUrl) {
      return {
        success: false,
        error: 'Lead hat keine Website URL',
      };
    }

    // Check if audit already exists
    const existingAudit = await db
      .select()
      .from(websiteAudits)
      .where(eq(websiteAudits.leadId, leadId))
      .limit(1);

    if (existingAudit.length > 0 && existingAudit[0].status === 'completed') {
      return {
        success: false,
        error: 'Full-Scan wurde bereits durchgeführt',
      };
    }

    // Create or update audit record
    let auditId: string;

    if (existingAudit.length > 0) {
      // Update existing audit
      auditId = existingAudit[0].id;
      await db
        .update(websiteAudits)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(websiteAudits.id, auditId));
    } else {
      // Create new audit
      const [newAudit] = await db
        .insert(websiteAudits)
        .values({
          leadId: lead.id,
          websiteUrl: lead.websiteUrl,
          status: 'running',
          startedAt: new Date(),
        })
        .returning();
      auditId = newAudit.id;
    }

    // Update lead status
    await db
      .update(leads)
      .set({
        status: 'full_scanning',
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    // Perform crawl (in background - this is async)
    performFullScanAsync(auditId, lead.websiteUrl).catch((error) => {
      console.error(`[Full-Scan] Error for audit ${auditId}:`, error);
    });

    // Revalidate cache
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/leads');

    return {
      success: true,
      auditId,
    };
  } catch (error) {
    console.error('Error starting full scan:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

/**
 * Perform full scan asynchronously
 *
 * This function runs in the background and updates the audit when complete.
 */
async function performFullScanAsync(auditId: string, websiteUrl: string): Promise<void> {
  try {
    console.error(`[Full-Scan] Starting scan for ${websiteUrl}`);

    // Crawl website and detect tech stack
    const crawlResult = await crawlWebsite(websiteUrl, {
      maxPages: 10,
      timeout: 30000,
    });

    if (!crawlResult.success) {
      // Update audit with failure
      await db
        .update(websiteAudits)
        .set({
          status: 'failed',
          completedAt: new Date(),
          rawAuditData: JSON.stringify({
            error: crawlResult.error,
            crawledAt: crawlResult.crawledAt,
          }),
        })
        .where(eq(websiteAudits.id, auditId));

      console.error(`[Full-Scan] Failed for audit ${auditId}:`, crawlResult.error);
      return;
    }

    // Update audit with results
    await db
      .update(websiteAudits)
      .set({
        status: 'completed',
        completedAt: new Date(),

        // Homepage data
        homepage: JSON.stringify(crawlResult.homepage),

        // Tech Stack
        cms: crawlResult.techStack?.cms || null,
        cmsVersion: crawlResult.techStack?.cmsVersion || null,
        framework: crawlResult.techStack?.framework || null,
        hosting: crawlResult.techStack?.hosting || null,
        server: crawlResult.techStack?.server || null,
        techStack: JSON.stringify(crawlResult.techStack),

        // Raw data for future processing
        rawAuditData: JSON.stringify({
          crawlResult,
          samplePages: crawlResult.samplePages,
        }),
      })
      .where(eq(websiteAudits.id, auditId));

    // Update lead status to bl_reviewing
    const [audit] = await db
      .select()
      .from(websiteAudits)
      .where(eq(websiteAudits.id, auditId))
      .limit(1);

    if (audit) {
      await db
        .update(leads)
        .set({
          status: 'bl_reviewing',
          updatedAt: new Date(),
        })
        .where(eq(leads.id, audit.leadId));

      // Revalidate paths
      revalidatePath(`/leads/${audit.leadId}`);
      revalidatePath('/leads');
    }

    console.error(`[Full-Scan] Completed for audit ${auditId}`);
  } catch (error) {
    console.error(`[Full-Scan] Error in async scan for audit ${auditId}:`, error);

    // Update audit with failure
    await db
      .update(websiteAudits)
      .set({
        status: 'failed',
        completedAt: new Date(),
        rawAuditData: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      })
      .where(eq(websiteAudits.id, auditId));
  }
}
