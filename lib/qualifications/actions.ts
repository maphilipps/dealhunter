'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, leads, businessUnits } from '@/lib/db/schema';

export interface ConvertRfpToLeadInput {
  rfpId: string;
}

export interface ConvertRfpToLeadResult {
  success: boolean;
  leadId?: string;
  error?: string;
}

/**
 * DEA-38: Converts an RFP to a Lead when status is set to 'routed'
 *
 * This function:
 * 1. Validates that the RFP exists and has status 'routed'
 * 2. Creates a Lead record with data from the RFP
 * 3. Creates an audit trail entry
 *
 * Note: BL (Bereichsleiter) will decide BID/NO-BID in Lead Dashboard (Phase 2)
 *
 * @param input - RFP ID to convert
 * @returns Lead ID if successful
 */
/**
 * DEA-100: Get all leads filtered by current user's business unit
 *
 * This function:
 * 1. Checks user authentication and business unit assignment
 * 2. Filters leads to only show those assigned to user's BU
 * 3. Returns leads sorted by created date (newest first)
 *
 * @returns Array of leads for the user's business unit
 */
export async function getLeads() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', leads: [] };
  }

  try {
    // Get user's business unit
    const { users } = await import('@/lib/db/schema');
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

    if (!user) {
      return { success: false, error: 'Benutzer nicht gefunden', leads: [] };
    }

    // Admin can see all leads, BL sees only their BU leads, BD sees none (they work with RFPs)
    const { desc } = await import('drizzle-orm');
    let userLeads;

    if (session.user.role === 'admin') {
      // Admin sees all leads
      userLeads = await db.select().from(leads).orderBy(desc(leads.createdAt));
    } else if (session.user.role === 'bl' && user.businessUnitId) {
      // BL sees only their BU leads
      userLeads = await db
        .select()
        .from(leads)
        .where(eq(leads.businessUnitId, user.businessUnitId))
        .orderBy(desc(leads.createdAt));
    } else {
      // BD role should work with RFPs, not leads
      return { success: true, leads: [] };
    }

    return { success: true, leads: userLeads };
  } catch (error) {
    console.error('Get leads error:', error);
    return { success: false, error: 'Fehler beim Laden der Leads', leads: [] };
  }
}

export async function convertRfpToLead(
  input: ConvertRfpToLeadInput
): Promise<ConvertRfpToLeadResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const { rfpId } = input;

    // Validate input
    if (!rfpId) {
      return {
        success: false,
        error: 'RFP ID ist erforderlich',
      };
    }

    // Get RFP
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

    if (!rfp) {
      return {
        success: false,
        error: 'RFP nicht gefunden',
      };
    }

    // Validate status - must be 'routed'
    if (rfp.status !== 'routed') {
      return {
        success: false,
        error: 'RFP muss Status "routed" haben',
      };
    }

    // Validate business unit assignment
    if (!rfp.assignedBusinessUnitId) {
      return {
        success: false,
        error: 'RFP muss einer Business Unit zugewiesen sein',
      };
    }

    // Check if business unit exists
    const [businessUnit] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, rfp.assignedBusinessUnitId))
      .limit(1);

    if (!businessUnit) {
      return {
        success: false,
        error: 'Zugewiesene Business Unit nicht gefunden',
      };
    }

    // Parse extracted requirements for lead data
    const extractedReqs = rfp.extractedRequirements
      ? (JSON.parse(rfp.extractedRequirements) as Record<string, unknown>)
      : {};

    // Parse Quick Scan data for decision makers (DEA-92)
    let decisionMakers: unknown[] | null = null;

    if (rfp.quickScanId) {
      // Load Quick Scan data if quickScanId is set
      const { quickScans } = await import('@/lib/db/schema');
      const [quickScan] = await db
        .select()
        .from(quickScans)
        .where(eq(quickScans.id, rfp.quickScanId))
        .limit(1);

      if (quickScan?.decisionMakers) {
        decisionMakers = JSON.parse(quickScan.decisionMakers) as unknown[];
      }
    }

    // Check if lead already exists for this RFP
    const existingLead = await db.select().from(leads).where(eq(leads.rfpId, rfpId)).limit(1);

    if (existingLead.length > 0) {
      return {
        success: false,
        error: 'Für dieses RFP wurde bereits ein Lead erstellt',
      };
    }

    // Extract website URL from extractedRequirements.websiteUrls array
    let websiteUrl: string | null = null;
    if (extractedReqs.websiteUrls && Array.isArray(extractedReqs.websiteUrls)) {
      const primaryUrl = (extractedReqs.websiteUrls as Array<{ url: string; type?: string }>).find(
        u => u.type === 'primary'
      );
      websiteUrl =
        primaryUrl?.url || (extractedReqs.websiteUrls[0] as { url: string })?.url || null;
    } else if (extractedReqs.websiteUrl) {
      websiteUrl = extractedReqs.websiteUrl as string;
    }

    // Create Lead
    const [newLead] = await db
      .insert(leads)
      .values({
        rfpId: rfp.id,
        status: 'routed',
        customerName: (extractedReqs.customerName as string | undefined) || 'Unbekannter Kunde',
        websiteUrl: rfp.websiteUrl || websiteUrl,
        industry: (extractedReqs.industry as string | undefined) || null,
        projectDescription: (extractedReqs.projectDescription as string | undefined) || null,
        budget: (extractedReqs.budget as string | undefined) || null,
        requirements: extractedReqs.requirements
          ? JSON.stringify(extractedReqs.requirements)
          : null,
        businessUnitId: rfp.assignedBusinessUnitId,
        quickScanId: rfp.quickScanId || null,
        decisionMakers: decisionMakers ? JSON.stringify(decisionMakers) : null,
        routedAt: new Date(),
      })
      .returning();

    // Create audit trail
    await createAuditLog({
      action: 'create',
      entityType: 'rfp',
      entityId: rfpId,
      previousValue: null,
      newValue: JSON.stringify({
        leadId: newLead.id,
        status: 'routed',
        businessUnitId: rfp.assignedBusinessUnitId,
      }),
      reason: 'Automatische Lead-Erstellung bei RFP-Status "routed"',
    });

    // Revalidate cache
    revalidatePath(`/rfps/${rfpId}`);
    revalidatePath('/rfps');
    revalidatePath('/leads');

    return {
      success: true,
      leadId: newLead.id,
    };
  } catch (error) {
    console.error('Error converting RFP to Lead:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

// ===== DEA-104: BID/NO-BID Decision =====

const blDecisionSchema = z.object({
  leadId: z.string().min(1, 'Lead ID ist erforderlich'),
  vote: z.enum(['BID', 'NO-BID']),
  confidenceScore: z
    .number()
    .int('Confidence Score muss eine Ganzzahl sein')
    .min(0, 'Confidence Score muss zwischen 0 und 100 liegen')
    .max(100, 'Confidence Score muss zwischen 0 und 100 liegen'),
  reasoning: z.string().min(10, 'Begründung muss mindestens 10 Zeichen lang sein'),
});

export type BLDecisionInput = z.infer<typeof blDecisionSchema>;

export interface BLDecisionResult {
  success: boolean;
  error?: string;
}

/**
 * DEA-104: BL Decision - BID/NO-BID Vote
 *
 * This function:
 * 1. Validates the decision input
 * 2. Checks that the lead exists and is in bl_reviewing status
 * 3. Updates the lead with BL vote, confidence score, and reasoning
 * 4. Updates status to 'bid_voted' (BID) or 'archived' (NO-BID)
 * 5. Creates an audit trail entry
 *
 * @param input - BL decision data
 * @returns Success status
 */
export async function submitBLDecision(input: BLDecisionInput): Promise<BLDecisionResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Security: Only BL role can make decisions
  if (session.user.role !== 'bl' && session.user.role !== 'admin') {
    return {
      success: false,
      error: 'Nur Bereichsleiter können BID/NO-BID Entscheidungen treffen',
    };
  }

  try {
    // Validate input with Zod
    const validationResult = blDecisionSchema.safeParse(input);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => e.message).join(', ');
      return {
        success: false,
        error: `Validierungsfehler: ${errors}`,
      };
    }

    const { leadId, vote, confidenceScore, reasoning } = validationResult.data;

    // Get lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
      return {
        success: false,
        error: 'Lead nicht gefunden',
      };
    }

    // Check if lead is in correct status
    if (lead.status !== 'bl_reviewing') {
      return {
        success: false,
        error: 'Lead befindet sich nicht im Status "bl_reviewing"',
      };
    }

    // Check if decision already exists
    if (lead.blVote) {
      return {
        success: false,
        error: 'Für diesen Lead wurde bereits eine Entscheidung getroffen',
      };
    }

    // Determine new status based on vote
    const newStatus = vote === 'BID' ? 'bid_voted' : 'archived';

    // Update lead with decision
    await db
      .update(leads)
      .set({
        blVote: vote,
        blConfidenceScore: confidenceScore,
        blReasoning: reasoning,
        blVotedAt: new Date(),
        blVotedByUserId: session.user.id,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    // Create audit trail
    await createAuditLog({
      action: 'update',
      entityType: 'rfp',
      entityId: leadId,
      previousValue: JSON.stringify({
        status: lead.status,
        blVote: null,
      }),
      newValue: JSON.stringify({
        status: newStatus,
        blVote: vote,
        blConfidenceScore: confidenceScore,
      }),
      reason: `BL Decision: ${vote} (Confidence: ${confidenceScore}%) - ${reasoning}`,
    });

    // DEA-160 (PA-001): Trigger Pitchdeck Assembly on BID vote
    if (vote === 'BID') {
      const { createPitchdeck } = await import('@/lib/pitchdeck/actions');
      const pitchdeckResult = await createPitchdeck(leadId);

      if (!pitchdeckResult.success) {
        console.error('Failed to create pitchdeck:', pitchdeckResult.error);
        // Log error but don't fail the BL decision - pitchdeck can be created manually if needed
      }
    }

    // Revalidate cache
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/decision`);
    revalidatePath('/leads');

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error submitting BL decision:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

/**
 * Update Lead website URL
 *
 * @param leadId - Lead ID
 * @param websiteUrl - New website URL
 * @returns Success or error
 */
export async function updateLeadWebsiteUrl(
  leadId: string,
  websiteUrl: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Validate URL format
    const urlSchema = z.string().url();
    const result = urlSchema.safeParse(websiteUrl);
    if (!result.success) {
      return { success: false, error: 'Ungültige URL' };
    }

    // Verify lead exists
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) {
      return { success: false, error: 'Lead nicht gefunden' };
    }

    // Update website URL
    await db.update(leads).set({ websiteUrl }).where(eq(leads.id, leadId));

    // Create audit log
    await createAuditLog({
      action: 'update',
      entityType: 'lead',
      entityId: leadId,
      previousValue: JSON.stringify({ websiteUrl: lead.websiteUrl }),
      newValue: JSON.stringify({ websiteUrl }),
      reason: 'Website URL aktualisiert',
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/audit`);

    return { success: true };
  } catch (error) {
    console.error('Error updating lead website URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

// ===== Phase 4.1: Automatische Audit-Erkennung =====

export interface AuditStatus {
  hasAuditDirectory: boolean;
  hasAuditDataInRAG: boolean;
  auditPath: string | null;
  domain: string | null;
  chunksCount: number;
  status: 'not_available' | 'available' | 'ingested' | 'ingesting' | 'error';
  error?: string;
}

/**
 * Extract domain from a URL
 */
function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Remove www. prefix if present
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Check if audit directory exists for a domain
 */
async function checkAuditDirectoryExists(domain: string): Promise<string | null> {
  const { existsSync } = await import('fs');
  const { join } = await import('path');

  const auditPath = join(process.cwd(), 'audits', `audit_${domain}`);

  if (existsSync(auditPath)) {
    return auditPath;
  }

  return null;
}

/**
 * Check audit data status for a lead
 *
 * This function:
 * 1. Extracts domain from lead's websiteUrl
 * 2. Checks if audit directory exists (`audits/audit_${domain}/`)
 * 3. Checks if already ingested in RAG
 * 4. Returns status for UI badge display
 */
export async function getAuditStatus(leadId: string): Promise<AuditStatus> {
  try {
    // Get lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
      return {
        hasAuditDirectory: false,
        hasAuditDataInRAG: false,
        auditPath: null,
        domain: null,
        chunksCount: 0,
        status: 'error',
        error: 'Lead nicht gefunden',
      };
    }

    // Extract domain from websiteUrl
    if (!lead.websiteUrl) {
      return {
        hasAuditDirectory: false,
        hasAuditDataInRAG: false,
        auditPath: null,
        domain: null,
        chunksCount: 0,
        status: 'not_available',
      };
    }

    const domain = extractDomainFromUrl(lead.websiteUrl);
    if (!domain) {
      return {
        hasAuditDirectory: false,
        hasAuditDataInRAG: false,
        auditPath: null,
        domain: null,
        chunksCount: 0,
        status: 'not_available',
      };
    }

    // Check if audit directory exists
    const auditPath = await checkAuditDirectoryExists(domain);

    if (!auditPath) {
      return {
        hasAuditDirectory: false,
        hasAuditDataInRAG: false,
        auditPath: null,
        domain,
        chunksCount: 0,
        status: 'not_available',
      };
    }

    // Check if already ingested in RAG
    const { hasAuditData, getAuditChunkCount } = await import('@/lib/audit/audit-rag-ingestion');
    const isIngested = await hasAuditData(leadId);
    const chunksCount = isIngested ? await getAuditChunkCount(leadId) : 0;

    return {
      hasAuditDirectory: true,
      hasAuditDataInRAG: isIngested,
      auditPath,
      domain,
      chunksCount,
      status: isIngested ? 'ingested' : 'available',
    };
  } catch (error) {
    console.error('Error checking audit status:', error);
    return {
      hasAuditDirectory: false,
      hasAuditDataInRAG: false,
      auditPath: null,
      domain: null,
      chunksCount: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

export interface IngestAuditResult {
  success: boolean;
  chunksCreated?: number;
  error?: string;
}

/**
 * Check and ingest audit data for a lead
 *
 * This function:
 * 1. Checks if audit directory exists for the lead's domain
 * 2. Checks if already ingested in RAG
 * 3. If not ingested, triggers ingestion
 * 4. Returns result status
 */
export async function checkAndIngestAuditData(leadId: string): Promise<IngestAuditResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get current audit status
    const status = await getAuditStatus(leadId);

    // If no audit directory, nothing to do
    if (!status.hasAuditDirectory || !status.auditPath) {
      return {
        success: true,
        chunksCreated: 0,
      };
    }

    // If already ingested, nothing to do
    if (status.hasAuditDataInRAG) {
      return {
        success: true,
        chunksCreated: status.chunksCount,
      };
    }

    // Ingest audit data
    const { ingestAuditToRAG } = await import('@/lib/audit/audit-rag-ingestion');
    const result = await ingestAuditToRAG(status.auditPath, leadId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Fehler beim Importieren der Audit-Daten',
      };
    }

    // Revalidate the lead page to show updated audit status
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/audit`);
    revalidatePath(`/leads/${leadId}/rag-data`);

    return {
      success: true,
      chunksCreated: result.stats.chunksCreated,
    };
  } catch (error) {
    console.error('Error ingesting audit data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}
