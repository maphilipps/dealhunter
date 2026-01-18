'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidOpportunities, deepMigrationAnalyses, technologies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { runBaselineComparison, type BaselineComparisonInput } from './agent';
import type { BaselineComparisonResult } from './schema';
import type { ContentArchitecture } from '@/lib/deep-analysis/schemas';

export interface TriggerBaselineComparisonResult {
  success: boolean;
  error?: string;
  result?: BaselineComparisonResult;
}

/**
 * Triggert den Baseline-Vergleich für einen Bid
 * Erfordert abgeschlossene Deep Analysis
 */
export async function triggerBaselineComparison(bidId: string): Promise<TriggerBaselineComparisonResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Get bid with deep analysis
  const [bid] = await db
    .select()
    .from(bidOpportunities)
    .where(eq(bidOpportunities.id, bidId))
    .limit(1);

  if (!bid) {
    return { success: false, error: 'Bid nicht gefunden' };
  }

  // Get deep migration analysis
  const [analysis] = await db
    .select()
    .from(deepMigrationAnalyses)
    .where(eq(deepMigrationAnalyses.bidOpportunityId, bidId))
    .limit(1);

  if (!analysis || analysis.status !== 'completed') {
    return { success: false, error: 'Deep Analysis nicht abgeschlossen' };
  }

  if (!analysis.contentArchitecture) {
    return { success: false, error: 'Keine Content-Architektur-Daten vorhanden' };
  }

  // Get baseline data from technology if assigned
  let baselineEntityCounts: Record<string, number> | undefined;
  let baselineName = 'adessoCMS 2.0';
  let baselineHours = 400;

  if (bid.assignedBusinessLineId) {
    // Get technology with baseline data for the assigned business line
    const [tech] = await db
      .select()
      .from(technologies)
      .where(eq(technologies.businessLineId, bid.assignedBusinessLineId))
      .limit(1);

    if (tech?.baselineEntityCounts) {
      try {
        baselineEntityCounts = JSON.parse(tech.baselineEntityCounts);
      } catch {
        // Use default
      }
    }

    if (tech?.baselineName) {
      baselineName = tech.baselineName;
    }

    if (tech?.baselineHours) {
      baselineHours = tech.baselineHours;
    }
  }

  // Parse content architecture
  let contentArchitecture: ContentArchitecture;
  try {
    contentArchitecture = JSON.parse(analysis.contentArchitecture);
  } catch {
    return { success: false, error: 'Content-Architektur-Daten ungültig' };
  }

  // Run baseline comparison
  const input: BaselineComparisonInput = {
    bidId,
    contentArchitecture,
    baselineEntityCounts,
    baselineName,
    baselineHours,
  };

  const result = await runBaselineComparison(input);

  // Save result to bid
  await db
    .update(bidOpportunities)
    .set({
      baselineComparisonResult: JSON.stringify(result),
      baselineComparisonCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bidOpportunities.id, bidId));

  return { success: true, result };
}

/**
 * Holt das Baseline-Vergleich Ergebnis für einen Bid
 */
export async function getBaselineComparisonResult(bidId: string): Promise<{
  success: boolean;
  error?: string;
  result?: BaselineComparisonResult;
  completedAt?: Date;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const [bid] = await db
    .select({
      baselineComparisonResult: bidOpportunities.baselineComparisonResult,
      baselineComparisonCompletedAt: bidOpportunities.baselineComparisonCompletedAt,
    })
    .from(bidOpportunities)
    .where(eq(bidOpportunities.id, bidId))
    .limit(1);

  if (!bid) {
    return { success: false, error: 'Bid nicht gefunden' };
  }

  if (!bid.baselineComparisonResult) {
    return { success: false, error: 'Baseline-Vergleich noch nicht durchgeführt' };
  }

  try {
    const result = JSON.parse(bid.baselineComparisonResult) as BaselineComparisonResult;
    return {
      success: true,
      result,
      completedAt: bid.baselineComparisonCompletedAt || undefined,
    };
  } catch {
    return { success: false, error: 'Baseline-Vergleich Daten ungültig' };
  }
}
