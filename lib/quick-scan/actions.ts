'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidOpportunities, quickScans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { runQuickScan } from './agent';

/**
 * Start Quick Scan for a bid opportunity
 * Automatically triggered after extraction confirmation
 */
export async function startQuickScan(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid opportunity
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(eq(bidOpportunities.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Parse extracted requirements
    const extractedReqs = bid.extractedRequirements
      ? JSON.parse(bid.extractedRequirements)
      : null;

    // Determine website URL from extracted requirements or ask user
    const websiteUrl = extractedReqs?.websiteUrl || extractedReqs?.customerWebsite;

    if (!websiteUrl) {
      return {
        success: false,
        error: 'Keine Website-URL in den extrahierten Anforderungen gefunden',
        needsWebsiteUrl: true,
      };
    }

    // Create QuickScan record
    const [quickScan] = await db
      .insert(quickScans)
      .values({
        bidOpportunityId: bidId,
        websiteUrl,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    // Update bid status
    await db
      .update(bidOpportunities)
      .set({
        status: 'quick_scanning',
        quickScanId: quickScan.id,
      })
      .where(eq(bidOpportunities.id, bidId));

    // Run quick scan asynchronously
    const scanResult = await runQuickScan({
      websiteUrl,
      extractedRequirements: extractedReqs,
    });

    // Update QuickScan with results
    await db
      .update(quickScans)
      .set({
        status: 'completed',
        techStack: JSON.stringify(scanResult.techStack),
        cms: scanResult.techStack.cms || null,
        framework: scanResult.techStack.framework || null,
        hosting: scanResult.techStack.hosting || null,
        contentVolume: JSON.stringify(scanResult.contentVolume),
        features: JSON.stringify(scanResult.features),
        recommendedBusinessLine: scanResult.blRecommendation.primaryBusinessLine,
        confidence: scanResult.blRecommendation.confidence,
        reasoning: scanResult.blRecommendation.reasoning,
        activityLog: JSON.stringify(scanResult.activityLog),
        completedAt: new Date(),
      })
      .where(eq(quickScans.id, quickScan.id));

    return {
      success: true,
      quickScanId: quickScan.id,
      result: scanResult,
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
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(eq(bidOpportunities.id, bidId))
      .limit(1);

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
    const extractedReqs = bid.extractedRequirements
      ? JSON.parse(bid.extractedRequirements)
      : null;

    // Determine website URL from extracted requirements
    const websiteUrl = extractedReqs?.websiteUrl || extractedReqs?.customerWebsite;

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
        bidOpportunityId: bidId,
        websiteUrl,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    // Update bid status and reset BIT evaluation data
    await db
      .update(bidOpportunities)
      .set({
        status: 'quick_scanning',
        quickScanId: quickScan.id,
        bitDecision: 'pending',
        bitDecisionData: null,
        alternativeRecommendation: null,
      })
      .where(eq(bidOpportunities.id, bidId));

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
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(eq(bidOpportunities.id, bidId))
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

    return {
      success: true,
      quickScan: {
        ...quickScan,
        techStack: quickScan.techStack ? JSON.parse(quickScan.techStack) : null,
        contentVolume: quickScan.contentVolume ? JSON.parse(quickScan.contentVolume) : null,
        features: quickScan.features ? JSON.parse(quickScan.features) : null,
        activityLog: quickScan.activityLog ? JSON.parse(quickScan.activityLog) : [],
      },
    };
  } catch (error) {
    console.error('Get Quick Scan error:', error);
    return { success: false, error: 'Abruf fehlgeschlagen' };
  }
}
