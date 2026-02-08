'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { technologies, businessUnits, features, cmsFeatureEvaluations } from '@/lib/db/schema';

export async function getTechnologies() {
  try {
    const tech = await db
      .select({
        id: technologies.id,
        name: technologies.name,
        baselineHours: technologies.baselineHours,
        baselineName: technologies.baselineName,
        baselineEntityCounts: technologies.baselineEntityCounts,
        isDefault: technologies.isDefault,
        createdAt: technologies.createdAt,
        businessUnitId: technologies.businessUnitId,
        businessLineName: businessUnits.name,
        // Extended metadata
        logoUrl: technologies.logoUrl,
        websiteUrl: technologies.websiteUrl,
        description: technologies.description,
        category: technologies.category,
        license: technologies.license,
        latestVersion: technologies.latestVersion,
        githubUrl: technologies.githubUrl,
        githubStars: technologies.githubStars,
        communitySize: technologies.communitySize,
        researchStatus: technologies.researchStatus,
        lastResearchedAt: technologies.lastResearchedAt,
      })
      .from(technologies)
      .leftJoin(businessUnits, eq(technologies.businessUnitId, businessUnits.id))
      .orderBy(technologies.createdAt);

    return { success: true, technologies: tech };
  } catch (error) {
    console.error('Error fetching technologies:', error);
    return { success: false, error: 'Fehler beim Laden der Technologien' };
  }
}

export async function getBusinessUnitsForSelect() {
  try {
    const lines = await db
      .select({
        id: businessUnits.id,
        name: businessUnits.name,
      })
      .from(businessUnits)
      .orderBy(businessUnits.name);

    return { success: true, businessUnits: lines };
  } catch (error) {
    console.error('Error fetching business lines:', error);
    return { success: false, error: 'Fehler beim Laden der Business Units' };
  }
}

export async function createTechnology(data: {
  name: string;
  businessUnitId: string;
  baselineHours?: number;
  baselineName?: string;
  baselineEntityCounts?: Record<string, number>;
  isDefault: boolean;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  const { name, businessUnitId, baselineHours, baselineName, baselineEntityCounts, isDefault } =
    data;

  // Validate inputs
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Name ist erforderlich' };
  }

  if (!businessUnitId) {
    return { success: false, error: 'Business Unit ist erforderlich' };
  }

  // Baseline is now optional - validate only if provided
  if (baselineHours !== undefined && baselineHours <= 0) {
    return { success: false, error: 'Baseline-Stunden müssen größer als 0 sein' };
  }

  try {
    const [technology] = await db
      .insert(technologies)
      .values({
        name: name.trim(),
        businessUnitId,
        // Baseline fields - use defaults for DB NOT NULL constraints
        baselineHours: baselineHours ?? 0,
        baselineName: baselineName?.trim() ?? '',
        baselineEntityCounts:
          baselineEntityCounts && Object.keys(baselineEntityCounts).length > 0
            ? JSON.stringify(baselineEntityCounts)
            : '{}',
        isDefault,
      })
      .returning();

    revalidatePath('/admin/technologies');

    return { success: true, technology };
  } catch (error) {
    console.error('Error creating technology:', error);
    return { success: false, error: 'Fehler beim Erstellen der Technologie' };
  }
}

export async function getTechnology(id: string) {
  try {
    const [tech] = await db.select().from(technologies).where(eq(technologies.id, id));

    if (!tech) {
      return { success: false, error: 'Technologie nicht gefunden' };
    }

    // Load relational feature evaluations
    let featureEvaluations: Record<
      string,
      {
        score: number;
        confidence: number | null;
        notes: string | null;
        reasoning: string | null;
        supportType: string | null;
        moduleName: string | null;
        sourceUrls: string[] | null;
        updatedAt: Date | null;
      }
    > = {};

    try {
      const evals = await db
        .select({
          featureName: features.name,
          score: cmsFeatureEvaluations.score,
          confidence: cmsFeatureEvaluations.confidence,
          notes: cmsFeatureEvaluations.notes,
          reasoning: cmsFeatureEvaluations.reasoning,
          supportType: cmsFeatureEvaluations.supportType,
          moduleName: cmsFeatureEvaluations.moduleName,
          sourceUrls: cmsFeatureEvaluations.sourceUrls,
          updatedAt: cmsFeatureEvaluations.updatedAt,
        })
        .from(cmsFeatureEvaluations)
        .innerJoin(features, eq(cmsFeatureEvaluations.featureId, features.id))
        .where(eq(cmsFeatureEvaluations.technologyId, id));

      for (const row of evals) {
        featureEvaluations[row.featureName] = {
          score: row.score,
          confidence: row.confidence,
          notes: row.notes,
          reasoning: row.reasoning,
          supportType: row.supportType,
          moduleName: row.moduleName,
          sourceUrls: row.sourceUrls ? JSON.parse(row.sourceUrls) : null,
          updatedAt: row.updatedAt,
        };
      }
    } catch {
      // Feature evaluations table may not exist yet — fall back to JSON blob
    }

    return { success: true, technology: tech, featureEvaluations };
  } catch (error) {
    console.error('Error fetching technology:', error);
    return { success: false, error: 'Fehler beim Laden der Technologie' };
  }
}

export async function deleteTechnology(id: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    await db.delete(technologies).where(eq(technologies.id, id));

    revalidatePath('/admin/technologies');

    return { success: true };
  } catch (error) {
    console.error('Error deleting technology:', error);
    return { success: false, error: 'Fehler beim Löschen der Technologie' };
  }
}

/**
 * Update an existing technology
 */
export async function updateTechnology(
  id: string,
  data: {
    name?: string;
    businessUnitId?: string;
    baselineHours?: number;
    baselineName?: string;
    baselineEntityCounts?: Record<string, number>;
    isDefault?: boolean;
  }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.businessUnitId !== undefined) updateData.businessUnitId = data.businessUnitId;
    if (data.baselineHours !== undefined) updateData.baselineHours = data.baselineHours;
    if (data.baselineName !== undefined) updateData.baselineName = data.baselineName.trim();
    if (data.baselineEntityCounts !== undefined) {
      updateData.baselineEntityCounts = JSON.stringify(data.baselineEntityCounts);
    }
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    const [technology] = await db
      .update(technologies)
      .set(updateData)
      .where(eq(technologies.id, id))
      .returning();

    revalidatePath('/admin/technologies');

    return { success: true, technology };
  } catch (error) {
    console.error('Error updating technology:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Technologie' };
  }
}

// Baseline-specific aliases (for backwards compatibility)
export const createTechnologyBaseline = createTechnology;
export const updateTechnologyBaseline = updateTechnology;
export const deleteTechnologyBaseline = deleteTechnology;
