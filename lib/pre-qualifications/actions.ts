'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, quickScans } from '@/lib/db/schema';

interface ReloadTimelineResult {
  success: boolean;
  error?: string;
}

/**
 * Reload Timeline Data for RFP
 *
 * Re-runs the timeline extraction for a specific RFP.
 * This is a placeholder that will trigger a re-extraction of timeline data.
 */
export async function reloadTimeline(rfpId: string): Promise<ReloadTimelineResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: 'Nicht authentifiziert' };
    }

    // Get RFP and verify ownership
    const [rfp] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, rfpId))
      .limit(1);

    if (!rfp) {
      return { success: false, error: 'RFP nicht gefunden' };
    }

    if (rfp.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    if (!rfp.quickScanId) {
      return { success: false, error: 'Kein Quick Scan vorhanden' };
    }

    // For MVP: Create a placeholder timeline if none exists
    // In production, this would trigger the Timeline Agent to re-extract
    const [quickScan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, rfp.quickScanId))
      .limit(1);

    if (!quickScan) {
      return { success: false, error: 'Quick Scan nicht gefunden' };
    }

    // If timeline is missing, create a placeholder
    if (!quickScan.timeline) {
      const placeholderTimeline = {
        totalDays: 90,
        totalWeeks: 18,
        totalMonths: 4.5,
        confidence: 30,
        phases: [
          { name: 'Analyse & Konzeption', durationDays: 15, startDay: 0, endDay: 14 },
          { name: 'Design & Architektur', durationDays: 20, startDay: 15, endDay: 34 },
          { name: 'Entwicklung', durationDays: 40, startDay: 35, endDay: 74 },
          { name: 'Testing & QA', durationDays: 10, startDay: 75, endDay: 84 },
          { name: 'Go-Live & Hypercare', durationDays: 5, startDay: 85, endDay: 89 },
        ],
        assumedTeamSize: {
          min: 3,
          optimal: 5,
          max: 8,
        },
        assumptions: [
          'Standard-Projektumfang angenommen (keine spezifischen Daten extrahierbar)',
          'Typische Team-Zusammensetzung für mittelgroße Projekte',
          'Keine externen Abhängigkeiten berücksichtigt',
        ],
        risks: [
          {
            factor: 'Unvollständige Anforderungen',
            impact: 'medium',
            likelihood: 'high',
          },
          {
            factor: 'Ressourcenverfügbarkeit',
            impact: 'high',
            likelihood: 'medium',
          },
        ],
      };

      await db
        .update(quickScans)
        .set({
          timeline: JSON.stringify(placeholderTimeline),
          timelineGeneratedAt: new Date(),
        })
        .where(eq(quickScans.id, rfp.quickScanId));
    }

    // Revalidate the routing page
    revalidatePath(`/pre-qualifications/${rfpId}/routing`);
    revalidatePath(`/pre-qualifications/${rfpId}`);

    return { success: true };
  } catch (error) {
    console.error('Error reloading timeline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
