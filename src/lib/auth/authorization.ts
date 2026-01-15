/**
 * Authorization Utilities for Server Components and Server Actions
 *
 * Provides helper functions to check authentication and authorization
 * in Server Components and Server Actions using NextAuth.js v5.
 *
 * These functions are the primary defense for Server Actions against
 * direct invocation from browser console (CVE-2025-29927).
 *
 * @see /plans/feat-auth-004-role-based-access-control.md
 */

'use server';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@/lib/roles';
import { cache } from 'react';

/**
 * Cached session getter
 *
 * Uses React's cache() to avoid duplicate auth() calls in the same request.
 * This improves performance when multiple authorization checks are needed.
 *
 * @returns The current session or null
 */
export const getSession = cache(async () => {
  return await auth();
});

/**
 * Require user to be authenticated
 *
 * Use this in Server Components and Server Actions to ensure the user
 * is logged in. Redirects to /login if not authenticated.
 *
 * @returns The session (guaranteed to have a user)
 * @throws Redirects to /login if not authenticated
 *
 * @example
 * export default async function MyServerComponent() {
 *   const session = await requireAuth();
 *   // session.user is guaranteed to exist
 * }
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  return session;
}

/**
 * Require user to have a specific role
 *
 * Use this in Server Components and Server Actions to enforce role-based
 * access control. Redirects to /unauthorized if user doesn't have the
 * required role.
 *
 * @param requiredRole - The role required to access this resource
 * @returns The session (guaranteed to have user with required role)
 * @throws Redirects to /login if not authenticated
 * @throws Redirects to /unauthorized if wrong role
 *
 * @example
 * export async function adminAction() {
 *   const session = await requireRole(UserRole.ADMIN);
 *   // User is guaranteed to be an admin
 * }
 */
export async function requireRole(requiredRole: UserRole) {
  const session = await requireAuth();

  if (session.user.role !== requiredRole) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Require user to have one of multiple allowed roles
 *
 * Use this when a resource can be accessed by users with different roles.
 * Redirects to /unauthorized if user doesn't have any of the required roles.
 *
 * @param requiredRoles - Array of roles that can access this resource
 * @returns The session (guaranteed to have user with one of required roles)
 * @throws Redirects to /login if not authenticated
 * @throws Redirects to /unauthorized if user's role not in allowed list
 *
 * @example
 * export async function bdOrAdminAction() {
 *   const session = await requireAnyRole([UserRole.ADMIN, UserRole.BD_MANAGER]);
 *   // User is guaranteed to be either admin or BD manager
 * }
 */
export async function requireAnyRole(requiredRoles: UserRole[]) {
  const session = await requireAuth();

  if (!requiredRoles.includes(session.user.role)) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Check if current user can access a resource (for ownership checks)
 *
 * Use this to implement resource-level authorization (e.g., "can edit own
 * bids but not others' bids"). Admins bypass ownership checks by default.
 *
 * @param resourceOwnerId - The ID of the user who owns the resource
 * @param adminBypass - Whether admins can access any resource (default: true)
 * @returns true if user can access the resource, false otherwise
 *
 * @example
 * export async function updateBid(bidId: string, data: any) {
 *   const session = await requireAuth();
 *   const bid = await db.query.bids.findFirst({ where: eq(bids.id, bidId) });
 *
 *   const canAccess = await canAccessResource(bid.createdBy, true);
 *   if (!canAccess) {
 *     throw new Error('FORBIDDEN');
 *   }
 *
 *   // Proceed with update
 * }
 */
export async function canAccessResource(
  resourceOwnerId: string,
  adminBypass: boolean = true
): Promise<boolean> {
  const session = await getSession();

  if (!session) {
    return false;
  }

  // Admins can access any resource (unless disabled)
  if (adminBypass && session.user.role === UserRole.ADMIN) {
    return true;
  }

  // User can access their own resources
  return session.user.id === resourceOwnerId;
}

/**
 * Require user to own a resource (or be admin)
 *
 * Convenience function that combines resource ownership check with
 * automatic redirect to /unauthorized if access denied.
 *
 * @param resourceOwnerId - The ID of the user who owns the resource
 * @param adminBypass - Whether admins can access any resource (default: true)
 * @returns The session (guaranteed to have access to the resource)
 * @throws Redirects to /login if not authenticated
 * @throws Redirects to /unauthorized if user doesn't own resource
 *
 * @example
 * export async function updateBid(bidId: string, data: any) {
 *   const session = await requireOwnership(bid.createdBy);
 *   // User is guaranteed to own this bid or be an admin
 * }
 */
export async function requireOwnership(
  resourceOwnerId: string,
  adminBypass: boolean = true
) {
  const session = await requireAuth();

  const canAccess = await canAccessResource(resourceOwnerId, adminBypass);

  if (!canAccess) {
    redirect('/unauthorized');
  }

  return session;
}
