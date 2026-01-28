import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { businessUnits, technologies } from '@/lib/db/schema';

const listBusinessUnitsInputSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'businessUnit.list',
  description: 'List all business units',
  category: 'business-unit',
  inputSchema: listBusinessUnitsInputSchema,
  async execute(input, _context: ToolContext) {
    const results = await db
      .select()
      .from(businessUnits)
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
    const [bu] = await db
      .select()
      .from(businessUnits)
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

    const [bu] = await db
      .insert(businessUnits)
      .values({
        name: input.name,
        leaderName: input.leaderName,
        leaderEmail: input.leaderEmail,
        keywords: JSON.stringify(input.keywords),
      })
      .returning();

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

    const [existing] = await db
      .select()
      .from(businessUnits)
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

    const [updated] = await db
      .update(businessUnits)
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

    const [existing] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Business Unit not found' };
    }

    await db.delete(businessUnits).where(eq(businessUnits.id, input.id));

    return { success: true, data: { id: input.id, deleted: true } };
  },
});

// === NEW: List BU Capabilities with Technology Features ===

const listCapabilitiesInputSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
});

interface TechnologyCapability {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  features: Record<string, { supported: boolean; score: number; notes?: string }> | null;
  pros: string[] | null;
  cons: string[] | null;
  useCases: string[] | null;
}

interface BusinessUnitCapability {
  id: string;
  name: string;
  leaderName: string;
  keywords: string[];
  technologies: TechnologyCapability[];
}

registry.register({
  name: 'businessUnit.listCapabilities',
  description:
    'List all business units with their capabilities including keywords and technology features. Use this to understand what each BU specializes in for routing decisions.',
  category: 'business-unit',
  inputSchema: listCapabilitiesInputSchema,
  async execute(input, _context: ToolContext) {
    // Get all BUs with their technologies
    const allBUs = await db
      .select({
        buId: businessUnits.id,
        buName: businessUnits.name,
        buLeaderName: businessUnits.leaderName,
        buKeywords: businessUnits.keywords,
        techId: technologies.id,
        techName: technologies.name,
        techCategory: technologies.category,
        techDescription: technologies.description,
        techFeatures: technologies.features,
        techPros: technologies.pros,
        techCons: technologies.cons,
        techUseCases: technologies.useCases,
      })
      .from(businessUnits)
      .leftJoin(technologies, eq(technologies.businessUnitId, businessUnits.id))
      .orderBy(desc(businessUnits.createdAt))
      .limit(input.limit * 10); // Account for join multiplication

    // Group by BU
    const buMap = new Map<string, BusinessUnitCapability>();

    for (const row of allBUs) {
      if (!buMap.has(row.buId)) {
        let keywords: string[] = [];
        try {
          keywords = JSON.parse(row.buKeywords || '[]') as string[];
        } catch {
          keywords = [];
        }

        buMap.set(row.buId, {
          id: row.buId,
          name: row.buName,
          leaderName: row.buLeaderName,
          keywords,
          technologies: [],
        });
      }

      // Add technology if exists
      if (row.techId && row.techName) {
        const bu = buMap.get(row.buId)!;

        // Parse JSON fields
        let features: TechnologyCapability['features'] = null;
        let pros: string[] | null = null;
        let cons: string[] | null = null;
        let useCases: string[] | null = null;

        try {
          if (row.techFeatures) features = JSON.parse(row.techFeatures);
        } catch {
          /* ignore */
        }
        try {
          if (row.techPros) pros = JSON.parse(row.techPros);
        } catch {
          /* ignore */
        }
        try {
          if (row.techCons) cons = JSON.parse(row.techCons);
        } catch {
          /* ignore */
        }
        try {
          if (row.techUseCases) useCases = JSON.parse(row.techUseCases);
        } catch {
          /* ignore */
        }

        bu.technologies.push({
          id: row.techId,
          name: row.techName,
          category: row.techCategory,
          description: row.techDescription,
          features,
          pros,
          cons,
          useCases,
        });
      }
    }

    const results = Array.from(buMap.values()).slice(0, input.limit);

    return { success: true, data: results };
  },
});
