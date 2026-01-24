import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { quickScans } from '@/lib/db/schema';

// ===== Input Schemas =====

const deleteQuickScanInputSchema = z.object({
  id: z.string(),
});

// ===== Tool Implementations =====

registry.register({
  name: 'quickScan.delete',
  description: 'Delete a QuickScan (hard delete - cascades to related data)',
  category: 'quick_scan',
  inputSchema: deleteQuickScanInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete QuickScans
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete QuickScans' };
    }

    const [existing] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'QuickScan not found' };
    }

    await db.delete(quickScans).where(eq(quickScans.id, input.id));

    return {
      success: true,
      message: 'QuickScan deleted successfully',
      deletedId: input.id,
    };
  },
});
