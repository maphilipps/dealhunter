/**
 * Role-Based Access Control (RBAC) Type System
 *
 * Defines the 3 roles for Dealhunter MVP:
 * - BD_MANAGER: Can create bids, view own data
 * - BEREICHSLEITER: Can review bids, assign teams
 * - ADMIN: Full system access
 *
 * @see /plans/feat-auth-004-role-based-access-control.md
 */

export enum UserRole {
  ADMIN = 'admin',
  BEREICHSLEITER = 'bereichsleiter',
  BD_MANAGER = 'bd_manager',
}

/**
 * Human-readable German display names for each role
 */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.BEREICHSLEITER]: 'Bereichsleiter',
  [UserRole.BD_MANAGER]: 'BD Manager',
};

/**
 * Role hierarchy for permission inheritance
 * Higher number = more permissions
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.BD_MANAGER]: 1,
  [UserRole.BEREICHSLEITER]: 2,
  [UserRole.ADMIN]: 3,
};

/**
 * Check if a user has a role equal to or higher than required
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if userRole has equal or higher permissions
 *
 * @example
 * hasRoleHigherOrEqual(UserRole.ADMIN, UserRole.BEREICHSLEITER) // true
 * hasRoleHigherOrEqual(UserRole.BD_MANAGER, UserRole.ADMIN) // false
 */
export function hasRoleHigherOrEqual(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Parse a string value into a UserRole enum
 *
 * @param value - The string value to parse (e.g., from database)
 * @returns UserRole if valid, null otherwise
 *
 * @example
 * parseUserRole('admin') // UserRole.ADMIN
 * parseUserRole('superadmin') // null
 * parseUserRole('Admin') // null (case-sensitive)
 */
export function parseUserRole(value: string): UserRole | null {
  if (Object.values(UserRole).includes(value as UserRole)) {
    return value as UserRole;
  }
  return null;
}

/**
 * Validate that a role value is one of the valid roles
 *
 * @param value - The value to validate
 * @returns true if valid, false otherwise
 */
export function isValidRole(value: string): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}
