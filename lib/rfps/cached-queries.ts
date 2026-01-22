/**
 * Cached RFP queries for performance optimization
 * Uses React cache() to deduplicate DB queries across layout and pages
 */

import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { rfps, accounts, users, quickScans } from '@/lib/db/schema';

/**
 * Get RFP by ID with request-level caching
 * This prevents duplicate queries in layout + page
 */
export const getCachedRfp = cache(async (id: string) => {
  const [rfp] = await db.select().from(rfps).where(eq(rfps.id, id)).limit(1);
  return rfp;
});

/**
 * Get RFP with related data (account, quick scan) in parallel
 * Use this when you need multiple related entities
 */
export const getCachedRfpWithRelations = cache(async (id: string) => {
  const rfp = await getCachedRfp(id);

  if (!rfp) {
    return { rfp: null, account: null, quickScan: null };
  }

  // Parallel fetch of related data
  const [account, quickScan] = await Promise.all([
    rfp.accountId
      ? db
          .select({ name: accounts.name })
          .from(accounts)
          .where(eq(accounts.id, rfp.accountId))
          .limit(1)
          .then((r) => r[0] || null)
      : Promise.resolve(null),
    rfp.quickScanId
      ? db.select().from(quickScans).where(eq(quickScans.id, rfp.quickScanId)).limit(1).then((r) => r[0] || null)
      : Promise.resolve(null),
  ]);

  return { rfp, account, quickScan };
});

/**
 * Get user by ID with request-level caching
 */
export const getCachedUser = cache(async (userId: string) => {
  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user;
});

/**
 * Get RFP title from extracted requirements or account name
 */
export const getRfpTitle = cache(async (rfpId: string): Promise<string> => {
  const { rfp, account } = await getCachedRfpWithRelations(rfpId);

  if (!rfp) return 'RFP';

  // Try to get title from extracted requirements
  if (rfp.extractedRequirements) {
    try {
      const extracted = JSON.parse(rfp.extractedRequirements);
      if (extracted.projectName) {
        return extracted.projectName;
      }
    } catch {
      // Continue to fallback
    }
  }

  // Fallback to account name
  return account?.name || 'RFP';
});
