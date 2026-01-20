import { z } from 'zod';
import { db } from '@/lib/db';
import { businessUnits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { registry } from '../registry';
import type { ToolContext } from '../types';

const listBusinessUnitsInputSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'businessUnit.list',
  description: 'List all business units',
  category: 'business-unit',
  inputSchema: listBusinessUnitsInputSchema,
  async execute(input, _context: ToolContext) {
    const results = await db.select().from(businessUnits)
      .orderBy(desc(businessUnits.createdAt))
      .limit(input.limit);
    
    return { success: true, data: results };
  },
});

const getBusinessUnitInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'businessUnit.get',
  description: 'Get a single business unit by ID',
  category: 'business-unit',
  inputSchema: getBusinessUnitInputSchema,
  async execute(input, _context: ToolContext) {
    const [bu] = await db.select().from(businessUnits)
      .where(eq(businessUnits.id, input.id))
      .limit(1);
    
    if (!bu) {
      return { success: false, error: 'Business Unit not found' };
    }
    
    return { success: true, data: bu };
  },
});

const createBusinessUnitInputSchema = z.object({
  name: z.string().min(1),
  leaderName: z.string().min(1),
  leaderEmail: z.string().email(),
  keywords: z.array(z.string()),
});

registry.register({
  name: 'businessUnit.create',
  description: 'Create a new business unit',
  category: 'business-unit',
  inputSchema: createBusinessUnitInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Business Units erstellen' };
    }
    
    const [bu] = await db.insert(businessUnits).values({
      name: input.name,
      leaderName: input.leaderName,
      leaderEmail: input.leaderEmail,
      keywords: JSON.stringify(input.keywords),
    }).returning();
    
    return { success: true, data: bu };
  },
});

const updateBusinessUnitInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  leaderName: z.string().min(1).optional(),
  leaderEmail: z.string().email().optional(),
  keywords: z.array(z.string()).optional(),
});

registry.register({
  name: 'businessUnit.update',
  description: 'Update an existing business unit',
  category: 'business-unit',
  inputSchema: updateBusinessUnitInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Business Units bearbeiten' };
    }
    
    const [existing] = await db.select().from(businessUnits)
      .where(eq(businessUnits.id, input.id))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: 'Business Unit not found' };
    }
    
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name) updateData.name = input.name;
    if (input.leaderName) updateData.leaderName = input.leaderName;
    if (input.leaderEmail) updateData.leaderEmail = input.leaderEmail;
    if (input.keywords) updateData.keywords = JSON.stringify(input.keywords);
    
    const [updated] = await db.update(businessUnits)
      .set(updateData)
      .where(eq(businessUnits.id, input.id))
      .returning();
    
    return { success: true, data: updated };
  },
});

const deleteBusinessUnitInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'businessUnit.delete',
  description: 'Delete a business unit',
  category: 'business-unit',
  inputSchema: deleteBusinessUnitInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Business Units löschen' };
    }
    
    const [existing] = await db.select().from(businessUnits)
      .where(eq(businessUnits.id, input.id))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: 'Business Unit not found' };
    }
    
    await db.delete(businessUnits).where(eq(businessUnits.id, input.id));
    
    return { success: true, data: { id: input.id, deleted: true } };
  },
});
