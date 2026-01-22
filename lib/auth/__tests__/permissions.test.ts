/**
 * Permission System Tests
 *
 * Tests for role-based access control and permission checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import {
  hasRole,
  isBDManager,
  isBLLead,
  isAdmin,
  isBLLeadOrAdmin,
  requireRole,
  getCurrentUserRole,
  getCurrentSession,
  type UserRole,
} from '../permissions';

import { auth } from '@/lib/auth';

describe('Permission System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasRole', () => {
    it('should return true when user has one of the allowed roles', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'Test User' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await hasRole(['bd', 'admin']);

      expect(result).toBe(true);
    });

    it('should return true when user has exact role match', async () => {
      const mockSession = {
        user: { role: 'bl' as UserRole, name: 'Test User' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await hasRole(['bl']);

      expect(result).toBe(true);
    });

    it('should return false when user has different role', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'Test User' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await hasRole(['admin']);

      expect(result).toBe(false);
    });

    it('should return false when user has no role', async () => {
      const mockSession = {
        user: { name: 'Test User' }, // No role
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await hasRole(['bd']);

      expect(result).toBe(false);
    });

    it('should return false when session is null', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await hasRole(['admin']);

      expect(result).toBe(false);
    });

    it('should return false when session is undefined', async () => {
      vi.mocked(auth).mockResolvedValue(undefined);

      const result = await hasRole(['bd']);

      expect(result).toBe(false);
    });

    it('should return false when user object is missing', async () => {
      const mockSession = {
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await hasRole(['admin']);

      expect(result).toBe(false);
    });

    it('should check multiple allowed roles', async () => {
      const mockSession = {
        user: { role: 'admin' as UserRole, name: 'Admin User' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await hasRole(['bd', 'bl', 'admin']);

      expect(result).toBe(true);
    });

    it('should return false for empty allowed roles array', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'Test User' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await hasRole([]);

      expect(result).toBe(false);
    });

    it('should handle all role types', async () => {
      const roles: UserRole[] = ['bd', 'bl', 'admin'];

      for (const role of roles) {
        const mockSession = {
          user: { role, name: 'Test User' },
          expires: new Date(),
        };
        vi.mocked(auth).mockResolvedValue(mockSession);

        const result = await hasRole([role]);
        expect(result).toBe(true);
      }
    });
  });

  describe('isBDManager', () => {
    it('should return true for BD manager role', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBDManager();

      expect(result).toBe(true);
    });

    it('should return false for BL lead role', async () => {
      const mockSession = {
        user: { role: 'bl' as UserRole, name: 'BL Lead' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBDManager();

      expect(result).toBe(false);
    });

    it('should return false for admin role', async () => {
      const mockSession = {
        user: { role: 'admin' as UserRole, name: 'Admin' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBDManager();

      expect(result).toBe(false);
    });

    it('should return false when no session', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await isBDManager();

      expect(result).toBe(false);
    });
  });

  describe('isBLLead', () => {
    it('should return true for BL lead role', async () => {
      const mockSession = {
        user: { role: 'bl' as UserRole, name: 'BL Lead' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBLLead();

      expect(result).toBe(true);
    });

    it('should return false for BD manager role', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBLLead();

      expect(result).toBe(false);
    });

    it('should return false for admin role', async () => {
      const mockSession = {
        user: { role: 'admin' as UserRole, name: 'Admin' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBLLead();

      expect(result).toBe(false);
    });

    it('should return false when no session', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await isBLLead();

      expect(result).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin role', async () => {
      const mockSession = {
        user: { role: 'admin' as UserRole, name: 'Admin' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isAdmin();

      expect(result).toBe(true);
    });

    it('should return false for BD manager role', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isAdmin();

      expect(result).toBe(false);
    });

    it('should return false for BL lead role', async () => {
      const mockSession = {
        user: { role: 'bl' as UserRole, name: 'BL Lead' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isAdmin();

      expect(result).toBe(false);
    });

    it('should return false when no session', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await isAdmin();

      expect(result).toBe(false);
    });
  });

  describe('isBLLeadOrAdmin', () => {
    it('should return true for BL lead role', async () => {
      const mockSession = {
        user: { role: 'bl' as UserRole, name: 'BL Lead' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBLLeadOrAdmin();

      expect(result).toBe(true);
    });

    it('should return true for admin role', async () => {
      const mockSession = {
        user: { role: 'admin' as UserRole, name: 'Admin' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBLLeadOrAdmin();

      expect(result).toBe(true);
    });

    it('should return false for BD manager role', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await isBLLeadOrAdmin();

      expect(result).toBe(false);
    });

    it('should return false when no session', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await isBLLeadOrAdmin();

      expect(result).toBe(false);
    });
  });

  describe('requireRole', () => {
    it('should not throw when user has required role', async () => {
      const mockSession = {
        user: { role: 'admin' as UserRole, name: 'Admin' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      await expect(requireRole(['admin'])).resolves.not.toThrow();
    });

    it('should not throw when user has one of multiple required roles', async () => {
      const mockSession = {
        user: { role: 'bl' as UserRole, name: 'BL Lead' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      await expect(requireRole(['bd', 'bl', 'admin'])).resolves.not.toThrow();
    });

    it('should throw error when user lacks required role', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      await expect(requireRole(['admin'])).rejects.toThrow(
        'Unauthorized: Insufficient permissions'
      );
    });

    it('should throw error when user has no role', async () => {
      const mockSession = {
        user: { name: 'Test User' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      await expect(requireRole(['bd'])).rejects.toThrow(
        'Unauthorized: Insufficient permissions'
      );
    });

    it('should throw error when no session', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      await expect(requireRole(['admin'])).rejects.toThrow(
        'Unauthorized: Insufficient permissions'
      );
    });

    it('should throw error for empty allowed roles array', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      await expect(requireRole([])).rejects.toThrow(
        'Unauthorized: Insufficient permissions'
      );
    });

    it('should include unauthorized in error message', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      await expect(requireRole(['admin'])).rejects.toThrow('Unauthorized');
    });
  });

  describe('getCurrentUserRole', () => {
    it('should return user role when authenticated', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await getCurrentUserRole();

      expect(result).toBe('bd');
    });

    it('should return null when session is null', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await getCurrentUserRole();

      expect(result).toBeNull();
    });

    it('should return null when session is undefined', async () => {
      vi.mocked(auth).mockResolvedValue(undefined);

      const result = await getCurrentUserRole();

      expect(result).toBeNull();
    });

    it('should return null when user has no role', async () => {
      const mockSession = {
        user: { name: 'Test User' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await getCurrentUserRole();

      expect(result).toBeNull();
    });

    it('should return null when user object is missing', async () => {
      const mockSession = {
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await getCurrentUserRole();

      expect(result).toBeNull();
    });

    it('should handle all role types correctly', async () => {
      const roles: UserRole[] = ['bd', 'bl', 'admin'];

      for (const role of roles) {
        const mockSession = {
          user: { role, name: 'Test User' },
          expires: new Date(),
        };
        vi.mocked(auth).mockResolvedValue(mockSession);

        const result = await getCurrentUserRole();
        expect(result).toBe(role);
      }
    });
  });

  describe('getCurrentSession', () => {
    it('should return session when authenticated', async () => {
      const mockSession = {
        user: { role: 'bd' as UserRole, name: 'BD Manager' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const result = await getCurrentSession();

      expect(result).toEqual(mockSession);
    });

    it('should return null when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });

    it('should return undefined when auth returns undefined', async () => {
      vi.mocked(auth).mockResolvedValue(undefined);

      const result = await getCurrentSession();

      expect(result).toBeUndefined();
    });

    it('should call auth function', async () => {
      const mockSession = {
        user: { role: 'admin' as UserRole, name: 'Admin' },
        expires: new Date(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession);

      await getCurrentSession();

      expect(auth).toHaveBeenCalledTimes(1);
    });
  });
});
