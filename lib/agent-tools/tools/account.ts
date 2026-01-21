import { z } from 'zod';
import { db } from '@/lib/db';
import { accounts, rfps } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { registry } from '../registry';
import type { ToolContext } from '../types';

const listAccountsInputSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'account.list',
  description: 'List all accounts for the current user',
  category: 'account',
  inputSchema: listAccountsInputSchema,
  async execute(input, context: ToolContext) {
    const results = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, context.userId))
      .orderBy(desc(accounts.createdAt))
      .limit(input.limit);

    return { success: true, data: results };
  },
});

const getAccountInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'account.get',
  description: 'Get a single account by ID with its linked opportunities',
  category: 'account',
  inputSchema: getAccountInputSchema,
  async execute(input, context: ToolContext) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, input.id)).limit(1);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    if (account.userId !== context.userId) {
      return { success: false, error: 'No access to this account' };
    }

    const opportunities = await db
      .select({
        id: rfps.id,
        status: rfps.status,
        source: rfps.source,
        stage: rfps.stage,
        decision: rfps.decision,
        createdAt: rfps.createdAt,
      })
      .from(rfps)
      .where(eq(rfps.accountId, input.id))
      .orderBy(desc(rfps.createdAt));

    return { success: true, data: { account, opportunities } };
  },
});

const createAccountInputSchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  website: z.string().optional(),
  notes: z.string().optional(),
});

registry.register({
  name: 'account.create',
  description: 'Create a new account',
  category: 'account',
  inputSchema: createAccountInputSchema,
  async execute(input, context: ToolContext) {
    const [account] = await db
      .insert(accounts)
      .values({
        userId: context.userId,
        name: input.name,
        industry: input.industry,
        website: input.website,
        notes: input.notes,
      })
      .returning();

    return { success: true, data: account };
  },
});

const updateAccountInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

registry.register({
  name: 'account.update',
  description: 'Update an existing account',
  category: 'account',
  inputSchema: updateAccountInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db.select().from(accounts).where(eq(accounts.id, input.id)).limit(1);

    if (!existing) {
      return { success: false, error: 'Account not found' };
    }

    if (existing.userId !== context.userId) {
      return { success: false, error: 'No access to this account' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name) updateData.name = input.name;
    if (input.industry) updateData.industry = input.industry;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const [updated] = await db
      .update(accounts)
      .set(updateData)
      .where(eq(accounts.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

const deleteAccountInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'account.delete',
  description: 'Delete an account',
  category: 'account',
  inputSchema: deleteAccountInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db.select().from(accounts).where(eq(accounts.id, input.id)).limit(1);

    if (!existing) {
      return { success: false, error: 'Account not found' };
    }

    if (existing.userId !== context.userId) {
      return { success: false, error: 'No access to this account' };
    }

    await db.delete(accounts).where(eq(accounts.id, input.id));

    return { success: true, data: { id: input.id, deleted: true } };
  },
});
