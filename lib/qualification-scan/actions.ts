'use server';

import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, leadScans } from '@/lib/db/schema';

/**
 * Start Qualification Scan for a bid opportunity
 * Creates QualificationScan record with 'pending' status and returns immediately.
 * The actual scan is executed via the background worker (agent-native).
 *
 * Flow:
 * 1. startQualificationScan() creates record + sets status='running' + returns immediately
 * 2. UI renders QualificationScanResults which connects to SSE stream for status updates
 * 3. Background worker executes the scan and streams activity via DB
 * 4. On completion, worker updates DB status to 'completed'
 */
export async function startQualificationScan(bidId: string) {
  // Qualification Scan is now executed automatically as part of qualification process
  void bidId; // Suppress unused parameter warning
  return {
    success: false,
    error: 'Qualification Scan wird automatisch als Teil der Qualification ausgeführt.',
  };
}

/** @deprecated Use startQualificationScan */
export const startLeadScan = startQualificationScan;

/**
 * Re-trigger Qualification Scan for a bid
 * IMPORTANT: Preserves existing data and supplements it with new findings (nicht ersetzen!)
 * Resets status to 'running' but keeps existing data for merging
 * The actual scan is executed via the background worker
 */
export async function retriggerQualificationScan(bidId: string) {
  // Qualification Scan is now executed automatically as part of qualification process
  void bidId; // Suppress unused parameter warning
  return {
    success: false,
    error: 'Qualification Scan wird automatisch als Teil der Qualification ausgeführt.',
  };
}

/** @deprecated Use retriggerQualificationScan */
export const retriggerLeadScan = retriggerQualificationScan;

/**
 * Get Qualification Scan result for a bid
 */
export async function getQualificationScanResult(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    if (!bid.qualificationScanId) {
      return { success: false, error: 'Kein Qualification Scan vorhanden' };
    }

    const [qualificationScan] = await db
      .select()
      .from(leadScans)
      .where(eq(leadScans.id, bid.qualificationScanId))
      .limit(1);

    if (!qualificationScan) {
      return { success: false, error: 'Qualification Scan nicht gefunden' };
    }

    // Parse ALL JSON fields - FIX: Previously only 4 fields were parsed
    return {
      success: true,
      qualificationScan: {
        ...qualificationScan,
        // Core fields
        techStack: qualificationScan.techStack ? JSON.parse(qualificationScan.techStack) : null,
        contentVolume: qualificationScan.contentVolume
          ? JSON.parse(qualificationScan.contentVolume)
          : null,
        features: qualificationScan.features ? JSON.parse(qualificationScan.features) : null,
        activityLog: qualificationScan.activityLog ? JSON.parse(qualificationScan.activityLog) : [],
        // Enhanced audit fields
        navigationStructure: qualificationScan.navigationStructure
          ? JSON.parse(qualificationScan.navigationStructure)
          : null,
        accessibilityAudit: qualificationScan.accessibilityAudit
          ? JSON.parse(qualificationScan.accessibilityAudit)
          : null,
        seoAudit: qualificationScan.seoAudit ? JSON.parse(qualificationScan.seoAudit) : null,
        legalCompliance: qualificationScan.legalCompliance
          ? JSON.parse(qualificationScan.legalCompliance)
          : null,
        performanceIndicators: qualificationScan.performanceIndicators
          ? JSON.parse(qualificationScan.performanceIndicators)
          : null,
        screenshots: qualificationScan.screenshots
          ? JSON.parse(qualificationScan.screenshots)
          : null,
        companyIntelligence: qualificationScan.companyIntelligence
          ? JSON.parse(qualificationScan.companyIntelligence)
          : null,
        // Qualification Scan 2.0 fields
        siteTree: qualificationScan.siteTree ? JSON.parse(qualificationScan.siteTree) : null,
        contentTypes: qualificationScan.contentTypes
          ? JSON.parse(qualificationScan.contentTypes)
          : null,
        migrationComplexity: qualificationScan.migrationComplexity
          ? JSON.parse(qualificationScan.migrationComplexity)
          : null,
        decisionMakers: qualificationScan.decisionMakers
          ? JSON.parse(qualificationScan.decisionMakers)
          : null,
        // Raw data for debugging
        rawScanData: qualificationScan.rawScanData
          ? JSON.parse(qualificationScan.rawScanData)
          : null,
        // Timeline (Phase 1 estimate)
        timeline: qualificationScan.timeline ? JSON.parse(qualificationScan.timeline) : null,
      },
      /** @deprecated Use qualificationScan */
      get leadScan() {
        return this.qualificationScan;
      },
      /** @deprecated Use qualificationScan */
      get quickScan() {
        return this.qualificationScan;
      },
    };
  } catch (error) {
    console.error('Get Qualification Scan error:', error);
    return { success: false, error: 'Abruf fehlgeschlagen' };
  }
}

/** @deprecated Use getQualificationScanResult - this is a no-op alias kept for backward compat */
export const getLeadScanResult = getQualificationScanResult;
