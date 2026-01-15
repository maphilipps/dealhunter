# feat: User Registration (AUTH-001)

**Status:** Ready for Implementation
**Priority:** Highest (Foundation Feature)
**Estimated Effort:** 4-6 hours
**Feature ID:** AUTH-001

## Overview

Implement user registration with email/password authentication for the Dealhunter platform. This is the foundational authentication feature that enables all other functionality.

## Problem Statement

Users need to create accounts to access the Dealhunter system. The system requires three user roles (BD Manager, Bereichsleiter, Admin) with secure credential storage and JWT-based session management.

**From FEATURES.json AUTH-001:**
- Users can register with email and password
- Password requirements: min 8 chars, 1 uppercase, 1 number
- Password confirmation required
- Redirect to login page after successful registration
- Hashed password storage in database

## Proposed Solution

Implement a complete user registration flow using:
- **Next.js 15 Server Actions** for form handling
- **PostgreSQL + Drizzle ORM** for database (per SPEC.md line 32)
- **Argon2id** for password hashing (2025 gold standard)
- **Zod** for validation
- **ShadCN UI** for form components
- **Auth.js** for authentication infrastructure

## Technical Approach

### Phase 1: Database Foundation

#### 1.1 Install Dependencies

```bash
# Database & ORM
bun add drizzle-orm postgres
bun add -D drizzle-kit

# Password hashing (Argon2id - recommended over bcrypt)
bun add argon2

# Validation
bun add zod

# Auth
bun add next-auth@beta
bun add @auth/drizzle-adapter

# Form handling
bun add react-hook-form @hookform/resolvers

# UI (if not already installed)
npx shadcn@latest add form input button label
```

#### 1.2 Drizzle Configuration

**File:** `drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
```

#### 1.3 Database Schema

**File:** `src/db/schema.ts`

```typescript
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('bd_manager'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

**File:** `src/db/index.ts`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString)

export const db = drizzle(client, { schema })
```

#### 1.4 Run Migration

```bash
bun run db:push  # Or: bunx drizzle-kit push
```

### Phase 2: Authentication Utilities

#### 2.1 Password Hashing (Argon2id)

**File:** `src/lib/auth/password.ts`

```typescript
import argon2 from 'argon2'

/**
 * Hash password using Argon2id (OWASP 2025 recommended)
 * Configuration: 19MiB memory, 2 iterations, parallelism 1
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1
  })
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  return argon2.verify(hash, password)
}
```

**Why Argon2id over bcrypt:**
- Winner of Password Hashing Competition (2015)
- Memory-hard design resists GPU/ASIC attacks
- NIST and OWASP 2025 recommended
- Superior security for modern threats

#### 2.2 Validation Schemas

**File:** `src/lib/validations/auth.ts`

```typescript
import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters')
    .trim(),
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
})

export type RegisterFormValues = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required')
})

export type LoginFormValues = z.infer<typeof loginSchema>
```

### Phase 3: Server Actions

#### 3.1 Registration Action

**File:** `src/app/actions/auth.ts`

```typescript
'use server'

import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { registerSchema } from '@/lib/validations/auth'
import { hashPassword } from '@/lib/auth/password'
import { eq } from 'drizzle-orm'

export type RegisterFormState = {
  errors?: {
    name?: string[]
    email?: string[]
    password?: string[]
    confirmPassword?: string[]
    _form?: string[]
  }
  message?: string
}

export async function registerUser(
  prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  // 1. Validate form fields
  const validatedFields = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword')
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors
    }
  }

  const { name, email, password } = validatedFields.data

  try {
    // 2. Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser.length > 0) {
      return {
        errors: {
          email: ['Email already registered']
        }
      }
    }

    // 3. Hash password with Argon2id
    const hashedPassword = await hashPassword(password)

    // 4. Create user
    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: 'bd_manager' // Default role
    })

    // 5. Success - handled by redirect
  } catch (error) {
    console.error('Registration error:', error)
    return {
      errors: {
        _form: ['An error occurred during registration. Please try again.']
      }
    }
  }

  // Redirect to login page
  redirect('/login')
}
```

### Phase 4: Auth.js Configuration

#### 4.1 Auth.js Setup

**File:** `src/auth.ts`

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPassword } from '@/lib/auth/password'
import { loginSchema } from '@/lib/validations/auth'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const validatedFields = loginSchema.safeParse(credentials)

        if (!validatedFields.success) {
          return null
        }

        const { email, password } = validatedFields.data

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)

        if (!user) {
          return null
        }

        const isValidPassword = await verifyPassword(user.password, password)

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    })
  ],
  pages: {
    signIn: '/login'
  },
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  }
})
```

#### 4.2 API Route Handler

**File:** `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

#### 4.3 Environment Variables

**File:** `.env.local`

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dealhunter"

# Auth.js
AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

### Phase 5: UI Components

#### 5.1 Registration Page

**File:** `src/app/register/page.tsx`

```typescript
'use client'

import { useActionState } from 'react'
import { registerUser, type RegisterFormState } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

const initialState: RegisterFormState = {}

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerUser, initialState)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Register for Dealhunter
          </p>
        </div>

        <form action={formAction} className="space-y-6">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              required
              aria-describedby="name-error"
            />
            {state?.errors?.name && (
              <p id="name-error" className="text-sm text-destructive">
                {state.errors.name[0]}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              required
              aria-describedby="email-error"
            />
            {state?.errors?.email && (
              <p id="email-error" className="text-sm text-destructive">
                {state.errors.email[0]}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              aria-describedby="password-error"
            />
            <p className="text-xs text-muted-foreground">
              Min 8 characters, 1 uppercase, 1 number
            </p>
            {state?.errors?.password && (
              <p id="password-error" className="text-sm text-destructive">
                {state.errors.password[0]}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
              aria-describedby="confirmPassword-error"
            />
            {state?.errors?.confirmPassword && (
              <p id="confirmPassword-error" className="text-sm text-destructive">
                {state.errors.confirmPassword[0]}
              </p>
            )}
          </div>

          {/* Form-level errors */}
          {state?.errors?._form && (
            <p className="text-sm text-destructive">
              {state.errors._form[0]}
            </p>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Creating account...' : 'Sign up'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium underline underline-offset-4 hover:text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

### Phase 6: Middleware & Route Protection

**File:** `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/auth'

export async function middleware(request: NextRequest) {
  const session = await auth()

  // Protected routes
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                          request.nextUrl.pathname.startsWith('/admin')

  // Auth routes
  const isAuthRoute = request.nextUrl.pathname === '/login' ||
                     request.nextUrl.pathname === '/register'

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Admin-only routes
  if (request.nextUrl.pathname.startsWith('/admin') && session?.user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/register']
}
```

## Acceptance Criteria

From FEATURES.json AUTH-001 steps:

- [ ] Navigate to /register page loads successfully
- [ ] Enter valid email address in email field
- [ ] Enter password (min 8 chars, 1 uppercase, 1 number) - validated
- [ ] Confirm password matches original password - validated
- [ ] Submit registration form triggers server action
- [ ] Success message appears after successful registration
- [ ] Redirect to /login page after registration
- [ ] User exists in database with hashed password (Argon2id)

## Testing Strategy

### Unit Tests

**File:** `src/lib/auth/__tests__/password.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../password'

describe('Password Utilities', () => {
  it('should hash password with Argon2id', async () => {
    const password = 'Test1234'
    const hash = await hashPassword(password)

    expect(hash).toBeDefined()
    expect(hash).not.toBe(password)
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  it('should verify correct password', async () => {
    const password = 'Test1234'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword(hash, password)

    expect(isValid).toBe(true)
  })

  it('should reject incorrect password', async () => {
    const password = 'Test1234'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword(hash, 'WrongPassword1')

    expect(isValid).toBe(false)
  })
})
```

### E2E Tests

**File:** `tests/e2e/auth/registration.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('User Registration (AUTH-001)', () => {
  test('should register new user successfully', async ({ page }) => {
    // Navigate to register page
    await page.goto('/register')

    // Fill form
    await page.fill('input[name="name"]', 'Test User')
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`)
    await page.fill('input[name="password"]', 'Test1234')
    await page.fill('input[name="confirmPassword"]', 'Test1234')

    // Submit
    await page.click('button[type="submit"]')

    // Verify redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/register')

    // Submit empty form
    await page.click('button[type="submit"]')

    // Verify error messages
    await expect(page.locator('text=Name must be at least 2 characters')).toBeVisible()
    await expect(page.locator('text=Invalid email address')).toBeVisible()
  })

  test('should reject duplicate email', async ({ page }) => {
    const email = `duplicate${Date.now()}@example.com`

    // Register first user
    await page.goto('/register')
    await page.fill('input[name="name"]', 'User One')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', 'Test1234')
    await page.fill('input[name="confirmPassword"]', 'Test1234')
    await page.click('button[type="submit"]')

    // Try to register again with same email
    await page.goto('/register')
    await page.fill('input[name="name"]', 'User Two')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', 'Test1234')
    await page.fill('input[name="confirmPassword"]', 'Test1234')
    await page.click('button[type="submit"]')

    // Verify error
    await expect(page.locator('text=Email already registered')).toBeVisible()
  })
})
```

## Security Considerations

### Password Security

✅ **Implemented:**
- Argon2id hashing (19MiB memory, 2 iterations)
- Server-side validation only
- No password exposure in logs
- Hashed storage only

### CSRF Protection

✅ **Built-in:**
- Next.js Server Actions have automatic CSRF protection
- Origin/Host header validation
- Encrypted action IDs

### Session Security

✅ **Implemented:**
- JWT with httpOnly cookies
- Secure flag in production
- SameSite: lax
- 24-hour expiration

### Input Validation

✅ **Implemented:**
- Zod schema validation
- Server-side only (client hints for UX)
- Email uniqueness check
- Trim/lowercase normalization

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Password hashing | 200-500ms | Argon2id with current config |
| Form validation | <50ms | Zod schema parsing |
| Database insert | <100ms | PostgreSQL with index on email |
| Full registration flow | <1s | End-to-end user experience |

## Dependencies

```json
{
  "dependencies": {
    "next": "15.1.0",
    "next-auth": "5.0.0-beta",
    "drizzle-orm": "^0.36.4",
    "postgres": "^3.4.5",
    "argon2": "^0.31.2",
    "zod": "^3.24.2",
    "react-hook-form": "^7.54.2",
    "@hookform/resolvers": "^3.9.1"
  },
  "devDependencies": {
    "drizzle-kit": "^0.29.2",
    "@types/node": "^22.10.5",
    "vitest": "^2.2.0",
    "@playwright/test": "^1.50.0"
  }
}
```

## Alternative Approaches Considered

### 1. bcrypt vs Argon2id

**Rejected bcrypt because:**
- Argon2id is OWASP 2025 gold standard
- Memory-hard design resists modern attacks better
- Only 10-20% slower than bcrypt with better security

**Use bcrypt if:**
- Legacy system compatibility required
- Embedded systems with memory constraints

### 2. NextAuth.js vs Custom JWT

**Chose NextAuth.js (Auth.js) because:**
- Built-in CSRF protection
- Standardized session management
- Easy to extend with OAuth providers later
- Active maintenance and Next.js 15 support

### 3. Client-side vs Server-side Validation

**Chose server-side only (with client hints) because:**
- Security cannot rely on client validation
- Progressive enhancement (works without JS)
- Single source of truth for business rules

## Future Enhancements (Post-MVP)

- [ ] Email verification workflow
- [ ] Password reset functionality
- [ ] MFA/2FA support
- [ ] OAuth providers (Google, Microsoft)
- [ ] Account lockout after failed attempts
- [ ] Password strength meter
- [ ] CAPTCHA for bot protection

## References

### Internal
- SPEC.md lines 1448-1469 (Authentication requirements)
- FEATURES.json AUTH-001 (Acceptance criteria)
- CLAUDE.md (Agent-native principles)

### External Research
- **Repository Research:** Bootstrap project, no existing patterns
- **Best Practices:** OWASP 2025 guidelines, Argon2id hashing, password policies
- **Framework Docs:** Next.js 15 Server Actions, Drizzle ORM, Auth.js v5

### Official Documentation
- Next.js 15: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- Auth.js: https://authjs.dev/getting-started
- Zod: https://zod.dev
- Argon2: https://github.com/P-H-C/phc-winner-argon2

---

**Plan Status:** ✅ Ready for Implementation
**Next Step:** Run `/workflows:work` to begin implementation
**Estimated Completion:** 4-6 hours for full AUTH-001 feature
