import { z } from 'zod';
import { db } from '@/lib/db';
import { employees, businessUnits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { registry } from '../registry';
import type { ToolContext } from '../types';

const listEmployeesInputSchema = z.object({
  businessUnitId: z.string().optional(),
  availabilityStatus: z.enum(['available', 'on_project', 'unavailable']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'employee.list',
  description: 'List all employees, optionally filtered by business unit or availability',
  category: 'employee',
  inputSchema: listEmployeesInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin' && context.userRole !== 'bl') {
      return { success: false, error: 'Nur Admin oder BL kann Mitarbeiter sehen' };
    }

    let results;
    if (input.businessUnitId) {
      results = await db
        .select()
        .from(employees)
        .where(eq(employees.businessUnitId, input.businessUnitId))
        .orderBy(desc(employees.createdAt))
        .limit(input.limit);
    } else {
      results = await db
        .select()
        .from(employees)
        .orderBy(desc(employees.createdAt))
        .limit(input.limit);
    }

    if (input.availabilityStatus) {
      results = results.filter(e => e.availabilityStatus === input.availabilityStatus);
    }

    return { success: true, data: results };
  },
});

const getEmployeeInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'employee.get',
  description: 'Get a single employee by ID',
  category: 'employee',
  inputSchema: getEmployeeInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin' && context.userRole !== 'bl') {
      return { success: false, error: 'Nur Admin oder BL kann Mitarbeiter sehen' };
    }

    const [employee] = await db.select().from(employees).where(eq(employees.id, input.id)).limit(1);

    if (!employee) {
      return { success: false, error: 'Employee not found' };
    }

    return { success: true, data: employee };
  },
});

const createEmployeeInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  businessUnitId: z.string(),
  skills: z.array(z.string()),
  roles: z.array(z.string()),
  availabilityStatus: z.enum(['available', 'on_project', 'unavailable']).default('available'),
});

registry.register({
  name: 'employee.create',
  description: 'Create a new employee',
  category: 'employee',
  inputSchema: createEmployeeInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Mitarbeiter erstellen' };
    }

    const [bu] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, input.businessUnitId))
      .limit(1);

    if (!bu) {
      return { success: false, error: 'Business Unit not found' };
    }

    const [employee] = await db
      .insert(employees)
      .values({
        name: input.name,
        email: input.email,
        businessUnitId: input.businessUnitId,
        skills: JSON.stringify(input.skills),
        roles: JSON.stringify(input.roles),
        availabilityStatus: input.availabilityStatus,
      })
      .returning();

    return { success: true, data: employee };
  },
});

const updateEmployeeInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  businessUnitId: z.string().optional(),
  skills: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  availabilityStatus: z.enum(['available', 'on_project', 'unavailable']).optional(),
});

registry.register({
  name: 'employee.update',
  description: 'Update an existing employee',
  category: 'employee',
  inputSchema: updateEmployeeInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Mitarbeiter bearbeiten' };
    }

    const [existing] = await db.select().from(employees).where(eq(employees.id, input.id)).limit(1);

    if (!existing) {
      return { success: false, error: 'Employee not found' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name) updateData.name = input.name;
    if (input.email) updateData.email = input.email;
    if (input.businessUnitId) updateData.businessUnitId = input.businessUnitId;
    if (input.skills) updateData.skills = JSON.stringify(input.skills);
    if (input.roles) updateData.roles = JSON.stringify(input.roles);
    if (input.availabilityStatus) updateData.availabilityStatus = input.availabilityStatus;

    const [updated] = await db
      .update(employees)
      .set(updateData)
      .where(eq(employees.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

const deleteEmployeeInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'employee.delete',
  description: 'Delete an employee',
  category: 'employee',
  inputSchema: deleteEmployeeInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Mitarbeiter löschen' };
    }

    const [existing] = await db.select().from(employees).where(eq(employees.id, input.id)).limit(1);

    if (!existing) {
      return { success: false, error: 'Employee not found' };
    }

    await db.delete(employees).where(eq(employees.id, input.id));

    return { success: true, data: { id: input.id, deleted: true } };
  },
});
