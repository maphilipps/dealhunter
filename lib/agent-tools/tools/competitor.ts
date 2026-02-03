import { eq, desc, and, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { competitors } from '@/lib/db/schema';

// ============================================================================
// competitor.list - List competitors with optional filters
// ============================================================================

const listCompetitorsInputSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  isValidated: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'competitor.list',
  description: 'List competitors, optionally filtered by validation status or search query',
  category: 'competitor',
  inputSchema: listCompetitorsInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    if (input.status) {
      conditions.push(eq(competitors.status, input.status));
    }

    if (input.isValidated !== undefined) {
      conditions.push(eq(competitors.isValidated, input.isValidated));
    }

    if (input.search) {
      conditions.push(
        or(
          ilike(competitors.companyName, `%${input.search}%`),
          ilike(competitors.description, `%${input.search}%`)
        )
      );
    }

    // Non-admin users can only see validated competitors or their own
    if (context.userRole !== 'admin') {
      conditions.push(
        or(eq(competitors.isValidated, true), eq(competitors.userId, context.userId))
      );
    }

    const results = await db
      .select()
      .from(competitors)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(competitors.createdAt))
      .limit(input.limit);

    return { success: true, data: results };
  },
});

// ============================================================================
// competitor.get - Get a single competitor by ID
// ============================================================================

const getCompetitorInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'competitor.get',
  description: 'Get a single competitor by ID',
  category: 'competitor',
  inputSchema: getCompetitorInputSchema,
  async execute(input, context: ToolContext) {
    const [competitor] = await db
      .select()
      .from(competitors)
      .where(eq(competitors.id, input.id))
      .limit(1);

    if (!competitor) {
      return { success: false, error: 'Competitor not found' };
    }

    // Non-admin users can only see validated competitors or their own
    if (
      context.userRole !== 'admin' &&
      !competitor.isValidated &&
      competitor.userId !== context.userId
    ) {
      return { success: false, error: 'No access to this competitor' };
    }

    return { success: true, data: competitor };
  },
});

// ============================================================================
// competitor.create - Create a new competitor
// ============================================================================

const createCompetitorInputSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().url().optional(),
  industry: z.array(z.string()).optional(),
  description: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  typicalMarkets: z.array(z.string()).optional(),
  encounterNotes: z.array(z.string()).optional(),
});

registry.register({
  name: 'competitor.create',
  description:
    'Create a new competitor in the intelligence database (starts as pending validation)',
  category: 'competitor',
  inputSchema: createCompetitorInputSchema,
  async execute(input, context: ToolContext) {
    const [competitor] = await db
      .insert(competitors)
      .values({
        userId: context.userId,
        companyName: input.companyName,
        website: input.website,
        industry: input.industry ? JSON.stringify(input.industry) : null,
        description: input.description,
        strengths: input.strengths ? JSON.stringify(input.strengths) : null,
        weaknesses: input.weaknesses ? JSON.stringify(input.weaknesses) : null,
        typicalMarkets: input.typicalMarkets ? JSON.stringify(input.typicalMarkets) : null,
        encounterNotes: input.encounterNotes ? JSON.stringify(input.encounterNotes) : null,
        status: 'pending',
        isValidated: false,
      })
      .returning();

    return { success: true, data: competitor };
  },
});

// ============================================================================
// competitor.update - Update an existing competitor
// ============================================================================

const updateCompetitorInputSchema = z.object({
  id: z.string(),
  companyName: z.string().min(1).optional(),
  website: z.string().url().optional(),
  industry: z.array(z.string()).optional(),
  description: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  typicalMarkets: z.array(z.string()).optional(),
  encounterNotes: z.array(z.string()).optional(),
});

registry.register({
  name: 'competitor.update',
  description: 'Update an existing competitor',
  category: 'competitor',
  inputSchema: updateCompetitorInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(competitors)
      .where(eq(competitors.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Competitor not found' };
    }

    if (existing.userId !== context.userId && context.userRole !== 'admin') {
      return { success: false, error: 'No access to this competitor' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.companyName) updateData.companyName = input.companyName;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.industry) updateData.industry = JSON.stringify(input.industry);
    if (input.description !== undefined) updateData.description = input.description;
    if (input.strengths) updateData.strengths = JSON.stringify(input.strengths);
    if (input.weaknesses) updateData.weaknesses = JSON.stringify(input.weaknesses);
    if (input.typicalMarkets) updateData.typicalMarkets = JSON.stringify(input.typicalMarkets);
    if (input.encounterNotes) updateData.encounterNotes = JSON.stringify(input.encounterNotes);

    const [updated] = await db
      .update(competitors)
      .set(updateData)
      .where(eq(competitors.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

// ============================================================================
// competitor.delete - Delete a competitor
// ============================================================================

const deleteCompetitorInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'competitor.delete',
  description: 'Delete a competitor from the database',
  category: 'competitor',
  inputSchema: deleteCompetitorInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(competitors)
      .where(eq(competitors.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Competitor not found' };
    }

    if (existing.userId !== context.userId && context.userRole !== 'admin') {
      return { success: false, error: 'No access to this competitor' };
    }

    await db.delete(competitors).where(eq(competitors.id, input.id));

    return { success: true, data: { id: input.id, deleted: true } };
  },
});

// ============================================================================
// competitor.search - Search validated competitors for matching
// ============================================================================

const searchCompetitorsInputSchema = z.object({
  query: z.string().min(1),
  industries: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(20),
});

registry.register({
  name: 'competitor.search',
  description: 'Search validated competitors by name or industry for competitive analysis',
  category: 'competitor',
  inputSchema: searchCompetitorsInputSchema,
  async execute(input, _context: ToolContext) {
    // Only search validated competitors
    const results = await db
      .select()
      .from(competitors)
      .where(
        and(
          eq(competitors.isValidated, true),
          or(
            ilike(competitors.companyName, `%${input.query}%`),
            ilike(competitors.description, `%${input.query}%`)
          )
        )
      )
      .orderBy(desc(competitors.createdAt))
      .limit(input.limit);

    // If industries filter provided, do post-filter (JSON array stored as text)
    let filtered = results;
    if (input.industries && input.industries.length > 0) {
      filtered = results.filter(c => {
        if (!c.industry) return false;
        try {
          const industries = JSON.parse(c.industry) as string[];
          return input.industries!.some(ind =>
            industries.some(ci => ci.toLowerCase().includes(ind.toLowerCase()))
          );
        } catch {
          return false;
        }
      });
    }

    return { success: true, data: filtered };
  },
});

// ============================================================================
// competitor.addEncounter - Add encounter note to competitor
// ============================================================================

const addEncounterInputSchema = z.object({
  id: z.string(),
  note: z.string().min(1),
});

registry.register({
  name: 'competitor.addEncounter',
  description: 'Add an encounter note to a competitor (e.g., seen in bid, project history)',
  category: 'competitor',
  inputSchema: addEncounterInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(competitors)
      .where(eq(competitors.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Competitor not found' };
    }

    // Parse existing notes or start fresh
    let notes: string[] = [];
    if (existing.encounterNotes) {
      try {
        notes = JSON.parse(existing.encounterNotes) as string[];
      } catch {
        notes = [];
      }
    }

    // Add timestamped note
    const timestamp = new Date().toISOString().split('T')[0];
    notes.push(`[${timestamp}] ${input.note}`);

    const [updated] = await db
      .update(competitors)
      .set({
        encounterNotes: JSON.stringify(notes),
        updatedAt: new Date(),
      })
      .where(eq(competitors.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});
