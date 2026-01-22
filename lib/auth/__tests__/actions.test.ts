/**
 * Authentication Server Actions Tests
 *
 * Tests for login, register, and logout server actions.
 */

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { login, register, logout } from '../actions';
import { AuthError } from 'next-auth';

// Mock all dependencies BEFORE any imports
vi.mock('next-auth', () => {
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();
  const mockAuth = vi.fn();

  // Create AuthError class
  class MockAuthError extends Error {
    type: string;
    constructor(message: string, type: string) {
      super(message);
      this.name = 'AuthError';
      this.type = type;
    }
  }

  return {
    default: () => ({
      handlers: {},
      signIn: mockSignIn,
      signOut: mockSignOut,
      auth: mockAuth,
    }),
    signIn: mockSignIn,
    signOut: mockSignOut,
    auth: mockAuth,
    AuthError: MockAuthError,
  };
});

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  users: {},
  eq: vi.fn(),
}));

// Mock the entire auth module directly
vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: vi.fn(),
  handlers: {},
}));

describe('Authentication Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully sign in with valid credentials', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'password123');

      vi.mocked(signIn).mockResolvedValue(undefined);

      const result = await login(null, formData);

      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'test@example.com',
        password: 'password123',
        redirectTo: '/',
      });
      expect(result).toBeNull();
    });

    it('should return error for CredentialsSignin error', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'wrongpassword');

      const authError = new AuthError('Invalid credentials', 'CredentialsSignin');
      vi.mocked(signIn).mockRejectedValue(authError);

      const result = await login(null, formData);

      expect(result).toEqual({ error: 'Ungültige Anmeldedaten' });
    });

    it('should return generic error for other AuthErrors', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'password123');

      const authError = new AuthError('Unknown error', 'Unknown');
      vi.mocked(signIn).mockRejectedValue(authError);

      const result = await login(null, formData);

      expect(result).toEqual({ error: 'Ein Fehler ist aufgetreten' });
    });

    it('should re-throw NEXT_REDIRECT error', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'password123');

      const redirectError = new Error('NEXT_REDIRECT');
      (redirectError as any).digest = 'NEXT_REDIRECT';
      vi.mocked(signIn).mockRejectedValue(redirectError);

      await expect(login(null, formData)).rejects.toThrow('NEXT_REDIRECT');
    });

    it('should handle missing email gracefully', async () => {
      const formData = new FormData();
      formData.append('email', '');
      formData.append('password', 'password123');

      vi.mocked(signIn).mockResolvedValue(undefined);

      const result = await login(null, formData);

      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: '',
        password: 'password123',
        redirectTo: '/',
      });
      expect(result).toBeNull();
    });

    it('should handle missing password gracefully', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', '');

      vi.mocked(signIn).mockResolvedValue(undefined);

      const result = await login(null, formData);

      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'test@example.com',
        password: '',
        redirectTo: '/',
      });
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should return error when email is missing', async () => {
      const formData = new FormData();
      formData.append('email', '');
      formData.append('password', 'password123');
      formData.append('name', 'Test User');

      const result = await register(null, formData);

      expect(result).toEqual({ error: 'Alle Felder sind erforderlich' });
      expect(db.query.users.findFirst).not.toHaveBeenCalled();
    });

    it('should return error when password is missing', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', '');
      formData.append('name', 'Test User');

      const result = await register(null, formData);

      expect(result).toEqual({ error: 'Alle Felder sind erforderlich' });
      expect(db.query.users.findFirst).not.toHaveBeenCalled();
    });

    it('should return error when name is missing', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'password123');
      formData.append('name', '');

      const result = await register(null, formData);

      expect(result).toEqual({ error: 'Alle Felder sind erforderlich' });
      expect(db.query.users.findFirst).not.toHaveBeenCalled();
    });

    it('should return error when email already exists', async () => {
      const formData = new FormData();
      formData.append('email', 'existing@example.com');
      formData.append('password', 'password123');
      formData.append('name', 'Test User');

      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: '1',
        email: 'existing@example.com',
        name: 'Existing User',
        role: 'bd',
        password: 'hashed',
      });

      const result = await register(null, formData);

      expect(result).toEqual({ error: 'Diese E-Mail existiert bereits' });
      expect(db.query.users.findFirst).toHaveBeenCalledWith({
        where: expect.any(Function),
      });
    });

    it('should successfully register new user', async () => {
      const formData = new FormData();
      formData.append('email', 'new@example.com');
      formData.append('password', 'password123');
      formData.append('name', 'New User');

      vi.mocked(db.query.users.findFirst).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpassword');

      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      vi.mocked(signIn).mockResolvedValue(undefined);

      const result = await register(null, formData);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(db.insert).toHaveBeenCalledWith(expect.anything());
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          password: 'hashedpassword',
          name: 'New User',
          role: 'bd',
        })
      );
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'new@example.com',
        password: 'password123',
        redirectTo: '/',
      });
      expect(result).toBeNull();
    });

    it('should assign default bd role to new user', async () => {
      const formData = new FormData();
      formData.append('email', 'new@example.com');
      formData.append('password', 'password123');
      formData.append('name', 'New User');

      vi.mocked(db.query.users.findFirst).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpassword');

      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      vi.mocked(signIn).mockResolvedValue(undefined);

      await register(null, formData);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          password: 'hashedpassword',
          name: 'New User',
          role: 'bd',
        })
      );
    });

    it('should handle registration success but login failure', async () => {
      const formData = new FormData();
      formData.append('email', 'new@example.com');
      formData.append('password', 'password123');
      formData.append('name', 'New User');

      vi.mocked(db.query.users.findFirst).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpassword');

      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      const authError = new AuthError('Login failed', 'CredentialsSignin');
      vi.mocked(signIn).mockRejectedValue(authError);

      const result = await register(null, formData);

      expect(result).toEqual({
        error: 'Registrierung erfolgreich, aber Login fehlgeschlagen',
      });
    });

    it('should re-throw non-AuthError during sign in', async () => {
      const formData = new FormData();
      formData.append('email', 'new@example.com');
      formData.append('password', 'password123');
      formData.append('name', 'New User');

      vi.mocked(db.query.users.findFirst).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpassword');

      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      const unexpectedError = new Error('Unexpected error');
      vi.mocked(signIn).mockRejectedValue(unexpectedError);

      await expect(register(null, formData)).rejects.toThrow('Unexpected error');
    });

    it('should handle bcrypt hash failure', async () => {
      const formData = new FormData();
      formData.append('email', 'new@example.com');
      formData.append('password', 'password123');
      formData.append('name', 'New User');

      vi.mocked(db.query.users.findFirst).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockRejectedValue(new Error('Hash failed'));

      await expect(register(null, formData)).rejects.toThrow('Hash failed');
    });

    it('should handle database insertion failure', async () => {
      const formData = new FormData();
      formData.append('email', 'new@example.com');
      formData.append('password', 'password123');
      formData.append('name', 'New User');

      vi.mocked(db.query.users.findFirst).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpassword');

      const mockValues = vi.fn().mockRejectedValue(new Error('DB error'));
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      await expect(register(null, formData)).rejects.toThrow('DB error');
    });
  });

  describe('logout', () => {
    it('should successfully sign out and redirect to login', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined);

      await logout();

      expect(signOut).toHaveBeenCalledWith({ redirectTo: '/login' });
    });

    it('should handle signOut errors gracefully', async () => {
      const error = new Error('Sign out failed');
      vi.mocked(signOut).mockRejectedValue(error);

      await expect(logout()).rejects.toThrow('Sign out failed');
    });

    it('should always redirect to /login after logout', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined);

      await logout();

      expect(signOut).toHaveBeenCalledWith(expect.objectContaining({
        redirectTo: '/login',
      }));
    });
  });
});
