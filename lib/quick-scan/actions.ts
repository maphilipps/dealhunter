'use server';

import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, quickScans } from '@/lib/db/schema';

/**
 * Start Quick Scan for a bid opportunity
 * Creates QuickScan record with 'running' status and returns immediately.
 * The actual scan is executed via the SSE streaming endpoint.
 *
 * Flow:
 * 1. startQuickScan() creates record + sets status='running' + returns immediately
 * 2. UI renders QuickScanResults which connects to SSE stream
 * 3. SSE endpoint executes the scan and streams live updates
 * 4. On completion, SSE endpoint updates DB status to 'completed'
 */
export async function startQuickScan(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid opportunity
    const [bid] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Parse extracted requirements
    const extractedReqs = bid.extractedRequirements ? JSON.parse(bid.extractedRequirements) : null;

    // Determine website URL from extracted requirements or ask user
    // Prioritize websiteUrls array (primary source), fallback to legacy single URL
    const websiteUrl =
      extractedReqs?.websiteUrls?.[0]?.url || // Primary: Array with type info
      extractedReqs?.websiteUrl || // Legacy: Single URL field
      null;

    if (!websiteUrl) {
      return {
        success: false,
        error: 'Keine Website-URL in den extrahierten Anforderungen gefunden',
        needsWebsiteUrl: true,
      };
    }

    // Create QuickScan record with 'running' status
    // The actual scan will be executed via the SSE streaming endpoint
    const [quickScan] = await db
      .insert(quickScans)
      .values({
        rfpId: bidId,
        websiteUrl,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    // Update bid status to quick_scanning
    await db
      .update(rfps)
      .set({
        status: 'quick_scanning',
        quickScanId: quickScan.id,
      })
      .where(eq(rfps.id, bidId));

    // Return immediately - scan is executed via SSE stream
    // The UI will connect to /api/rfps/[id]/quick-scan/stream which runs the actual scan
    return {
      success: true,
      quickScanId: quickScan.id,
      status: 'running',
    };
  } catch (error) {
    console.error('Quick Scan error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Quick Scan fehlgeschlagen',
    };
  }
}

/**
 * Re-trigger Quick Scan for a bid
 * Deletes existing Quick Scan and creates a new one in 'running' status
 * The actual scan is executed via the streaming endpoint
 */
export async function retriggerQuickScan(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid opportunity
    const [bid] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Delete existing Quick Scan if present
    if (bid.quickScanId) {
      await db.delete(quickScans).where(eq(quickScans.id, bid.quickScanId));
    }

    // Parse extracted requirements
    const extractedReqs = bid.extractedRequirements ? JSON.parse(bid.extractedRequirements) : null;

    // Determine website URL from extracted requirements
    // Prioritize websiteUrls array (primary source), fallback to legacy single URL
    const websiteUrl =
      extractedReqs?.websiteUrls?.[0]?.url || // Primary: Array with type info
      extractedReqs?.websiteUrl || // Legacy: Single URL field
      null;

    if (!websiteUrl) {
      return {
        success: false,
        error: 'Keine Website-URL in den extrahierten Anforderungen gefunden',
        needsWebsiteUrl: true,
      };
    }

    // Create new QuickScan record with 'running' status
    // The actual scan will be executed via the streaming endpoint
    const [quickScan] = await db
      .insert(quickScans)
      .values({
        rfpId: bidId,
        websiteUrl,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    // Update bid status and reset BIT evaluation data
    await db
      .update(rfps)
      .set({
        status: 'quick_scanning',
        quickScanId: quickScan.id,
        decision: 'pending',
        decisionData: null,
        alternativeRecommendation: null,
      })
      .where(eq(rfps.id, bidId));

    return {
      success: true,
      quickScanId: quickScan.id,
      status: 'running',
    };
  } catch (error) {
    console.error('Quick Scan re-trigger error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Quick Scan Re-Trigger fehlgeschlagen',
    };
  }
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
    const [bid] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

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
