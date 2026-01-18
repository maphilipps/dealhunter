'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, deepMigrationAnalyses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateProjectPlan, type ProjectPlanningInput } from './agent';
import type { ProjectPlan } from './schema';
import type { PTEstimation } from '@/lib/deep-analysis/schemas';
import type { BaselineComparisonResult } from '@/lib/baseline-comparison/schema';

export interface GenerateProjectPlanResult {
  success: boolean;
  error?: string;
  plan?: ProjectPlan;
}

/**
 * Generiert einen Projekt-Plan für einen Bid
 * Erfordert abgeschlossene Deep Analysis (PT-Schätzung)
 */
export async function triggerProjectPlanning(bidId: string): Promise<GenerateProjectPlanResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Get bid
  const [bid] = await db
    .select()
    .from(rfps)
    .where(eq(rfps.id, bidId))
    .limit(1);

  if (!bid) {
    return { success: false, error: 'Bid nicht gefunden' };
  }

  if (bid.userId !== session.user.id) {
    return { success: false, error: 'Keine Berechtigung' };
  }

  // Get deep migration analysis for PT estimation
  const [analysis] = await db
    .select()
    .from(deepMigrationAnalyses)
    .where(eq(deepMigrationAnalyses.rfpId, bidId))
    .limit(1);

  if (!analysis || analysis.status !== 'completed') {
    return { success: false, error: 'Deep Analysis nicht abgeschlossen' };
  }

  if (!analysis.ptEstimation) {
    return { success: false, error: 'Keine PT-Schätzung vorhanden' };
  }

  // Parse PT estimation
  let ptEstimation: PTEstimation;
  try {
    ptEstimation = JSON.parse(analysis.ptEstimation);
  } catch {
    return { success: false, error: 'PT-Schätzung Daten ungültig' };
  }

  // Parse baseline comparison if available
  let baselineComparison: BaselineComparisonResult | undefined;
  if (bid.baselineComparisonResult) {
    try {
      baselineComparison = JSON.parse(bid.baselineComparisonResult);
    } catch {
      // Continue without baseline comparison
    }
  }

  // Get project name from extracted requirements
  let projectName = 'Projekt';
  if (bid.extractedRequirements) {
    try {
      const extracted = JSON.parse(bid.extractedRequirements);
      projectName = extracted.projectName || extracted.customerName || 'Projekt';
    } catch {
      // Use default
    }
  }

  // Get technologies from quick scan
  let technologies: string[] = [];
  if (bid.quickScanResults) {
    try {
      const quickScan = JSON.parse(bid.quickScanResults);
      technologies = [
        quickScan.cms,
        quickScan.framework,
        quickScan.backend,
      ].filter(Boolean);
    } catch {
      // Continue without technologies
    }
  }

  // Generate project plan
  const input: ProjectPlanningInput = {
    bidId,
    projectName,
    ptEstimation,
    baselineComparison,
    technologies,
  };

  const plan = await generateProjectPlan(input);

  // Save result to bid
  await db
    .update(rfps)
    .set({
      projectPlanningResult: JSON.stringify(plan),
      projectPlanningCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(rfps.id, bidId));

  return { success: true, plan };
}

/**
 * Holt den Projekt-Plan für einen Bid
 */
export async function getProjectPlan(bidId: string): Promise<{
  success: boolean;
  error?: string;
  plan?: ProjectPlan;
  completedAt?: Date;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const [bid] = await db
    .select({
      userId: rfps.userId,
      projectPlanningResult: rfps.projectPlanningResult,
      projectPlanningCompletedAt: rfps.projectPlanningCompletedAt,
    })
    .from(rfps)
    .where(eq(rfps.id, bidId))
    .limit(1);

  if (!bid) {
    return { success: false, error: 'Bid nicht gefunden' };
  }

  if (bid.userId !== session.user.id) {
    return { success: false, error: 'Keine Berechtigung' };
  }

  if (!bid.projectPlanningResult) {
    return { success: false, error: 'Projekt-Plan noch nicht erstellt' };
  }

  try {
    const plan = JSON.parse(bid.projectPlanningResult) as ProjectPlan;
    return {
      success: true,
      plan,
      completedAt: bid.projectPlanningCompletedAt || undefined,
    };
  } catch {
    return { success: false, error: 'Projekt-Plan Daten ungültig' };
  }
}

/**
 * Aktualisiert eine Phase im Projekt-Plan
 */
export async function updateProjectPhase(
  bidId: string,
  phaseIndex: number,
  updates: { durationWeeks?: number; startWeek?: number }
): Promise<GenerateProjectPlanResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const [bid] = await db
    .select({
      userId: rfps.userId,
      projectPlanningResult: rfps.projectPlanningResult,
    })
    .from(rfps)
    .where(eq(rfps.id, bidId))
    .limit(1);

  if (!bid) {
    return { success: false, error: 'Bid nicht gefunden' };
  }

  if (bid.userId !== session.user.id) {
    return { success: false, error: 'Keine Berechtigung' };
  }

  if (!bid.projectPlanningResult) {
    return { success: false, error: 'Kein Projekt-Plan vorhanden' };
  }

  try {
    const plan = JSON.parse(bid.projectPlanningResult) as ProjectPlan;

    if (phaseIndex < 0 || phaseIndex >= plan.phases.length) {
      return { success: false, error: 'Ungültiger Phasen-Index' };
    }

    // Update phase
    const phase = plan.phases[phaseIndex];
    if (updates.durationWeeks !== undefined) {
      phase.durationWeeks = updates.durationWeeks;
      phase.endWeek = phase.startWeek + updates.durationWeeks - 1;
    }
    if (updates.startWeek !== undefined) {
      const duration = phase.durationWeeks;
      phase.startWeek = updates.startWeek;
      phase.endWeek = updates.startWeek + duration - 1;
    }

    // Recalculate total weeks
    plan.totalWeeks = Math.max(...plan.phases.map(p => p.endWeek)) + 1;

    // Save updated plan
    await db
      .update(rfps)
      .set({
        projectPlanningResult: JSON.stringify(plan),
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, bidId));

    return { success: true, plan };
  } catch {
    return { success: false, error: 'Fehler beim Aktualisieren' };
  }
}
