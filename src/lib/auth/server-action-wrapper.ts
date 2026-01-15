/**
 * Server Action Authorization Wrappers
 *
 * Provides wrapper functions to protect Server Actions from unauthorized access.
 * These are the PRIMARY DEFENSE against CVE-2025-29927 (middleware bypass).
 *
 * IMPORTANT: Every Server Action that performs mutations MUST use one of these wrappers:
 * - withAuth(): Requires user to be authenticated
 * - withRole(): Requires user to have a specific role
 * - withAnyRole(): Requires user to have one of multiple roles
 *
 * @see /plans/feat-auth-004-role-based-access-control.md
 */

'use server'

import { headers } from 'next/headers'
import { auth } from '@/auth'
import { UserRole } from '@/lib/roles'

/**
 * Authentication wrapper for Server Actions
 *
 * Ensures the user is authenticated before executing the handler.
 * Throws 'UNAUTHORIZED' if not authenticated.
 *
 * @param handler - Function to execute with userId and userRole
 * @returns Result of the handler function
 * @throws Error('UNAUTHORIZED') if user not authenticated
 *
 * @example
 * export async function myAction() {
 *   return withAuth(async (userId, userRole) => {
 *     // User is guaranteed to be authenticated
 *     return `Hello, user ${userId} with role ${userRole}`
 *   })
 * }
 */
export async function withAuth<T>(
  handler: (userId: string, userRole: UserRole) => Promise<T>
): Promise<T> {
  const session = await auth()

  if (!session?.user) {
    throw new Error('UNAUTHORIZED')
  }

  return handler(session.user.id, session.user.role as UserRole)
}

/**
 * Role-based authorization wrapper for Server Actions
 *
 * Ensures the user has a specific role before executing the handler.
 * Throws 'UNAUTHORIZED' if not authenticated or 'FORBIDDEN' if wrong role.
 *
 * @param requiredRole - The role required to execute this action
 * @param handler - Function to execute with userId and userRole
 * @returns Result of the handler function
 * @throws Error('UNAUTHORIZED') if user not authenticated
 * @throws Error('FORBIDDEN') if user doesn't have required role
 *
 * @example
 * export async function adminAction() {
 *   return withRole(UserRole.ADMIN, async (userId, userRole) => {
 *     // User is guaranteed to be an admin
 *     await db.insert(businessLines).values({ ... })
 *   })
 * }
 */
export async function withRole<T>(
  requiredRole: UserRole,
  handler: (userId: string, userRole: UserRole) => Promise<T>
): Promise<T> {
  return withAuth(async (userId, userRole) => {
    if (userRole !== requiredRole) {
      throw new Error('FORBIDDEN')
    }
    return handler(userId, userRole)
  })
}

/**
 * Multi-role authorization wrapper for Server Actions
 *
 * Ensures the user has one of the allowed roles before executing the handler.
 * Throws 'UNAUTHORIZED' if not authenticated or 'FORBIDDEN' if role not allowed.
 *
 * @param requiredRoles - Array of roles that can execute this action
 * @param handler - Function to execute with userId and userRole
 * @returns Result of the handler function
 * @throws Error('UNAUTHORIZED') if user not authenticated
 * @throws Error('FORBIDDEN') if user's role not in allowed list
 *
 * @example
 * export async function bdOrAdminAction() {
 *   return withAnyRole([UserRole.ADMIN, UserRole.BD_MANAGER], async (userId, userRole) => {
 *     // User is guaranteed to be either admin or BD manager
 *     await db.insert(bids).values({ ... })
 *   })
 * }
 */
export async function withAnyRole<T>(
  requiredRoles: UserRole[],
  handler: (userId: string, userRole: UserRole) => Promise<T>
): Promise<T> {
  return withAuth(async (userId, userRole) => {
    if (!requiredRoles.includes(userRole)) {
      throw new Error('FORBIDDEN')
    }
    return handler(userId, userRole)
  })
}

/**
 * Resource ownership check wrapper
 *
 * Ensures the user owns a resource (or is an admin with bypass).
 * Throws 'UNAUTHORIZED' if not authenticated or 'FORBIDDEN' if not owner.
 *
 * @param resourceOwnerId - ID of the user who owns the resource
 * @param handler - Function to execute with userId and userRole
 * @param adminBypass - Whether admins can access any resource (default: true)
 * @returns Result of the handler function
 * @throws Error('UNAUTHORIZED') if user not authenticated
 * @throws Error('FORBIDDEN') if user doesn't own resource and is not admin
 *
 * @example
 * export async function updateBid(bidId: string, data: any) {
 *   const bid = await db.query.bids.findFirst({ where: eq(bids.id, bidId) })
 *
 *   return withOwnership(bid.createdBy, async (userId, userRole) => {
 *     // User is guaranteed to own this bid or be an admin
 *     await db.update(bids).set(data).where(eq(bids.id, bidId))
 *   })
 * }
 */
export async function withOwnership<T>(
  resourceOwnerId: string,
  handler: (userId: string, userRole: UserRole) => Promise<T>,
  adminBypass: boolean = true
): Promise<T> {
  return withAuth(async (userId, userRole) => {
    // Admins can access any resource (unless bypass disabled)
    if (adminBypass && userRole === UserRole.ADMIN) {
      return handler(userId, userRole)
    }

    // User must own the resource
    if (userId !== resourceOwnerId) {
      throw new Error('FORBIDDEN')
    }

    return handler(userId, userRole)
  })
}
