import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { websiteAudits } from '@/lib/db/schema';

// ===== Input Schemas =====

const updateAuditInputSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  homepage: z.any().optional(), // JSON
  cms: z.string().optional(),
  cmsVersion: z.string().optional(),
  framework: z.string().optional(),
  hosting: z.string().optional(),
  server: z.string().optional(),
  techStack: z.any().optional(), // JSON
  performanceScore: z.number().min(0).max(100).optional(),
  lcp: z.number().optional(),
  fid: z.number().optional(),
  cls: z.string().optional(),
  ttfb: z.number().optional(),
  performanceBottlenecks: z.array(z.any()).optional(), // JSON array
  accessibilityScore: z.number().min(0).max(100).optional(),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).optional(),
  a11yViolations: z.any().optional(), // JSON
});

const deleteAuditInputSchema = z.object({
  id: z.string(),
});

// ===== Tool Implementations =====

registry.register({
  name: 'pitchScan.update_result',
  description: 'Update a Website Audit with new status, performance, or accessibility data',
  category: 'pitch-scan',
  inputSchema: updateAuditInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can update audits
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot update audits' };
    }

    const [existing] = await db
      .select()
      .from(websiteAudits)
      .where(eq(websiteAudits.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Website Audit not found' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.status !== undefined) updateData.status = input.status;
    if (input.homepage !== undefined) updateData.homepage = JSON.stringify(input.homepage);
    if (input.cms !== undefined) updateData.cms = input.cms;
    if (input.cmsVersion !== undefined) updateData.cmsVersion = input.cmsVersion;
    if (input.framework !== undefined) updateData.framework = input.framework;
    if (input.hosting !== undefined) updateData.hosting = input.hosting;
    if (input.server !== undefined) updateData.server = input.server;
    if (input.techStack !== undefined) updateData.techStack = JSON.stringify(input.techStack);
    if (input.performanceScore !== undefined) updateData.performanceScore = input.performanceScore;
    if (input.lcp !== undefined) updateData.lcp = input.lcp;
    if (input.fid !== undefined) updateData.fid = input.fid;
    if (input.cls !== undefined) updateData.cls = input.cls;
    if (input.ttfb !== undefined) updateData.ttfb = input.ttfb;
    if (input.performanceBottlenecks !== undefined)
      updateData.performanceBottlenecks = JSON.stringify(input.performanceBottlenecks);
    if (input.accessibilityScore !== undefined)
      updateData.accessibilityScore = input.accessibilityScore;
    if (input.wcagLevel !== undefined) updateData.wcagLevel = input.wcagLevel;
    if (input.a11yViolations !== undefined)
      updateData.a11yViolations = JSON.stringify(input.a11yViolations);

    const [updated] = await db
      .update(websiteAudits)
      .set(updateData)
      .where(eq(websiteAudits.id, input.id))
      .returning();

    return {
      success: true,
      data: updated,
      message: 'Website Audit updated successfully',
    };
  },
});

registry.register({
  name: 'pitchScan.delete_result',
  description: 'Delete a Website Audit (hard delete)',
  category: 'pitch-scan',
  inputSchema: deleteAuditInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete audits
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete audits' };
    }

    const [existing] = await db
      .select()
      .from(websiteAudits)
      .where(eq(websiteAudits.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Website Audit not found' };
    }

    await db.delete(websiteAudits).where(eq(websiteAudits.id, input.id));

    return {
      success: true,
      message: 'Website Audit deleted successfully',
      deletedId: input.id,
    };
  },
});
