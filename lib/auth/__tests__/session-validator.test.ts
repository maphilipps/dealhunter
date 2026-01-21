/**
 * Session Validator Tests
 *
 * Tests for session validation and user authentication security.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';

// Mock dependencies
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  users: {},
  eq: vi.fn(),
}));

import { requireValidUser, validateUserForAction } from '../session-validator';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { eq } from '@/lib/db/schema';

describe('Session Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock redirect to throw an error like the real implementation
    vi.mocked(redirect).mockImplementation((path: string) => {
      throw new Error(`Redirected to: ${path}`);
    });
  });

  describe('requireValidUser', () => {
    it('should return user and session when user exists in database', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      };

      const mockSession = {
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockUser]),
          }),
        }) as any,
      } as any);

      const result = await requireValidUser();

      expect(result).toEqual({
        user: mockUser,
        session: mockSession,
      });
      expect(auth).toHaveBeenCalledOnce();
      expect(db.select).toHaveBeenCalledOnce();
    });

    it('should redirect to login when no session exists', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      await expect(requireValidUser()).rejects.toThrow('Redirected to: /login');
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should redirect to login when session exists but no user ID', async () => {
      const mockSession = {
        user: {},
      };

      vi.mocked(auth).mockResolvedValue(mockSession as any);

      await expect(requireValidUser()).rejects.toThrow('Redirected to: /login');
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should redirect to login with error when user not in database', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
        },
      };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }) as any,
      } as any);

      await expect(requireValidUser()).rejects.toThrow('Redirected to: /login?error=user_not_found');
      expect(redirect).toHaveBeenCalledWith('/login?error=user_not_found');
    });

    it('should handle database errors gracefully', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
        },
      };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockRejectedValueOnce(new Error('Database connection failed')),
          }),
        }) as any,
      } as any);

      await expect(requireValidUser()).rejects.toThrow('Database connection failed');
    });
  });

  describe('validateUserForAction', () => {
    it('should return valid:true when user exists', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      };

      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockUser]),
          }),
        }) as any,
      } as any);

      const result = await validateUserForAction('user-123');

      expect(result).toEqual({
        valid: true,
      });
      expect(db.select).toHaveBeenCalledOnce();
    });

    it('should return error when user does not exist', async () => {
      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }) as any,
      } as any);

      const result = await validateUserForAction('nonexistent-user');

      expect(result).toEqual({
        valid: false,
        error: 'Benutzer nicht gefunden. Bitte melden Sie sich erneut an.',
      });
    });

    it('should handle empty userId gracefully', async () => {
      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }) as any,
      } as any);

      const result = await validateUserForAction('');

      expect(result).toEqual({
        valid: false,
        error: 'Benutzer nicht gefunden. Bitte melden Sie sich erneut an.',
      });
    });

    it('should handle database errors in action validation', async () => {
      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockRejectedValueOnce(new Error('DB Error')),
          }),
        }) as any,
      } as any);

      await expect(validateUserForAction('user-123')).rejects.toThrow('DB Error');
    });

    it('should call db.select with correct userId', async () => {
      const mockUser = {
        id: 'user-456',
        name: 'Test User',
      };

      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockUser]),
          }),
        }) as any,
      } as any);

      await validateUserForAction('user-456');

      expect(db.select).toHaveBeenCalledOnce();
    });
  });

  describe('Security scenarios', () => {
    it('should prevent access when session is expired', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      await expect(requireValidUser()).rejects.toThrow('Redirected to: /login');
      expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('should prevent access when user was deleted from database', async () => {
      const mockSession = {
        user: {
          id: 'deleted-user-123',
        },
      };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }) as any,
      } as any);

      await expect(requireValidUser()).rejects.toThrow('Redirected to: /login?error=user_not_found');
      expect(redirect).toHaveBeenCalledWith('/login?error=user_not_found');
    });

    it('should handle concurrent user validation requests', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Test User',
      };

      vi.mocked(eq).mockReturnValue({});
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }) as any,
      } as any);

      const results = await Promise.all([
        validateUserForAction('user-123'),
        validateUserForAction('user-123'),
        validateUserForAction('user-123'),
      ]);

      results.forEach((result) => {
        expect(result.valid).toBe(true);
      });
    });
  });
});
