/**
 * Role-Based Permission Helpers
 *
 * Provides utility functions to check user roles and permissions.
 */

import { auth } from '@/lib/auth';

export type UserRole = 'bd' | 'bl' | 'admin';

/**
 * Check if the current user has one of the specified roles
 */
export async function hasRole(allowedRoles: UserRole[]): Promise<boolean> {
  const session = await auth();

  if (!session?.user?.role) {
    return false;
  }

  return allowedRoles.includes(session.user.role);
}

/**
 * Check if the current user is a BD Manager
 */
export async function isBDManager(): Promise<boolean> {
  return hasRole(['bd']);
}

/**
 * Check if the current user is a Business Line Lead
 */
export async function isBLLead(): Promise<boolean> {
  return hasRole(['bl']);
}

/**
 * Check if the current user is an Admin
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole(['admin']);
}

/**
 * Check if the current user is a BL Lead or Admin
 * (Admins have all permissions of BL Leads)
 */
export async function isBLLeadOrAdmin(): Promise<boolean> {
  return hasRole(['bl', 'admin']);
}

/**
 * Require specific role(s), throw error if not authorized
 * Use this in Server Actions
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<void> {
  const hasPermission = await hasRole(allowedRoles);

  if (!hasPermission) {
    throw new Error('Unauthorized: Insufficient permissions');
  }
}

/**
 * Get the current user's role or null if not authenticated
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const session = await auth();
  return session?.user?.role ?? null;
}

/**
 * Get the current session (includes user info with role)
 */
export async function getCurrentSession() {
  return auth();
}
