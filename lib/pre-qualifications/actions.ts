'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  backgroundJobs,
  baselineComparisons,
  cmsMatchResults,
  competitorMatches,
  dealEmbeddings,
  deepMigrationAnalyses,
  documents,
  pitchdeckDeliverables,
  pitchdeckTeamMembers,
  pitchdecks,
  preQualifications,
  ptEstimations,
  qualificationSectionData,
  qualifications,
  quickScans,
  rawChunks,
  referenceMatches,
  subjectiveAssessments,
  teamAssignments,
  websiteAudits,
  users,
} from '@/lib/db/schema';

interface ReloadTimelineResult {
  success: boolean;
  error?: string;
}

/**
 * Reload Timeline Data for Pre-Qualification
 *
 * Re-runs the timeline extraction for a specific Pre-Qualification.
 * This is a placeholder that will trigger a re-extraction of timeline data.
 */
export async function reloadTimeline(preQualificationId: string): Promise<ReloadTimelineResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: 'Nicht authentifiziert' };
    }

    // Get Pre-Qualification and verify ownership
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Pre-Qualification nicht gefunden' };
    }

    if (preQualification.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    if (!preQualification.quickScanId) {
      return { success: false, error: 'Kein Quick Scan vorhanden' };
    }

    // For MVP: Create a placeholder timeline if none exists
    // In production, this would trigger the Timeline Agent to re-extract
    const [quickScan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, preQualification.quickScanId))
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
        .where(eq(quickScans.id, preQualification.quickScanId));
    }

    // Revalidate the routing page
    revalidatePath(`/pre-qualifications/${preQualificationId}/routing`);
    revalidatePath(`/pre-qualifications/${preQualificationId}`);

    return { success: true };
  } catch (error) {
    console.error('Error reloading timeline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

export async function deletePreQualificationHard(preQualificationId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Pre-Qualification nicht gefunden' };
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

    if (!user) {
      return { success: false, error: 'Benutzer nicht gefunden' };
    }

    const isAdmin = session.user.role === 'admin';
    const isOwner = preQualification.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    await db.transaction(async tx => {
      await tx
        .update(preQualifications)
        .set({ quickScanId: null, deepMigrationAnalysisId: null })
        .where(eq(preQualifications.id, preQualificationId));

      const qualificationRows = await tx
        .select({ id: qualifications.id })
        .from(qualifications)
        .where(eq(qualifications.preQualificationId, preQualificationId));

      const qualificationIds = qualificationRows.map(row => row.id);

      if (qualificationIds.length > 0) {
        const pitchdeckRows = await tx
          .select({ id: pitchdecks.id })
          .from(pitchdecks)
          .where(inArray(pitchdecks.qualificationId, qualificationIds));

        const pitchdeckIds = pitchdeckRows.map(row => row.id);

        if (pitchdeckIds.length > 0) {
          await tx
            .delete(pitchdeckDeliverables)
            .where(inArray(pitchdeckDeliverables.pitchdeckId, pitchdeckIds));
          await tx
            .delete(pitchdeckTeamMembers)
            .where(inArray(pitchdeckTeamMembers.pitchdeckId, pitchdeckIds));
          await tx.delete(pitchdecks).where(inArray(pitchdecks.id, pitchdeckIds));
        }

        await tx
          .delete(qualificationSectionData)
          .where(inArray(qualificationSectionData.qualificationId, qualificationIds));
        await tx
          .delete(websiteAudits)
          .where(inArray(websiteAudits.qualificationId, qualificationIds));
        await tx
          .delete(cmsMatchResults)
          .where(inArray(cmsMatchResults.qualificationId, qualificationIds));
        await tx
          .delete(baselineComparisons)
          .where(inArray(baselineComparisons.qualificationId, qualificationIds));
        await tx
          .delete(ptEstimations)
          .where(inArray(ptEstimations.qualificationId, qualificationIds));
        await tx
          .delete(referenceMatches)
          .where(inArray(referenceMatches.qualificationId, qualificationIds));
        await tx
          .delete(competitorMatches)
          .where(inArray(competitorMatches.qualificationId, qualificationIds));
        await tx
          .delete(dealEmbeddings)
          .where(inArray(dealEmbeddings.qualificationId, qualificationIds));
        await tx
          .delete(backgroundJobs)
          .where(inArray(backgroundJobs.qualificationId, qualificationIds));
        await tx.delete(qualifications).where(inArray(qualifications.id, qualificationIds));
      }

      await tx.delete(documents).where(eq(documents.preQualificationId, preQualificationId));
      await tx.delete(teamAssignments).where(eq(teamAssignments.preQualificationId, preQualificationId));
      await tx
        .delete(subjectiveAssessments)
        .where(eq(subjectiveAssessments.preQualificationId, preQualificationId));
      await tx.delete(backgroundJobs).where(eq(backgroundJobs.preQualificationId, preQualificationId));
      await tx
        .delete(dealEmbeddings)
        .where(eq(dealEmbeddings.preQualificationId, preQualificationId));
      await tx.delete(rawChunks).where(eq(rawChunks.preQualificationId, preQualificationId));
      await tx.delete(quickScans).where(eq(quickScans.preQualificationId, preQualificationId));
      await tx
        .delete(deepMigrationAnalyses)
        .where(eq(deepMigrationAnalyses.preQualificationId, preQualificationId));
      await tx.delete(preQualifications).where(eq(preQualifications.id, preQualificationId));
    });

    revalidatePath('/pre-qualifications');
    revalidatePath(`/pre-qualifications/${preQualificationId}`);

    return { success: true };
  } catch (error) {
    console.error('Error deleting prequalification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fehler beim Löschen des Pre-Qualifications',
    };
  }
}
