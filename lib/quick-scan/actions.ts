'use server';

import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, quickScans } from '@/lib/db/schema';

/**
 * Start Quick Scan for a bid opportunity
 * Creates QuickScan record with 'pending' status and returns immediately.
 * The actual scan is executed via the background worker (agent-native).
 *
 * Flow:
 * 1. startQuickScan() creates record + sets status='running' + returns immediately
 * 2. UI renders QuickScanResults which connects to SSE stream for status updates
 * 3. Background worker executes the scan and streams activity via DB
 * 4. On completion, worker updates DB status to 'completed'
 */
export async function startQuickScan(bidId: string) {
  // Quick Scan is now executed automatically as part of qualification process
  void bidId; // Suppress unused parameter warning
  return {
    success: false,
    error: 'Quick Scan wird automatisch als Teil der Qualification ausgeführt.',
  };
}

/**
 * Re-trigger Quick Scan for a bid
 * IMPORTANT: Preserves existing data and supplements it with new findings (nicht ersetzen!)
 * Resets status to 'running' but keeps existing data for merging
 * The actual scan is executed via the background worker
 */
export async function retriggerQuickScan(bidId: string) {
  // Quick Scan is now executed automatically as part of qualification process
  void bidId; // Suppress unused parameter warning
  return {
    success: false,
    error: 'Quick Scan wird automatisch als Teil der Qualification ausgeführt.',
  };
}

/**
 * Get Quick Scan result for a bid
 */
export async function getQuickScanResult(bidId: string) {
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

    if (!bid.quickScanId) {
      return { success: false, error: 'Kein Quick Scan vorhanden' };
    }

    const [quickScan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, bid.quickScanId))
      .limit(1);

    if (!quickScan) {
      return { success: false, error: 'Quick Scan nicht gefunden' };
    }

    // Parse ALL JSON fields - FIX: Previously only 4 fields were parsed
    return {
      success: true,
      quickScan: {
        ...quickScan,
        // Core fields
        techStack: quickScan.techStack ? JSON.parse(quickScan.techStack) : null,
        contentVolume: quickScan.contentVolume ? JSON.parse(quickScan.contentVolume) : null,
        features: quickScan.features ? JSON.parse(quickScan.features) : null,
        activityLog: quickScan.activityLog ? JSON.parse(quickScan.activityLog) : [],
        // Enhanced audit fields
        navigationStructure: quickScan.navigationStructure
          ? JSON.parse(quickScan.navigationStructure)
          : null,
        accessibilityAudit: quickScan.accessibilityAudit
          ? JSON.parse(quickScan.accessibilityAudit)
          : null,
        seoAudit: quickScan.seoAudit ? JSON.parse(quickScan.seoAudit) : null,
        legalCompliance: quickScan.legalCompliance ? JSON.parse(quickScan.legalCompliance) : null,
        performanceIndicators: quickScan.performanceIndicators
          ? JSON.parse(quickScan.performanceIndicators)
          : null,
        screenshots: quickScan.screenshots ? JSON.parse(quickScan.screenshots) : null,
        companyIntelligence: quickScan.companyIntelligence
          ? JSON.parse(quickScan.companyIntelligence)
          : null,
        // QuickScan 2.0 fields
        siteTree: quickScan.siteTree ? JSON.parse(quickScan.siteTree) : null,
        contentTypes: quickScan.contentTypes ? JSON.parse(quickScan.contentTypes) : null,
        migrationComplexity: quickScan.migrationComplexity
          ? JSON.parse(quickScan.migrationComplexity)
          : null,
        decisionMakers: quickScan.decisionMakers ? JSON.parse(quickScan.decisionMakers) : null,
        // Raw data for debugging
        rawScanData: quickScan.rawScanData ? JSON.parse(quickScan.rawScanData) : null,
        // Timeline (Phase 1 estimate)
        timeline: quickScan.timeline ? JSON.parse(quickScan.timeline) : null,
      },
    };
  } catch (error) {
    console.error('Get Quick Scan error:', error);
    return { success: false, error: 'Abruf fehlgeschlagen' };
  }
}
