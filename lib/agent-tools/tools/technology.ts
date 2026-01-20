import { z } from 'zod';
import { db } from '@/lib/db';
import { technologies, businessUnits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { registry } from '../registry';
import type { ToolContext } from '../types';

const listTechnologiesInputSchema = z.object({
  businessUnitId: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'technology.list',
  description: 'List all technologies, optionally filtered by business unit',
  category: 'technology',
  inputSchema: listTechnologiesInputSchema,
  async execute(input, _context: ToolContext) {
    let results;
    if (input.businessUnitId) {
      results = await db.select().from(technologies)
        .where(eq(technologies.businessUnitId, input.businessUnitId))
        .orderBy(desc(technologies.createdAt))
        .limit(input.limit);
    } else {
      results = await db.select().from(technologies)
        .orderBy(desc(technologies.createdAt))
        .limit(input.limit);
    }
    
    return { success: true, data: results };
  },
});

const getTechnologyInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'technology.get',
  description: 'Get a single technology by ID with full metadata',
  category: 'technology',
  inputSchema: getTechnologyInputSchema,
  async execute(input, _context: ToolContext) {
    const [technology] = await db.select().from(technologies)
      .where(eq(technologies.id, input.id))
      .limit(1);
    
    if (!technology) {
      return { success: false, error: 'Technology not found' };
    }
    
    return { success: true, data: technology };
  },
});

const createTechnologyInputSchema = z.object({
  name: z.string().min(1),
  businessUnitId: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  license: z.string().optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  usps: z.array(z.string()).optional(),
  useCases: z.array(z.string()).optional(),
});

registry.register({
  name: 'technology.create',
  description: 'Create a new technology entry',
  category: 'technology',
  inputSchema: createTechnologyInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Technologien erstellen' };
    }
    
    const [bu] = await db.select().from(businessUnits)
      .where(eq(businessUnits.id, input.businessUnitId))
      .limit(1);
    
    if (!bu) {
      return { success: false, error: 'Business Unit not found' };
    }
    
    const [technology] = await db.insert(technologies).values({
      name: input.name,
      businessUnitId: input.businessUnitId,
      category: input.category,
      description: input.description,
      websiteUrl: input.websiteUrl,
      githubUrl: input.githubUrl,
      license: input.license,
      pros: input.pros ? JSON.stringify(input.pros) : null,
      cons: input.cons ? JSON.stringify(input.cons) : null,
      usps: input.usps ? JSON.stringify(input.usps) : null,
      useCases: input.useCases ? JSON.stringify(input.useCases) : null,
    }).returning();
    
    return { success: true, data: technology };
  },
});

const updateTechnologyInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  license: z.string().optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  usps: z.array(z.string()).optional(),
  useCases: z.array(z.string()).optional(),
});

registry.register({
  name: 'technology.update',
  description: 'Update an existing technology',
  category: 'technology',
  inputSchema: updateTechnologyInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Technologien bearbeiten' };
    }
    
    const [existing] = await db.select().from(technologies)
      .where(eq(technologies.id, input.id))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: 'Technology not found' };
    }
    
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.websiteUrl !== undefined) updateData.websiteUrl = input.websiteUrl;
    if (input.githubUrl !== undefined) updateData.githubUrl = input.githubUrl;
    if (input.license !== undefined) updateData.license = input.license;
    if (input.pros) updateData.pros = JSON.stringify(input.pros);
    if (input.cons) updateData.cons = JSON.stringify(input.cons);
    if (input.usps) updateData.usps = JSON.stringify(input.usps);
    if (input.useCases) updateData.useCases = JSON.stringify(input.useCases);
    
    const [updated] = await db.update(technologies)
      .set(updateData)
      .where(eq(technologies.id, input.id))
      .returning();
    
    return { success: true, data: updated };
  },
});

const deleteTechnologyInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'technology.delete',
  description: 'Delete a technology',
  category: 'technology',
  inputSchema: deleteTechnologyInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Technologien löschen' };
    }
    
    const [existing] = await db.select().from(technologies)
      .where(eq(technologies.id, input.id))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: 'Technology not found' };
    }
    
    await db.delete(technologies).where(eq(technologies.id, input.id));
    
    return { success: true, data: { id: input.id, deleted: true } };
  },
});
