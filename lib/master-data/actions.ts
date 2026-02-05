'use server';

import { eq, and, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  references,
  competencies,
  competitors,
  employees,
  businessUnits,
  technologies,
  type NewReference,
  type NewCompetency,
  type NewCompetitor,
  type NewEmployee,
} from '@/lib/db/schema';

// ============================================================================
// Zod Schemas
// ============================================================================

const createReferenceSchema = z.object({
  projectName: z.string().min(1).max(200),
  customerName: z.string().min(1).max(200),
  industry: z.string().min(1).max(100),
  technologies: z.array(z.string()).min(1),
  scope: z.string().min(1).max(2000),
  teamSize: z.number().int().min(1).max(1000),
  durationMonths: z.number().int().min(1).max(240),
  budgetRange: z.string().min(1).max(100),
  outcome: z.string().min(1).max(2000),
  highlights: z.array(z.string()).optional(),
});

const createCompetencySchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['technology', 'methodology', 'industry', 'soft_skill']),
  level: z.enum(['basic', 'advanced', 'expert']),
  description: z.string().max(2000).optional(),
  certifications: z.array(z.string()).optional(),
});

const createCompetitorSchema = z.object({
  companyName: z.string().min(1).max(200),
  website: z.string().url().max(500).optional(),
  industry: z.array(z.string()).optional(),
  description: z.string().max(2000).optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  typicalMarkets: z.array(z.string()).optional(),
});

const createEmployeeSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  businessUnitId: z.string(),
  skills: z.array(z.string()).min(1),
  roles: z.array(z.string()).min(1),
  availabilityStatus: z.enum(['available', 'on_project', 'unavailable']),
});

const createTechnologySchema = z.object({
  name: z.string().min(1).max(200),
  businessUnitId: z.string(),
  baselineHours: z.number().int().min(0).optional(),
  baselineName: z.string().max(200).optional(),
  baselineEntityCounts: z.record(z.string(), z.number()).optional(),
  isDefault: z.boolean(),
});

// ============================================================================
// References Actions
// ============================================================================

export async function createReference(data: z.infer<typeof createReferenceSchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createReferenceSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const newReference: NewReference = {
      ...parsed.data,
      technologies: JSON.stringify(parsed.data.technologies),
      highlights: parsed.data.highlights ? JSON.stringify(parsed.data.highlights) : null,
      userId: session.user.id,
      status: 'pending',
      isValidated: false,
    };

    const [created] = await db.insert(references).values(newReference).returning();

    revalidatePath('/master-data/references');
    revalidatePath('/admin/validations');

    return { success: true, data: created };
  } catch (error) {
    console.error('createReference error:', error);
    return { success: false, error: 'Failed to create reference' };
  }
}

export async function getUserReferences() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Admins see all, users see only their own
  const condition =
    session.user.role === 'admin' ? undefined : eq(references.userId, session.user.id);

  const items = await db
    .select()
    .from(references)
    .where(condition)
    .orderBy(desc(references.createdAt));

  return items;
}

export async function deleteReference(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const [existing] = await db.select().from(references).where(eq(references.id, id));

    if (!existing) {
      return { success: false, error: 'Not found' };
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return { success: false, error: 'Forbidden' };
    }

    await db.delete(references).where(eq(references.id, id));

    revalidatePath('/master-data/references');
    return { success: true };
  } catch (error) {
    console.error('deleteReference error:', error);
    return { success: false, error: 'Failed to delete reference' };
  }
}

// ============================================================================
// Competencies Actions
// ============================================================================

export async function createCompetency(data: z.infer<typeof createCompetencySchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createCompetencySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const newCompetency: NewCompetency = {
      ...parsed.data,
      certifications: parsed.data.certifications
        ? JSON.stringify(parsed.data.certifications)
        : null,
      userId: session.user.id,
      status: 'pending',
      isValidated: false,
    };

    const [created] = await db.insert(competencies).values(newCompetency).returning();

    revalidatePath('/master-data/competencies');
    revalidatePath('/admin/validations');

    return { success: true, data: created };
  } catch (error) {
    console.error('createCompetency error:', error);
    return { success: false, error: 'Failed to create competency' };
  }
}

export async function getUserCompetencies() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const condition =
    session.user.role === 'admin' ? undefined : eq(competencies.userId, session.user.id);

  const items = await db
    .select()
    .from(competencies)
    .where(condition)
    .orderBy(desc(competencies.createdAt));

  return items;
}

export async function getCompetency(id: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const [item] = await db.select().from(competencies).where(eq(competencies.id, id));

  if (!item) {
    return null;
  }

  if (session.user.role !== 'admin' && item.userId !== session.user.id) {
    throw new Error('Forbidden');
  }

  return item;
}

export async function updateCompetency(id: string, data: z.infer<typeof createCompetencySchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createCompetencySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const [existing] = await db.select().from(competencies).where(eq(competencies.id, id));

    if (!existing) {
      return { success: false, error: 'Not found' };
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return { success: false, error: 'Forbidden' };
    }

    const [updated] = await db
      .update(competencies)
      .set({
        name: parsed.data.name,
        category: parsed.data.category,
        level: parsed.data.level,
        description: parsed.data.description ?? null,
        certifications: parsed.data.certifications
          ? JSON.stringify(parsed.data.certifications)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(competencies.id, id))
      .returning();

    revalidatePath('/master-data/competencies');
    revalidatePath('/admin/validations');

    return { success: true, data: updated };
  } catch (error) {
    console.error('updateCompetency error:', error);
    return { success: false, error: 'Failed to update competency' };
  }
}

export async function deleteCompetency(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const [existing] = await db.select().from(competencies).where(eq(competencies.id, id));

    if (!existing) {
      return { success: false, error: 'Not found' };
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return { success: false, error: 'Forbidden' };
    }

    await db.delete(competencies).where(eq(competencies.id, id));

    revalidatePath('/master-data/competencies');
    return { success: true };
  } catch (error) {
    console.error('deleteCompetency error:', error);
    return { success: false, error: 'Failed to delete competency' };
  }
}

// ============================================================================
// Competitors Actions
// ============================================================================

export async function createCompetitor(data: z.infer<typeof createCompetitorSchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createCompetitorSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const newCompetitor: NewCompetitor = {
      ...parsed.data,
      industry: parsed.data.industry ? JSON.stringify(parsed.data.industry) : null,
      strengths: parsed.data.strengths ? JSON.stringify(parsed.data.strengths) : null,
      weaknesses: parsed.data.weaknesses ? JSON.stringify(parsed.data.weaknesses) : null,
      typicalMarkets: parsed.data.typicalMarkets
        ? JSON.stringify(parsed.data.typicalMarkets)
        : null,
      userId: session.user.id,
      status: 'pending',
      isValidated: false,
    };

    const [created] = await db.insert(competitors).values(newCompetitor).returning();

    revalidatePath('/master-data/competitors');
    revalidatePath('/admin/validations');

    return { success: true, data: created };
  } catch (error) {
    console.error('createCompetitor error:', error);
    return { success: false, error: 'Failed to create competitor' };
  }
}

export async function getUserCompetitors() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const condition =
    session.user.role === 'admin' ? undefined : eq(competitors.userId, session.user.id);

  const items = await db
    .select()
    .from(competitors)
    .where(condition)
    .orderBy(desc(competitors.createdAt));

  return items;
}

export async function getCompetitor(id: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const [item] = await db.select().from(competitors).where(eq(competitors.id, id));

  if (!item) {
    return null;
  }

  if (session.user.role !== 'admin' && item.userId !== session.user.id) {
    throw new Error('Forbidden');
  }

  return item;
}

export async function updateCompetitor(id: string, data: z.infer<typeof createCompetitorSchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createCompetitorSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const [existing] = await db.select().from(competitors).where(eq(competitors.id, id));

    if (!existing) {
      return { success: false, error: 'Not found' };
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return { success: false, error: 'Forbidden' };
    }

    const [updated] = await db
      .update(competitors)
      .set({
        companyName: parsed.data.companyName,
        website: parsed.data.website ?? null,
        industry: parsed.data.industry ? JSON.stringify(parsed.data.industry) : null,
        description: parsed.data.description ?? null,
        strengths: parsed.data.strengths ? JSON.stringify(parsed.data.strengths) : null,
        weaknesses: parsed.data.weaknesses ? JSON.stringify(parsed.data.weaknesses) : null,
        typicalMarkets: parsed.data.typicalMarkets
          ? JSON.stringify(parsed.data.typicalMarkets)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(competitors.id, id))
      .returning();

    revalidatePath('/master-data/competitors');
    revalidatePath('/admin/validations');

    return { success: true, data: updated };
  } catch (error) {
    console.error('updateCompetitor error:', error);
    return { success: false, error: 'Failed to update competitor' };
  }
}

export async function deleteCompetitor(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const [existing] = await db.select().from(competitors).where(eq(competitors.id, id));

    if (!existing) {
      return { success: false, error: 'Not found' };
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return { success: false, error: 'Forbidden' };
    }

    await db.delete(competitors).where(eq(competitors.id, id));

    revalidatePath('/master-data/competitors');
    return { success: true };
  } catch (error) {
    console.error('deleteCompetitor error:', error);
    return { success: false, error: 'Failed to delete competitor' };
  }
}

// ============================================================================
// Employees Actions
// ============================================================================

export async function createEmployee(data: z.infer<typeof createEmployeeSchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createEmployeeSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const newEmployee: NewEmployee = {
      name: parsed.data.name,
      email: parsed.data.email,
      businessUnitId: parsed.data.businessUnitId,
      skills: JSON.stringify(parsed.data.skills),
      roles: JSON.stringify(parsed.data.roles),
      availabilityStatus: parsed.data.availabilityStatus,
    };

    const [created] = await db.insert(employees).values(newEmployee).returning();

    revalidatePath('/master-data/employees');

    return { success: true, data: created };
  } catch (error) {
    console.error('createEmployee error:', error);
    return { success: false, error: 'Failed to create employee' };
  }
}

export async function getUserEmployees() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const items = await db
    .select({
      id: employees.id,
      name: employees.name,
      email: employees.email,
      skills: employees.skills,
      roles: employees.roles,
      availabilityStatus: employees.availabilityStatus,
      createdAt: employees.createdAt,
      businessUnitId: employees.businessUnitId,
      businessLineName: businessUnits.name,
    })
    .from(employees)
    .leftJoin(businessUnits, eq(employees.businessUnitId, businessUnits.id))
    .orderBy(employees.name);

  return items;
}

export async function getEmployee(id: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const [item] = await db.select().from(employees).where(eq(employees.id, id));

  if (!item) {
    return null;
  }

  return { success: true, employee: item };
}

export async function updateEmployee(id: string, data: z.infer<typeof createEmployeeSchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = createEmployeeSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const [existing] = await db.select().from(employees).where(eq(employees.id, id));

    if (!existing) {
      return { success: false, error: 'Not found' };
    }

    const [updated] = await db
      .update(employees)
      .set({
        name: parsed.data.name,
        email: parsed.data.email,
        businessUnitId: parsed.data.businessUnitId,
        skills: JSON.stringify(parsed.data.skills),
        roles: JSON.stringify(parsed.data.roles),
        availabilityStatus: parsed.data.availabilityStatus,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();

    revalidatePath('/master-data/employees');

    return { success: true, data: updated };
  } catch (error) {
    console.error('updateEmployee error:', error);
    return { success: false, error: 'Failed to update employee' };
  }
}

export async function deleteEmployee(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const [existing] = await db.select().from(employees).where(eq(employees.id, id));

    if (!existing) {
      return { success: false, error: 'Not found' };
    }

    await db.delete(employees).where(eq(employees.id, id));

    revalidatePath('/master-data/employees');
    return { success: true };
  } catch (error) {
    console.error('deleteEmployee error:', error);
    return { success: false, error: 'Failed to delete employee' };
  }
}

export async function getBusinessUnitsForSelect() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const items = await db
    .select({
      id: businessUnits.id,
      name: businessUnits.name,
    })
    .from(businessUnits)
    .orderBy(businessUnits.name);

  return { success: true, businessUnits: items };
}

export async function getCompetenciesForSelect() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const items = await db
    .select({
      id: competencies.id,
      name: competencies.name,
    })
    .from(competencies)
    .orderBy(competencies.name);

  return { success: true, competencies: items };
}

// ============================================================================
// Technologies Actions
// ============================================================================

export async function getTechnologies() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

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

export async function createTechnology(data: z.infer<typeof createTechnologySchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createTechnologySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const [technology] = await db
      .insert(technologies)
      .values({
        name: parsed.data.name.trim(),
        businessUnitId: parsed.data.businessUnitId,
        baselineHours: parsed.data.baselineHours ?? 0,
        baselineName: parsed.data.baselineName?.trim() ?? '',
        baselineEntityCounts:
          parsed.data.baselineEntityCounts &&
          Object.keys(parsed.data.baselineEntityCounts).length > 0
            ? JSON.stringify(parsed.data.baselineEntityCounts)
            : '{}',
        isDefault: parsed.data.isDefault,
      })
      .returning();

    revalidatePath('/master-data/technologies');

    return { success: true, technology };
  } catch (error) {
    console.error('Error creating technology:', error);
    return { success: false, error: 'Fehler beim Erstellen der Technologie' };
  }
}

export async function getTechnology(id: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  try {
    const [tech] = await db.select().from(technologies).where(eq(technologies.id, id));

    if (!tech) {
      return { success: false, error: 'Technologie nicht gefunden' };
    }

    return { success: true, technology: tech };
  } catch (error) {
    console.error('Error fetching technology:', error);
    return { success: false, error: 'Fehler beim Laden der Technologie' };
  }
}

export async function updateTechnology(id: string, data: z.infer<typeof createTechnologySchema>) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createTechnologySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', details: parsed.error };
  }

  try {
    const [technology] = await db
      .update(technologies)
      .set({
        name: parsed.data.name.trim(),
        businessUnitId: parsed.data.businessUnitId,
        baselineHours: parsed.data.baselineHours ?? 0,
        baselineName: parsed.data.baselineName?.trim() ?? '',
        baselineEntityCounts:
          parsed.data.baselineEntityCounts &&
          Object.keys(parsed.data.baselineEntityCounts).length > 0
            ? JSON.stringify(parsed.data.baselineEntityCounts)
            : '{}',
        isDefault: parsed.data.isDefault,
        updatedAt: new Date(),
      })
      .where(eq(technologies.id, id))
      .returning();

    revalidatePath('/master-data/technologies');

    return { success: true, technology };
  } catch (error) {
    console.error('Error updating technology:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Technologie' };
  }
}

export async function deleteTechnology(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Forbidden' };
  }

  try {
    await db.delete(technologies).where(eq(technologies.id, id));

    revalidatePath('/master-data/technologies');

    return { success: true };
  } catch (error) {
    console.error('Error deleting technology:', error);
    return { success: false, error: 'Fehler beim Löschen der Technologie' };
  }
}
