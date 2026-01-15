/**
 * Route Protection Configuration for RBAC
 *
 * Centralized configuration of protected routes and their role requirements.
 * Used by middleware to enforce access control at the edge.
 *
 * Routes are checked in order of specificity (longer patterns first).
 *
 * @see /plans/feat-auth-004-role-based-access-control.md
 */

import { UserRole } from './roles';

export interface RouteRule {
  pattern: string;
  allowedRoles: UserRole[];
  exact?: boolean;
  description?: string;
}

/**
 * Protected routes configuration
 *
 * Each route defines:
 * - pattern: URL path pattern to match
 * - allowedRoles: Array of roles that can access this route
 * - exact: If true, match exact path only; if false, match prefix
 * - description: Human-readable explanation of the route's purpose
 *
 * @example
 * {
 *   pattern: '/admin/business-lines',
 *   allowedRoles: [UserRole.ADMIN],
 *   description: 'Business line management - admin only'
 * }
 */
export const PROTECTED_ROUTES: RouteRule[] = [
  // Dashboard (all authenticated users)
  {
    pattern: '/dashboard',
    allowedRoles: [UserRole.ADMIN, UserRole.BEREICHSLEITER, UserRole.BD_MANAGER],
    exact: false,
    description: 'Main dashboard - all authenticated users',
  },

  // Admin routes (admin only)
  {
    pattern: '/admin/business-lines',
    allowedRoles: [UserRole.ADMIN],
    exact: false,
    description: 'Business line management - admin only',
  },
  {
    pattern: '/admin/employees',
    allowedRoles: [UserRole.ADMIN],
    exact: false,
    description: 'Employee management - admin only',
  },
  {
    pattern: '/admin/technologies',
    allowedRoles: [UserRole.ADMIN],
    exact: false,
    description: 'Technology management - admin only',
  },
  {
    pattern: '/admin',
    allowedRoles: [UserRole.ADMIN],
    exact: false,
    description: 'Admin panel catch-all',
  },

  // Bereichsleiter routes (BL + admin)
  {
    pattern: '/bereichsleiter',
    allowedRoles: [UserRole.ADMIN, UserRole.BEREICHSLEITER],
    exact: false,
    description: 'BL inbox and team assignment',
  },

  // BD Manager routes (all authenticated users)
  {
    pattern: '/bids',
    allowedRoles: [UserRole.ADMIN, UserRole.BEREICHSLEITER, UserRole.BD_MANAGER],
    exact: false,
    description: 'Bid management (BD managers can create, BLs can review)',
  },
];

/**
 * Get required roles for a given pathname
 *
 * This function implements the route matching logic used by middleware.
 * Routes are sorted by specificity (longer patterns first) to ensure
 * more specific routes match before general ones.
 *
 * @param pathname - The URL pathname to check (e.g., '/admin/business-lines')
 * @returns Array of allowed roles, or null if route is not protected
 *
 * @example
 * getRequiredRole('/admin/business-lines') // [UserRole.ADMIN]
 * getRequiredRole('/dashboard') // [UserRole.ADMIN, UserRole.BEREICHSLEITER, UserRole.BD_MANAGER]
 * getRequiredRole('/login') // null (public route)
 */
export function getRequiredRole(pathname: string): UserRole[] | null {
  // Sort routes by specificity (longer patterns first)
  const sortedRoutes = [...PROTECTED_ROUTES].sort((a, b) => b.pattern.length - a.pattern.length);

  for (const route of sortedRoutes) {
    if (route.exact) {
      if (pathname === route.pattern) {
        return route.allowedRoles;
      }
    } else {
      // Match exact path or prefix (with / separator)
      if (pathname === route.pattern || pathname.startsWith(route.pattern + '/')) {
        return route.allowedRoles;
      }
    }
  }

  // Route not found in protected routes list
  return null;
}

/**
 * Check if a given pathname requires authentication
 *
 * @param pathname - The URL pathname to check
 * @returns true if route requires authentication
 */
export function requiresAuth(pathname: string): boolean {
  return getRequiredRole(pathname) !== null;
}

/**
 * Check if a user with a given role can access a route
 *
 * @param pathname - The URL pathname to check
 * @param userRole - The user's role
 * @returns true if user can access the route
 */
export function canAccessRoute(pathname: string, userRole: UserRole): boolean {
  const requiredRoles = getRequiredRole(pathname);

  // If route not protected, anyone can access
  if (!requiredRoles) {
    return true;
  }

  // Check if user's role is in the allowed roles list
  return requiredRoles.includes(userRole);
}
