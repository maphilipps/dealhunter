/**
 * Cached Qualification queries for performance optimization
 * Uses React cache() to deduplicate DB queries across layout and pages
 */

import { eq } from 'drizzle-orm';
import { cache } from 'react';

import { db } from '@/lib/db';
import { preQualifications, accounts, users, leadScans } from '@/lib/db/schema';

/**
 * Get Qualification by ID with request-level caching
 * This prevents duplicate queries in layout + page
 */
export const getCachedPreQualification = cache(async (id: string) => {
  const [preQualification] = await db
    .select()
    .from(preQualifications)
    .where(eq(preQualifications.id, id))
    .limit(1);
  return preQualification;
});

/**
 * Get Qualification with related data (account, qualifications scan) in parallel
 * Use this when you need multiple related entities
 */
export const getCachedPreQualificationWithRelations = cache(async (id: string) => {
  const preQualification = await getCachedPreQualification(id);

  if (!preQualification) {
    return { preQualification: null, account: null, qualificationScan: null };
  }

  // Parallel fetch of related data
  const [account, qualificationScan] = await Promise.all([
    preQualification.accountId
      ? db
          .select({ name: accounts.name })
          .from(accounts)
          .where(eq(accounts.id, preQualification.accountId))
          .limit(1)
          .then(r => r[0] || null)
      : Promise.resolve(null),
    preQualification.qualificationScanId
      ? db
          .select()
          .from(leadScans)
          .where(eq(leadScans.id, preQualification.qualificationScanId))
          .limit(1)
          .then(r => r[0] || null)
      : Promise.resolve(null),
  ]);

  return { preQualification, account, qualificationScan };
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
 * Get Qualification title from extracted requirements or account name
 */
export const getPreQualificationTitle = cache(
  async (preQualificationId: string): Promise<string> => {
    const { preQualification, account } =
      await getCachedPreQualificationWithRelations(preQualificationId);

    if (!preQualification) return 'Qualification';

    // Try to get title from extracted requirements
    if (preQualification.extractedRequirements) {
      try {
        const extracted = JSON.parse(preQualification.extractedRequirements);
        if (extracted.projectName) {
          return extracted.projectName;
        }
      } catch {
        // Continue to fallback
      }
    }

    // Fallback to account name
    return account?.name || 'Qualification';
  }
);

/**
 * Get Qualification customer name from extracted requirements
 */
export const getPreQualificationCustomerName = cache(
  async (preQualificationId: string): Promise<string | null> => {
    const preQualification = await getCachedPreQualification(preQualificationId);

    if (!preQualification?.extractedRequirements) return null;

    try {
      const extracted = JSON.parse(preQualification.extractedRequirements);
      return extracted.customerName || null;
    } catch {
      return null;
    }
  }
);
