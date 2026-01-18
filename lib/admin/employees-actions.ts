'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { employees, businessUnits, competencies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getEmployees() {
  try {
    const emps = await db
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

    return { success: true, employees: emps };
  } catch (error) {
    console.error('Error fetching employees:', error);
    return { success: false, error: 'Fehler beim Laden der Mitarbeiter' };
  }
}

export async function getCompetenciesForSelect() {
  try {
    const comps = await db
      .select({
        id: competencies.id,
        name: competencies.name,
      })
      .from(competencies)
      .orderBy(competencies.name);

    return { success: true, competencies: comps };
  } catch (error) {
    console.error('Error fetching competencies:', error);
    return { success: false, error: 'Fehler beim Laden der Kompetenzen' };
  }
}

export async function createEmployee(data: {
  name: string;
  email: string;
  businessUnitId: string;
  skills: string[];
  roles: string[];
  availabilityStatus: 'available' | 'on_project' | 'unavailable';
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  const { name, email, businessUnitId, skills, roles, availabilityStatus } = data;

  if (!name.trim() || !email.trim() || !businessUnitId || skills.length === 0 || roles.length === 0) {
    return { success: false, error: 'Bitte alle Pflichtfelder ausfüllen' };
  }

  try {
    const [employee] = await db
      .insert(employees)
      .values({
        name: name.trim(),
        email: email.trim(),
        businessUnitId,
        skills: JSON.stringify(skills),
        roles: JSON.stringify(roles),
        availabilityStatus,
      })
      .returning();

    revalidatePath('/admin/employees');
    return { success: true, employee };
  } catch (error) {
    console.error('Error creating employee:', error);
    return { success: false, error: 'Fehler beim Erstellen' };
  }
}

export async function deleteEmployee(id: string) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    await db.delete(employees).where(eq(employees.id, id));
    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error) {
    console.error('Error deleting employee:', error);
    return { success: false, error: 'Fehler beim Löschen' };
  }
}
