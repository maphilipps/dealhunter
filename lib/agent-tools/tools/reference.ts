import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { references } from '@/lib/db/schema';

const listReferencesInputSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'reference.list',
  description: 'List all references, optionally filtered by validation status',
  category: 'reference',
  inputSchema: listReferencesInputSchema,
  async execute(input, _context: ToolContext) {
    let results;
    if (input.status) {
      results = await db
        .select()
        .from(references)
        .where(eq(references.status, input.status))
        .orderBy(desc(references.createdAt))
        .limit(input.limit);
    } else {
      results = await db
        .select()
        .from(references)
        .orderBy(desc(references.createdAt))
        .limit(input.limit);
    }

    return { success: true, data: results };
  },
});

const getReferenceInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'reference.get',
  description: 'Get a single reference by ID',
  category: 'reference',
  inputSchema: getReferenceInputSchema,
  async execute(input, _context: ToolContext) {
    const [reference] = await db
      .select()
      .from(references)
      .where(eq(references.id, input.id))
      .limit(1);

    if (!reference) {
      return { success: false, error: 'Reference not found' };
    }

    return { success: true, data: reference };
  },
});

const createReferenceInputSchema = z.object({
  projectName: z.string().min(1),
  customerName: z.string().min(1),
  industry: z.string().min(1),
  technologies: z.array(z.string()),
  scope: z.string().min(1),
  teamSize: z.number().min(1),
  durationMonths: z.number().min(1),
  budgetRange: z.string().min(1),
  outcome: z.string().min(1),
  highlights: z.array(z.string()).optional(),
});

registry.register({
  name: 'reference.create',
  description: 'Create a new reference project',
  category: 'reference',
  inputSchema: createReferenceInputSchema,
  async execute(input, context: ToolContext) {
    const [reference] = await db
      .insert(references)
      .values({
        userId: context.userId,
        projectName: input.projectName,
        customerName: input.customerName,
        industry: input.industry,
        technologies: JSON.stringify(input.technologies),
        scope: input.scope,
        teamSize: input.teamSize,
        durationMonths: input.durationMonths,
        budgetRange: input.budgetRange,
        outcome: input.outcome,
        highlights: input.highlights ? JSON.stringify(input.highlights) : null,
        status: 'pending',
        isValidated: false,
      })
      .returning();

    return { success: true, data: reference };
  },
});

const updateReferenceInputSchema = z.object({
  id: z.string(),
  projectName: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  technologies: z.array(z.string()).optional(),
  scope: z.string().min(1).optional(),
  teamSize: z.number().min(1).optional(),
  durationMonths: z.number().min(1).optional(),
  budgetRange: z.string().min(1).optional(),
  outcome: z.string().min(1).optional(),
  highlights: z.array(z.string()).optional(),
});

registry.register({
  name: 'reference.update',
  description: 'Update an existing reference',
  category: 'reference',
  inputSchema: updateReferenceInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(references)
      .where(eq(references.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Reference not found' };
    }

    if (existing.userId !== context.userId && context.userRole !== 'admin') {
      return { success: false, error: 'No access to this reference' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.projectName) updateData.projectName = input.projectName;
    if (input.customerName) updateData.customerName = input.customerName;
    if (input.industry) updateData.industry = input.industry;
    if (input.technologies) updateData.technologies = JSON.stringify(input.technologies);
    if (input.scope) updateData.scope = input.scope;
    if (input.teamSize) updateData.teamSize = input.teamSize;
    if (input.durationMonths) updateData.durationMonths = input.durationMonths;
    if (input.budgetRange) updateData.budgetRange = input.budgetRange;
    if (input.outcome) updateData.outcome = input.outcome;
    if (input.highlights) updateData.highlights = JSON.stringify(input.highlights);

    const [updated] = await db
      .update(references)
      .set(updateData)
      .where(eq(references.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

const deleteReferenceInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'reference.delete',
  description: 'Delete a reference',
  category: 'reference',
  inputSchema: deleteReferenceInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(references)
      .where(eq(references.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Reference not found' };
    }

    if (existing.userId !== context.userId && context.userRole !== 'admin') {
      return { success: false, error: 'No access to this reference' };
    }

    await db.delete(references).where(eq(references.id, input.id));

    return { success: true, data: { id: input.id, deleted: true } };
  },
});
