'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { employees, businessUnits, competencies } from '@/lib/db/schema';

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

  if (
    !name.trim() ||
    !email.trim() ||
    !businessUnitId ||
    skills.length === 0 ||
    roles.length === 0
  ) {
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

export async function getEmployee(id: string) {
  try {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);

    if (!employee) {
      return { success: false, error: 'Mitarbeiter nicht gefunden' };
    }

    return { success: true, employee };
  } catch (error) {
    console.error('Error fetching employee:', error);
    return { success: false, error: 'Fehler beim Laden' };
  }
}

export async function updateEmployee(
  id: string,
  data: {
    name: string;
    email: string;
    businessUnitId: string;
    skills: string[];
    roles: string[];
    availabilityStatus: 'available' | 'on_project' | 'unavailable';
  }
) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  const { name, email, businessUnitId, skills, roles, availabilityStatus } = data;

  if (
    !name.trim() ||
    !email.trim() ||
    !businessUnitId ||
    skills.length === 0 ||
    roles.length === 0
  ) {
    return { success: false, error: 'Bitte alle Pflichtfelder ausfüllen' };
  }

  try {
    const [employee] = await db
      .update(employees)
      .set({
        name: name.trim(),
        email: email.trim(),
        businessUnitId,
        skills: JSON.stringify(skills),
        roles: JSON.stringify(roles),
        availabilityStatus,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();

    revalidatePath('/admin/employees');
    revalidatePath(`/admin/employees/${id}`);
    return { success: true, employee };
  } catch (error) {
    console.error('Error updating employee:', error);
    return { success: false, error: 'Fehler beim Aktualisieren' };
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

export async function importEmployeesFromCSV(csvData: string) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    // Simple CSV parser (name,email,businessUnitId,skills,roles,availabilityStatus)
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    if (headers.length < 6) {
      return {
        success: false,
        error:
          'CSV muss mindestens 6 Spalten haben (name,email,businessUnitId,skills,roles,availabilityStatus)',
      };
    }

    const imported: Array<{ id: string }> = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());

      if (values.length < 6) {
        errors.push(`Zeile ${i + 1}: Unvollständige Daten`);
        continue;
      }

      const [name, email, businessUnitId, skillsStr, rolesStr, availabilityStatus] = values;

      try {
        const skills = skillsStr
          .split(';')
          .map(s => s.trim())
          .filter(Boolean);
        const roles = rolesStr
          .split(';')
          .map(r => r.trim())
          .filter(Boolean);

        const [employee] = await db
          .insert(employees)
          .values({
            name,
            email,
            businessUnitId,
            skills: JSON.stringify(skills),
            roles: JSON.stringify(roles),
            availabilityStatus: availabilityStatus as 'available' | 'on_project' | 'unavailable',
          })
          .returning();

        imported.push(employee);
      } catch (error) {
        errors.push(
          `Zeile ${i + 1}: ${error instanceof Error ? error.message : 'Fehler beim Importieren'}`
        );
      }
    }

    revalidatePath('/admin/employees');
    return {
      success: true,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('Error importing CSV:', error);
    return { success: false, error: 'Fehler beim CSV-Import' };
  }
}
