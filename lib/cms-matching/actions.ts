'use server';

import { eq } from 'drizzle-orm';

import { runCMSEvaluation, researchSingleRequirement, type CMSEvaluationInput } from './agent';
import type { CMSMatchingResult } from './schema';

import { db } from '@/lib/db';
import { leadScans } from '@/lib/db/schema';

/**
 * Startet die CMS-Evaluation für einen Qualification Scan
 * Speichert das Ergebnis automatisch in der Datenbank
 */
export async function startCMSEvaluation(
  qualificationScanId: string,
  options?: { useWebSearch?: boolean; businessUnitId?: string; forceRefresh?: boolean }
): Promise<{ success: boolean; result?: CMSMatchingResult; error?: string }> {
  try {
    // Quick Scan laden
    const scans = await db
      .select()
      .from(leadScans)
      .where(eq(leadScans.id, qualificationScanId))
      .limit(1);

    if (!scans.length) {
      return { success: false, error: 'Qualification Scan nicht gefunden' };
    }

    const scan = scans[0];

    if (scan.status !== 'completed') {
      return { success: false, error: 'Qualification Scan ist noch nicht abgeschlossen' };
    }

    // Prüfe, ob bereits eine Evaluation existiert (außer bei forceRefresh)
    if (!options?.forceRefresh && scan.cmsEvaluation) {
      try {
        const existingResult = JSON.parse(scan.cmsEvaluation) as CMSMatchingResult;
        return { success: true, result: existingResult };
      } catch {
        // Parsing fehlgeschlagen, neu berechnen
      }
    }

    // Qualification Scan Daten parsen
    const qualificationScanData: CMSEvaluationInput['qualificationScanData'] = {
      techStack: scan.techStack ? JSON.parse(scan.techStack) : undefined,
      features: scan.features ? JSON.parse(scan.features) : undefined,
      contentVolume: scan.contentVolume ? JSON.parse(scan.contentVolume) : undefined,
      accessibilityAudit: scan.accessibilityAudit ? JSON.parse(scan.accessibilityAudit) : undefined,
      legalCompliance: scan.legalCompliance ? JSON.parse(scan.legalCompliance) : undefined,
      performanceIndicators: scan.performanceIndicators
        ? JSON.parse(scan.performanceIndicators)
        : undefined,
    };

    // CMS-Evaluation ausführen
    const result = await runCMSEvaluation({
      qualificationScanData: qualificationScanData,
      useWebSearch: options?.useWebSearch ?? true, // Default: Web Search aktiviert
      businessUnitId: options?.businessUnitId,
    });

    // Ergebnis in DB speichern
    await db
      .update(leadScans)
      .set({
        cmsEvaluation: JSON.stringify(result),
        cmsEvaluationCompletedAt: new Date(),
      })
      .where(eq(leadScans.id, qualificationScanId));

    return { success: true, result };
  } catch (error) {
    console.error('CMS Evaluation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'CMS-Evaluation fehlgeschlagen',
    };
  }
}

/**
 * Lädt eine gespeicherte CMS-Evaluation
 * Gibt null zurück, wenn noch keine Evaluation existiert
 */
export async function getCMSEvaluation(
  qualificationScanId: string
): Promise<{ success: boolean; result?: CMSMatchingResult | null; error?: string }> {
  try {
    const scans = await db
      .select({ cmsEvaluation: leadScans.cmsEvaluation })
      .from(leadScans)
      .where(eq(leadScans.id, qualificationScanId))
      .limit(1);

    if (!scans.length) {
      return { success: false, error: 'Qualification Scan nicht gefunden' };
    }

    if (!scans[0].cmsEvaluation) {
      return { success: true, result: null };
    }

    const result = JSON.parse(scans[0].cmsEvaluation) as CMSMatchingResult;
    return { success: true, result };
  } catch (error) {
    console.error('Get CMS Evaluation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Laden der CMS-Evaluation fehlgeschlagen',
    };
  }
}

/**
 * Erzwingt eine neue CMS-Evaluation (auch wenn bereits eine existiert)
 */
export async function refreshCMSEvaluation(
  qualificationScanId: string,
  options?: { useWebSearch?: boolean; businessUnitId?: string }
): Promise<{ success: boolean; result?: CMSMatchingResult; error?: string }> {
  return startCMSEvaluation(qualificationScanId, { ...options, forceRefresh: true });
}

/**
 * Recherchiert ein einzelnes Requirement für ein CMS und aktualisiert die Evaluation
 */
export async function researchRequirement(
  qualificationScanId: string,
  cmsId: string,
  requirement: string
): Promise<{ success: boolean; result?: CMSMatchingResult; error?: string }> {
  try {
    // Aktuelle Evaluation laden
    const scans = await db
      .select({ cmsEvaluation: leadScans.cmsEvaluation })
      .from(leadScans)
      .where(eq(leadScans.id, qualificationScanId))
      .limit(1);

    if (!scans.length || !scans[0].cmsEvaluation) {
      return { success: false, error: 'Keine CMS-Evaluation gefunden' };
    }

    const evaluation = JSON.parse(scans[0].cmsEvaluation) as CMSMatchingResult;

    // CMS-Name aus den comparedTechnologies holen
    const cms = evaluation.comparedTechnologies.find(t => t.id === cmsId);
    if (!cms) {
      return { success: false, error: 'CMS nicht gefunden' };
    }

    console.log(`[CMS Research] Researching "${requirement}" for ${cms.name}...`);

    // Einzelnes Requirement recherchieren (mit technologyId für Cache-Speicherung)
    const researchResult = await researchSingleRequirement(cms.name, requirement, cmsId);

    // Requirement in der Evaluation aktualisieren
    const updatedRequirements = evaluation.requirements.map(req => {
      if (req.requirement === requirement && req.cmsScores[cmsId]) {
        return {
          ...req,
          cmsScores: {
            ...req.cmsScores,
            [cmsId]: {
              score: researchResult.score,
              confidence: researchResult.confidence,
              notes: researchResult.notes,
              webSearchUsed: true,
            },
          },
        };
      }
      return req;
    });

    // Gesamtscores neu berechnen
    const updatedTechnologies = evaluation.comparedTechnologies.map(tech => {
      const scores = updatedRequirements.map(r => {
        const cmsScore = r.cmsScores[tech.id];
        const weight = r.priority === 'must-have' ? 2 : r.priority === 'should-have' ? 1.5 : 1;
        return (cmsScore?.score || 50) * weight;
      });

      const totalWeight = updatedRequirements.reduce((sum, r) => {
        return sum + (r.priority === 'must-have' ? 2 : r.priority === 'should-have' ? 1.5 : 1);
      }, 0);

      const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / totalWeight);

      return { ...tech, overallScore };
    });

    // Sortieren nach Score
    updatedTechnologies.sort((a, b) => b.overallScore - a.overallScore);

    // Empfehlung aktualisieren
    const primary = updatedTechnologies[0];
    const alternative = updatedTechnologies[1];

    const updatedEvaluation: CMSMatchingResult = {
      ...evaluation,
      requirements: updatedRequirements,
      comparedTechnologies: updatedTechnologies,
      recommendation: {
        ...evaluation.recommendation,
        primaryCms: primary.name,
        reasoning: `${primary.name} erreicht den höchsten Gesamt-Score (${primary.overallScore}%) basierend auf ${updatedRequirements.length} Anforderungen.`,
        alternativeCms: alternative?.name,
        alternativeReasoning: alternative
          ? `${alternative.name} mit ${alternative.overallScore}% als Alternative.`
          : undefined,
        confidence: primary.overallScore,
      },
      metadata: {
        ...evaluation.metadata,
        matchedAt: new Date().toISOString(),
        webSearchUsed: true,
      },
    };

    // In DB speichern
    await db
      .update(leadScans)
      .set({
        cmsEvaluation: JSON.stringify(updatedEvaluation),
        cmsEvaluationCompletedAt: new Date(),
      })
      .where(eq(leadScans.id, qualificationScanId));

    console.log(
      `[CMS Research] Updated "${requirement}" for ${cms.name}: ${researchResult.score}%`
    );

    return { success: true, result: updatedEvaluation };
  } catch (error) {
    console.error('Research requirement error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Recherche fehlgeschlagen',
    };
  }
}
