/**
 * Admin Server Actions Example
 *
 * Example implementation showing how to protect Server Actions
 * from unauthorized access using role-based wrappers.
 *
 * This fixes CVE-2025-29927 by ensuring all admin actions require
 * UserRole.ADMIN before executing.
 *
 * @see /plans/feat-auth-004-role-based-access-control.md
 */

'use server'

import { withRole, withAnyRole } from '@/lib/auth/server-action-wrapper'
import { UserRole } from '@/lib/roles'

/**
 * Example: Admin-only action
 *
 * @returns Success message with user info
 * @throws Error('UNAUTHORIZED') if not authenticated
 * @throws Error('FORBIDDEN') if not admin
 */
export async function adminOnlyAction() {
  return withRole(UserRole.ADMIN, async (userId, userRole) => {
    // ✅ Authorization complete: User is guaranteed to be an admin

    // Your admin logic here
    console.log(`[AUDIT] Admin ${userId} performed admin action`)

    return {
      success: true,
      message: 'Admin action completed successfully',
      userId,
      role: userRole,
    }
  })
}

/**
 * Example: Action accessible by Admin or Bereichsleiter
 *
 * @returns Success message with user info
 * @throws Error('UNAUTHORIZED') if not authenticated
 * @throws Error('FORBIDDEN') if not admin or Bereichsleiter
 */
export async function multiRoleAction() {
  return withAnyRole([UserRole.ADMIN, UserRole.BEREICHSLEITER], async (userId, userRole) => {
    // ✅ Authorization complete: User is guaranteed to be admin or BL

    console.log(`[AUDIT] User ${userId} (${userRole}) performed multi-role action`)

    return {
      success: true,
      message: 'Action completed successfully',
      userId,
      role: userRole,
    }
  })
}

/**
 * Example: How to use with database mutations
 *
 * Uncomment this when businessLines table is created:
 *
 * import { db } from '@/db'
 * import { businessLines } from '@/db/schema'
 * import { revalidatePath } from 'next/cache'
 *
 * export async function createBusinessLine(data: { name: string; leaderEmail: string }) {
 *   return withRole(UserRole.ADMIN, async (userId, userRole) => {
 *     const [newBusinessLine] = await db.insert(businessLines).values({
 *       name: data.name,
 *       leaderEmail: data.leaderEmail,
 *       createdBy: userId,
 *       createdAt: new Date(),
 *     }).returning()
 *
 *     revalidatePath('/admin/business-lines')
 *
 *     console.log(`[AUDIT] User ${userId} (${userRole}) created business line ${newBusinessLine.id}`)
 *
 *     return newBusinessLine
 *   })
 * }
 */

