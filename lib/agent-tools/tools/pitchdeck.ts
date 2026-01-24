import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import {
  pitchdecks,
  pitchdeckDeliverables,
  pitchdeckTeamMembers,
  qualifications,
  employees,
  type PitchdeckDeliverable,
  type Employee,
} from '@/lib/db/schema';

// ===== Input Schemas =====

const createPitchdeckInputSchema = z.object({
  leadId: z.string(),
});

const getPitchdeckInputSchema = z.object({
  id: z.string(),
  includeDeliverables: z.boolean().default(true),
  includeTeamMembers: z.boolean().default(true),
});

const updatePitchdeckInputSchema = z.object({
  id: z.string(),
  status: z
    .enum(['draft', 'team_proposed', 'team_confirmed', 'in_progress', 'submitted'])
    .optional(),
  teamConfirmedAt: z.date().optional(),
  submittedAt: z.date().optional(),
});

const listPitchdecksInputSchema = z.object({
  leadId: z.string(),
});

const addDeliverableInputSchema = z.object({
  pitchdeckId: z.string(),
  deliverableName: z.string().min(1),
  internalDeadline: z.date().optional(),
  assignedToEmployeeId: z.string().optional(),
});

const updateDeliverableInputSchema = z.object({
  id: z.string(),
  status: z.enum(['open', 'in_progress', 'review', 'done']).optional(),
  assignedToEmployeeId: z.string().optional(),
  internalDeadline: z.date().optional(),
  outline: z.string().optional(),
  draft: z.string().optional(),
  talkingPoints: z.string().optional(),
  visualIdeas: z.string().optional(),
});

const addTeamMemberInputSchema = z.object({
  pitchdeckId: z.string(),
  employeeId: z.string(),
  role: z.enum(['pm', 'ux', 'frontend', 'backend', 'devops', 'qa']),
});

const removeTeamMemberInputSchema = z.object({
  id: z.string(),
});

const deletePitchdeckInputSchema = z.object({
  id: z.string(),
});

const deleteDeliverableInputSchema = z.object({
  id: z.string(),
});

// ===== Tool Implementations =====

// ===== CREATE =====

registry.register({
  name: 'pitchdeck.create',
  description: 'Create a new Pitchdeck for a Lead (status=draft)',
  category: 'pitchdeck',
  inputSchema: createPitchdeckInputSchema,
  async execute(input, context: ToolContext) {
    // Verify lead exists
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.leadId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only create pitchdecks for their own business unit
    if (context.userRole === 'bl' && lead.businessUnitId !== context.businessUnitId) {
      return { success: false, error: 'Access denied: Cannot create pitchdeck for other BU' };
    }

    // Check if pitchdeck already exists for this lead
    const [existing] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.qualificationId, input.leadId))
      .limit(1);

    if (existing) {
      return { success: false, error: 'Pitchdeck already exists for this lead' };
    }

    const [newPitchdeck] = await db
      .insert(pitchdecks)
      .values({
        qualificationId: input.leadId,
        status: 'draft',
      })
      .returning();

    return {
      success: true,
      data: newPitchdeck,
    };
  },
});

// ===== READ =====

registry.register({
  name: 'pitchdeck.get',
  description: 'Get a Pitchdeck with optional deliverables and team members',
  category: 'pitchdeck',
  inputSchema: getPitchdeckInputSchema,
  async execute(input, context: ToolContext) {
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, input.id))
      .limit(1);

    if (!pitchdeck) {
      return { success: false, error: 'Pitchdeck not found' };
    }

    // Get lead to check BU access
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, pitchdeck.qualificationId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Associated lead not found' };
    }

    // BL users can only see pitchdecks from their own BU
    if (context.userRole === 'bl' && lead.businessUnitId !== context.businessUnitId) {
      return { success: false, error: 'Access denied: Cannot view pitchdeck from other BU' };
    }

    let deliverables: PitchdeckDeliverable[] = [];
    let teamMembers: Array<{
      id: string;
      pitchdeckId: string;
      employeeId: string;
      role: string;
      employee: Employee | null;
    }> = [];

    if (input.includeDeliverables) {
      deliverables = await db
        .select()
        .from(pitchdeckDeliverables)
        .where(eq(pitchdeckDeliverables.pitchdeckId, input.id))
        .orderBy(desc(pitchdeckDeliverables.internalDeadline));
    }

    if (input.includeTeamMembers) {
      teamMembers = await db
        .select({
          id: pitchdeckTeamMembers.id,
          pitchdeckId: pitchdeckTeamMembers.pitchdeckId,
          employeeId: pitchdeckTeamMembers.employeeId,
          role: pitchdeckTeamMembers.role,
          employee: employees,
        })
        .from(pitchdeckTeamMembers)
        .leftJoin(employees, eq(pitchdeckTeamMembers.employeeId, employees.id))
        .where(eq(pitchdeckTeamMembers.pitchdeckId, input.id));
    }

    return {
      success: true,
      data: {
        ...pitchdeck,
        deliverables,
        teamMembers,
      },
    };
  },
});

registry.register({
  name: 'pitchdeck.list',
  description: 'List all Pitchdecks for a Lead',
  category: 'pitchdeck',
  inputSchema: listPitchdecksInputSchema,
  async execute(input, context: ToolContext) {
    // Get lead to check BU access
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.leadId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only see pitchdecks from their own BU
    if (context.userRole === 'bl' && lead.businessUnitId !== context.businessUnitId) {
      return { success: false, error: 'Access denied: Cannot list pitchdecks from other BU' };
    }

    const results = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.qualificationId, input.leadId))
      .orderBy(desc(pitchdecks.createdAt));

    return {
      success: true,
      data: results,
    };
  },
});

// ===== UPDATE =====

registry.register({
  name: 'pitchdeck.update',
  description: 'Update Pitchdeck status and timeline fields',
  category: 'pitchdeck',
  inputSchema: updatePitchdeckInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Pitchdeck not found' };
    }

    // Get lead to check BU access
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, existing.qualificationId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Associated lead not found' };
    }

    // BL users can only update pitchdecks from their own BU
    if (context.userRole === 'bl' && lead.businessUnitId !== context.businessUnitId) {
      return { success: false, error: 'Access denied: Cannot update pitchdeck from other BU' };
    }

    const { id: _id, ...updates } = input;

    const [updated] = await db
      .update(pitchdecks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(pitchdecks.id, input.id))
      .returning();

    return {
      success: true,
      data: updated,
    };
  },
});

// ===== DELIVERABLES =====

registry.register({
  name: 'pitchdeck.addDeliverable',
  description: 'Add a new Deliverable to a Pitchdeck',
  category: 'pitchdeck',
  inputSchema: addDeliverableInputSchema,
  async execute(input, context: ToolContext) {
    // Verify pitchdeck exists
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, input.pitchdeckId))
      .limit(1);

    if (!pitchdeck) {
      return { success: false, error: 'Pitchdeck not found' };
    }

    // Get lead to check BU access
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, pitchdeck.qualificationId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Associated lead not found' };
    }

    // BL users can only add deliverables to their own BU pitchdecks
    if (context.userRole === 'bl' && lead.businessUnitId !== context.businessUnitId) {
      return {
        success: false,
        error: 'Access denied: Cannot add deliverable to pitchdeck from other BU',
      };
    }

    const [newDeliverable] = await db
      .insert(pitchdeckDeliverables)
      .values({
        pitchdeckId: input.pitchdeckId,
        deliverableName: input.deliverableName,
        internalDeadline: input.internalDeadline,
        assignedToEmployeeId: input.assignedToEmployeeId,
        status: 'open',
      })
      .returning();

    return {
      success: true,
      data: newDeliverable,
    };
  },
});

registry.register({
  name: 'pitchdeck.updateDeliverable',
  description: 'Update a Pitchdeck Deliverable (status, assignment, drafts, etc.)',
  category: 'pitchdeck',
  inputSchema: updateDeliverableInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(pitchdeckDeliverables)
      .where(eq(pitchdeckDeliverables.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Deliverable not found' };
    }

    // Get pitchdeck and lead to check BU access
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, existing.pitchdeckId))
      .limit(1);

    if (!pitchdeck) {
      return { success: false, error: 'Associated pitchdeck not found' };
    }

    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, pitchdeck.qualificationId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Associated lead not found' };
    }

    // BL users can only update deliverables from their own BU
    if (context.userRole === 'bl' && lead.businessUnitId !== context.businessUnitId) {
      return {
        success: false,
        error: 'Access denied: Cannot update deliverable from other BU',
      };
    }

    const { id: _id, ...updates } = input;

    const [updated] = await db
      .update(pitchdeckDeliverables)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(pitchdeckDeliverables.id, input.id))
      .returning();

    return {
      success: true,
      data: updated,
    };
  },
});

// ===== TEAM MEMBERS =====

registry.register({
  name: 'pitchdeck.addTeamMember',
  description: 'Add a team member to a Pitchdeck',
  category: 'pitchdeck',
  inputSchema: addTeamMemberInputSchema,
  async execute(input, context: ToolContext) {
    // Verify pitchdeck exists
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, input.pitchdeckId))
      .limit(1);

    if (!pitchdeck) {
      return { success: false, error: 'Pitchdeck not found' };
    }

    // Verify employee exists
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .limit(1);

    if (!employee) {
      return { success: false, error: 'Employee not found' };
    }

    // Get lead to check BU access
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, pitchdeck.qualificationId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Associated lead not found' };
    }

    // BL users can only add team members to their own BU pitchdecks
    if (context.userRole === 'bl' && lead.businessUnitId !== context.businessUnitId) {
      return {
        success: false,
        error: 'Access denied: Cannot add team member to pitchdeck from other BU',
      };
    }

    // Check if team member already exists
    const [existing] = await db
      .select()
      .from(pitchdeckTeamMembers)
      .where(
        eq(pitchdeckTeamMembers.pitchdeckId, input.pitchdeckId) &&
          eq(pitchdeckTeamMembers.employeeId, input.employeeId)
      )
      .limit(1);

    if (existing) {
      return {
        success: false,
        error: 'Team member already assigned to this pitchdeck',
      };
    }

    const [newTeamMember] = await db
      .insert(pitchdeckTeamMembers)
      .values({
        pitchdeckId: input.pitchdeckId,
        employeeId: input.employeeId,
        role: input.role,
      })
      .returning();

    return {
      success: true,
      data: newTeamMember,
    };
  },
});

registry.register({
  name: 'pitchdeck.removeTeamMember',
  description: 'Remove a team member from a Pitchdeck',
  category: 'pitchdeck',
  inputSchema: removeTeamMemberInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(pitchdeckTeamMembers)
      .where(eq(pitchdeckTeamMembers.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Team member not found' };
    }

    // Get pitchdeck and lead to check BU access
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, existing.pitchdeckId))
      .limit(1);

    if (!pitchdeck) {
      return { success: false, error: 'Associated pitchdeck not found' };
    }

    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, pitchdeck.qualificationId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Associated lead not found' };
    }

    // BL users can only remove team members from their own BU
    if (context.userRole === 'bl' && lead.businessUnitId !== context.businessUnitId) {
      return {
        success: false,
        error: 'Access denied: Cannot remove team member from pitchdeck from other BU',
      };
    }

    await db.delete(pitchdeckTeamMembers).where(eq(pitchdeckTeamMembers.id, input.id));

    return {
      success: true,
      message: 'Team member removed successfully',
      deletedId: input.id,
    };
  },
});

// ===== DELETE =====

registry.register({
  name: 'pitchdeck.delete',
  description: 'Delete a Pitchdeck (hard delete - cascades to deliverables)',
  category: 'pitchdeck',
  inputSchema: deletePitchdeckInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete pitchdecks
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete pitchdecks' };
    }

    const [existing] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Pitchdeck not found' };
    }

    await db.delete(pitchdecks).where(eq(pitchdecks.id, input.id));

    return {
      success: true,
      message: 'Pitchdeck deleted successfully',
      deletedId: input.id,
    };
  },
});

registry.register({
  name: 'pitchdeck.deleteDeliverable',
  description: 'Delete a Pitchdeck Deliverable (hard delete)',
  category: 'pitchdeck',
  inputSchema: deleteDeliverableInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete deliverables
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete deliverables' };
    }

    const [existing] = await db
      .select()
      .from(pitchdeckDeliverables)
      .where(eq(pitchdeckDeliverables.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Pitchdeck Deliverable not found' };
    }

    await db.delete(pitchdeckDeliverables).where(eq(pitchdeckDeliverables.id, input.id));

    return {
      success: true,
      message: 'Pitchdeck Deliverable deleted successfully',
      deletedId: input.id,
    };
  },
});
