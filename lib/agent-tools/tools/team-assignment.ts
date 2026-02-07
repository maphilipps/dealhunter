import { eq, and, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { teamAssignments, preQualifications, employees } from '@/lib/db/schema';

/**
 * TeamAssignment CRUD Tools
 *
 * TeamAssignments link Employees to PreQualifications with a specific role.
 * These tools provide full CRUD access for agents to:
 * - List team members for a Qualification
 * - Get individual assignment details
 * - Create new assignments
 * - Update assignment roles
 * - Remove team members
 */

const TEAM_ROLES = [
  'lead',
  'architect',
  'developer',
  'designer',
  'qa',
  'pm',
  'consultant',
] as const;

// ============================================================================
// teamAssignment.list - List team assignments
// ============================================================================

const listTeamAssignmentsInputSchema = z.object({
  preQualificationId: z.string().optional(),
  employeeId: z.string().optional(),
  role: z.enum(TEAM_ROLES).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'teamAssignment.list',
  description: 'List team assignments, optionally filtered by Qualification, employee, or role',
  category: 'team-assignment',
  inputSchema: listTeamAssignmentsInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    // If filtering by preQualificationId, verify access
    if (input.preQualificationId) {
      const [preQual] = await db
        .select()
        .from(preQualifications)
        .where(
          and(
            eq(preQualifications.id, input.preQualificationId),
            eq(preQualifications.userId, context.userId)
          )
        )
        .limit(1);

      if (!preQual) {
        return { success: false, error: 'Qualification not found or no access' };
      }
      conditions.push(eq(teamAssignments.preQualificationId, input.preQualificationId));
    } else {
      // Without preQualificationId filter, only return assignments for user's qualifications
      const userPreQuals = await db
        .select({ id: preQualifications.id })
        .from(preQualifications)
        .where(eq(preQualifications.userId, context.userId));

      const preQualIds = userPreQuals.map(p => p.id);
      if (preQualIds.length === 0) {
        return { success: true, data: [] };
      }
      conditions.push(inArray(teamAssignments.preQualificationId, preQualIds));
    }

    if (input.employeeId) {
      conditions.push(eq(teamAssignments.employeeId, input.employeeId));
    }

    if (input.role) {
      conditions.push(eq(teamAssignments.role, input.role));
    }

    const assignments = await db
      .select({
        id: teamAssignments.id,
        preQualificationId: teamAssignments.preQualificationId,
        employeeId: teamAssignments.employeeId,
        role: teamAssignments.role,
        assignedAt: teamAssignments.assignedAt,
        notifiedAt: teamAssignments.notifiedAt,
      })
      .from(teamAssignments)
      .where(and(...conditions))
      .orderBy(desc(teamAssignments.assignedAt))
      .limit(input.limit);

    return { success: true, data: assignments };
  },
});

// ============================================================================
// teamAssignment.get - Get a single team assignment
// ============================================================================

const getTeamAssignmentInputSchema = z.object({
  id: z.string(),
  includeEmployee: z.boolean().default(false),
});

registry.register({
  name: 'teamAssignment.get',
  description: 'Get a single team assignment by ID with optional employee details',
  category: 'team-assignment',
  inputSchema: getTeamAssignmentInputSchema,
  async execute(input, context: ToolContext) {
    const [assignment] = await db
      .select()
      .from(teamAssignments)
      .where(eq(teamAssignments.id, input.id))
      .limit(1);

    if (!assignment) {
      return { success: false, error: 'Team assignment not found' };
    }

    // Verify access via preQualification
    const [preQual] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, assignment.preQualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!preQual) {
      return { success: false, error: 'No access to this team assignment' };
    }

    let employeeData = undefined;
    if (input.includeEmployee) {
      const [employee] = await db
        .select({
          id: employees.id,
          name: employees.name,
          email: employees.email,
          skills: employees.skills,
          roles: employees.roles,
        })
        .from(employees)
        .where(eq(employees.id, assignment.employeeId))
        .limit(1);
      employeeData = employee;
    }

    return {
      success: true,
      data: {
        ...assignment,
        employee: employeeData,
      },
    };
  },
});

// ============================================================================
// teamAssignment.create - Create a new team assignment
// ============================================================================

const createTeamAssignmentInputSchema = z.object({
  preQualificationId: z.string(),
  employeeId: z.string(),
  role: z.enum(TEAM_ROLES),
});

registry.register({
  name: 'teamAssignment.create',
  description: 'Create a new team assignment linking an employee to a Qualification',
  category: 'team-assignment',
  inputSchema: createTeamAssignmentInputSchema,
  async execute(input, context: ToolContext) {
    // Verify preQualification access
    const [preQual] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, input.preQualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!preQual) {
      return { success: false, error: 'Qualification not found or no access' };
    }

    // Verify employee exists
    const [employee] = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .limit(1);

    if (!employee) {
      return { success: false, error: 'Employee not found' };
    }

    // Check for duplicate assignment (same employee + preQual + role)
    const [existing] = await db
      .select()
      .from(teamAssignments)
      .where(
        and(
          eq(teamAssignments.preQualificationId, input.preQualificationId),
          eq(teamAssignments.employeeId, input.employeeId),
          eq(teamAssignments.role, input.role)
        )
      )
      .limit(1);

    if (existing) {
      return {
        success: false,
        error: `Employee ${employee.name} is already assigned as ${input.role} to this Qualification`,
      };
    }

    const [created] = await db
      .insert(teamAssignments)
      .values({
        preQualificationId: input.preQualificationId,
        employeeId: input.employeeId,
        role: input.role,
      })
      .returning();

    return { success: true, data: created };
  },
});

// ============================================================================
// teamAssignment.update - Update a team assignment
// ============================================================================

const updateTeamAssignmentInputSchema = z.object({
  id: z.string(),
  role: z.enum(TEAM_ROLES).optional(),
  notifiedAt: z.string().datetime().optional(),
});

registry.register({
  name: 'teamAssignment.update',
  description: 'Update a team assignment role or notification timestamp',
  category: 'team-assignment',
  inputSchema: updateTeamAssignmentInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(teamAssignments)
      .where(eq(teamAssignments.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Team assignment not found' };
    }

    // Verify access via preQualification
    const [preQual] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, existing.preQualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!preQual) {
      return { success: false, error: 'No access to this team assignment' };
    }

    const updateData: Record<string, unknown> = {};

    if (input.role !== undefined) {
      updateData.role = input.role;
    }
    if (input.notifiedAt !== undefined) {
      updateData.notifiedAt = new Date(input.notifiedAt);
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    const [updated] = await db
      .update(teamAssignments)
      .set(updateData)
      .where(eq(teamAssignments.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

// ============================================================================
// teamAssignment.delete - Remove a team assignment
// ============================================================================

const deleteTeamAssignmentInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'teamAssignment.delete',
  description: 'Remove a team member from a Qualification',
  category: 'team-assignment',
  inputSchema: deleteTeamAssignmentInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(teamAssignments)
      .where(eq(teamAssignments.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Team assignment not found' };
    }

    // Verify access via preQualification
    const [preQual] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, existing.preQualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!preQual) {
      return { success: false, error: 'No access to this team assignment' };
    }

    await db.delete(teamAssignments).where(eq(teamAssignments.id, input.id));

    return {
      success: true,
      data: {
        id: input.id,
        deleted: true,
      },
    };
  },
});

// ============================================================================
// teamAssignment.markNotified - Mark team member as notified
// ============================================================================

const markNotifiedInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'teamAssignment.markNotified',
  description: 'Mark a team member as notified (sets notifiedAt timestamp)',
  category: 'team-assignment',
  inputSchema: markNotifiedInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(teamAssignments)
      .where(eq(teamAssignments.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Team assignment not found' };
    }

    // Verify access via preQualification
    const [preQual] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, existing.preQualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!preQual) {
      return { success: false, error: 'No access to this team assignment' };
    }

    const [updated] = await db
      .update(teamAssignments)
      .set({ notifiedAt: new Date() })
      .where(eq(teamAssignments.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

// ============================================================================
// teamAssignment.listByPreQualification - Get full team for a Qualification
// ============================================================================

const listByPreQualificationInputSchema = z.object({
  preQualificationId: z.string(),
});

registry.register({
  name: 'teamAssignment.listByPreQualification',
  description: 'Get the full team for a Qualification with employee details (name, email, skills)',
  category: 'team-assignment',
  inputSchema: listByPreQualificationInputSchema,
  async execute(input, context: ToolContext) {
    // Verify access
    const [preQual] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, input.preQualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!preQual) {
      return { success: false, error: 'Qualification not found or no access' };
    }

    // Get all assignments with employee data via join
    const assignments = await db
      .select({
        id: teamAssignments.id,
        role: teamAssignments.role,
        assignedAt: teamAssignments.assignedAt,
        notifiedAt: teamAssignments.notifiedAt,
        employeeId: employees.id,
        employeeName: employees.name,
        employeeEmail: employees.email,
        employeeSkills: employees.skills,
        employeeRoles: employees.roles,
      })
      .from(teamAssignments)
      .innerJoin(employees, eq(teamAssignments.employeeId, employees.id))
      .where(eq(teamAssignments.preQualificationId, input.preQualificationId))
      .orderBy(teamAssignments.role);

    // Transform to cleaner structure
    const team = assignments.map(a => ({
      id: a.id,
      role: a.role,
      assignedAt: a.assignedAt,
      notifiedAt: a.notifiedAt,
      employee: {
        id: a.employeeId,
        name: a.employeeName,
        email: a.employeeEmail,
        skills: a.employeeSkills,
        roles: a.employeeRoles,
      },
    }));

    return { success: true, data: team };
  },
});
