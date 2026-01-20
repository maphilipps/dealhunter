import { z } from 'zod';
import { db } from '@/lib/db';
import { competencies } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { registry } from '../registry';
import type { ToolContext } from '../types';

const listCompetenciesInputSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  category: z.enum(['technology', 'methodology', 'industry', 'soft_skill']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'competency.list',
  description: 'List all competencies, optionally filtered by status or category',
  category: 'competency',
  inputSchema: listCompetenciesInputSchema,
  async execute(input, _context: ToolContext) {
    let query = db.select().from(competencies);
    
    if (input.status && input.category) {
      const results = await db.select().from(competencies)
        .where(eq(competencies.status, input.status))
        .orderBy(desc(competencies.createdAt))
        .limit(input.limit);
      return { success: true, data: results.filter(c => c.category === input.category) };
    } else if (input.status) {
      const results = await db.select().from(competencies)
        .where(eq(competencies.status, input.status))
        .orderBy(desc(competencies.createdAt))
        .limit(input.limit);
      return { success: true, data: results };
    } else if (input.category) {
      const results = await db.select().from(competencies)
        .where(eq(competencies.category, input.category))
        .orderBy(desc(competencies.createdAt))
        .limit(input.limit);
      return { success: true, data: results };
    }
    
    const results = await query.orderBy(desc(competencies.createdAt)).limit(input.limit);
    return { success: true, data: results };
  },
});

const getCompetencyInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'competency.get',
  description: 'Get a single competency by ID',
  category: 'competency',
  inputSchema: getCompetencyInputSchema,
  async execute(input, _context: ToolContext) {
    const [competency] = await db.select().from(competencies)
      .where(eq(competencies.id, input.id))
      .limit(1);
    
    if (!competency) {
      return { success: false, error: 'Competency not found' };
    }
    
    return { success: true, data: competency };
  },
});

const createCompetencyInputSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['technology', 'methodology', 'industry', 'soft_skill']),
  level: z.enum(['basic', 'advanced', 'expert']),
  certifications: z.array(z.string()).optional(),
  description: z.string().optional(),
});

registry.register({
  name: 'competency.create',
  description: 'Create a new competency',
  category: 'competency',
  inputSchema: createCompetencyInputSchema,
  async execute(input, context: ToolContext) {
    const [competency] = await db.insert(competencies).values({
      userId: context.userId,
      name: input.name,
      category: input.category,
      level: input.level,
      certifications: input.certifications ? JSON.stringify(input.certifications) : null,
      description: input.description,
      status: 'pending',
      isValidated: false,
    }).returning();
    
    return { success: true, data: competency };
  },
});

const updateCompetencyInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  category: z.enum(['technology', 'methodology', 'industry', 'soft_skill']).optional(),
  level: z.enum(['basic', 'advanced', 'expert']).optional(),
  certifications: z.array(z.string()).optional(),
  description: z.string().optional(),
});

registry.register({
  name: 'competency.update',
  description: 'Update an existing competency',
  category: 'competency',
  inputSchema: updateCompetencyInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db.select().from(competencies)
      .where(eq(competencies.id, input.id))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: 'Competency not found' };
    }
    
    if (existing.userId !== context.userId && context.userRole !== 'admin') {
      return { success: false, error: 'No access to this competency' };
    }
    
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name) updateData.name = input.name;
    if (input.category) updateData.category = input.category;
    if (input.level) updateData.level = input.level;
    if (input.certifications) updateData.certifications = JSON.stringify(input.certifications);
    if (input.description !== undefined) updateData.description = input.description;
    
    const [updated] = await db.update(competencies)
      .set(updateData)
      .where(eq(competencies.id, input.id))
      .returning();
    
    return { success: true, data: updated };
  },
});

const deleteCompetencyInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'competency.delete',
  description: 'Delete a competency',
  category: 'competency',
  inputSchema: deleteCompetencyInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db.select().from(competencies)
      .where(eq(competencies.id, input.id))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: 'Competency not found' };
    }
    
    if (existing.userId !== context.userId && context.userRole !== 'admin') {
      return { success: false, error: 'No access to this competency' };
    }
    
    await db.delete(competencies).where(eq(competencies.id, input.id));
    
    return { success: true, data: { id: input.id, deleted: true } };
  },
});
