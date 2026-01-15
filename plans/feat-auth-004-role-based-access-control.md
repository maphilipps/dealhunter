# feat: Role-Based Access Control (RBAC) for Dealhunter

**Feature ID:** AUTH-004
**Status:** 🔳 Planning
**Priority:** 🔴 CRITICAL (blocking all admin features)
**Estimated Effort:** 16 hours
**Complexity:** High (multi-layer security, database migration, error handling)

---

## Overview

Implement comprehensive Role-Based Access Control (RBAC) system with 3 roles (BD Manager, Bereichsleiter, Admin) protecting routes at 3 layers (middleware, server components, server actions). This feature addresses critical security vulnerability **CVE-2025-29927** where middleware-only protection allows direct server action invocation from browser console.

**Current State:**
- ✅ Authentication implemented (AUTH-001, AUTH-002, AUTH-003)
- ✅ NextAuth.js v5 configured with JWT sessions
- ✅ Database schema includes `role` column (VARCHAR)
- ✅ Basic middleware route protection exists
- ❌ **CRITICAL GAP:** No server action authorization (security vulnerability)
- ❌ **CRITICAL GAP:** No `isActive` field check in auth flow
- ❌ **HIGH GAP:** No role enum or type safety (magic strings)
- ❌ **HIGH GAP:** No unauthorized page or error handling

**Target State:**
- Type-safe role system with PostgreSQL enum
- 3-layer defense: middleware → server components → server actions
- Comprehensive error handling (JWT failures, database down, corrupted tokens)
- Token invalidation mechanism (tokenVersion)
- Graceful degradation with cached roles
- Migration rollback procedure tested

---

## Problem Statement / Motivation

### Current Security Vulnerabilities

**1. CVE-2025-29927 - Middleware-Only Protection (CRITICAL)**

Current implementation only checks roles in middleware. BD Manager can invoke admin server actions directly:

```typescript
// ❌ VULNERABLE: BD Manager can execute this from browser console
fetch('/api/admin/business-lines', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Hacked BL', leaderEmail: 'hacker@test.de' })
})
// Result: Business line created successfully (NO AUTHORIZATION CHECK!)
```

**Attack Vector:** Direct server action invocation bypasses middleware entirely.

**CVSS Score:** 8.1 (High)
**Impact:** Data integrity breach, unauthorized business line creation

**2. JWT Stale Window (HIGH)**

30-day JWT expiration means role changes don't take effect for up to 30 days:

```typescript
// Day 1: User logs in as Admin
// JWT contains: { role: 'admin', exp: 30 days }

// Day 2: Admin changes user role to BD Manager
// Database: role = 'bd_manager'
// JWT: Still contains 'admin' (valid for 29 more days!)

// User retains admin permissions for 29 days ❌
```

**Impact:** Privilege escalation, stale permissions, compliance violation

**3. Magic String Role Checks (LOW)**

```typescript
// Current middleware (line 27):
if (session?.user?.role !== 'admin') { // Magic string!

// ❌ Problems:
// - No type safety
// - Typos not caught by TypeScript
// - Refactoring requires find/replace
// - No IDE autocomplete
```

**4. No `isActive` Check (CRITICAL)**

```typescript
// Database schema has isActive field:
isActive: boolean('is_active').notNull().default(true)

// ❌ But auth.ts NEVER checks it!
// Deactivated users can still login
```

### Business Motivation

**Blocking Features:**
- All admin features (ADMIN-001 through ADMIN-006) require role checks
- Dashboard features (DASH-001 through DASH-004) need role-based data filtering
- Server actions for mutations require authorization

**Compliance Requirements:**
- German GDPR requirements for account deactivation
- Audit trail for privilege changes
- Principle of least privilege enforcement

---

## Proposed Solution

### Architecture: 3-Layer Defense

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Middleware (Edge Runtime)                         │
│  - Broad route protection (/admin/*, /dashboard/*)          │
│  - Fast cookie-based session checks (no DB queries)         │
│  - Redirects for unauthorized access                        │
│  - Performance: < 10ms per request                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Server Components (Node Runtime)                 │
│  - Conditional rendering based on role                      │
│  - Direct auth() calls with type-safe session              │
│  - Role-based UI components                                 │
│  - Data filtering by ownership                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Server Actions (Node Runtime)                     │
│  - requireRole() checks before mutations                    │
│  - Resource-level permissions (own vs others' data)         │
│  - Audit logging for all privileged operations              │
│  - Last line of defense against direct invocation           │
└─────────────────────────────────────────────────────────────┘
```

### Type-Safe Role System

**PostgreSQL Enum:**
```sql
CREATE TYPE user_role_enum AS ENUM ('admin', 'bereichsleiter', 'bd_manager');
```

**TypeScript Enum:**
```typescript
export enum UserRole {
  ADMIN = 'admin',
  BEREICHSLEITER = 'bereichsleiter',
  BD_MANAGER = 'bd_manager',
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.BD_MANAGER]: 1,
  [UserRole.BEREICHSLEITER]: 2,
  [UserRole.ADMIN]: 3,
};
```

**Benefits:**
- ✅ Type safety (compile-time checks)
- ✅ No typos (IDE autocomplete)
- ✅ Database constraints (invalid values rejected)
- ✅ Easy refactoring (find all references)

### Token Invalidation Mechanism

**tokenVersion Field:**
```typescript
// users table:
tokenVersion: integer('token_version').notNull().default(0)

// JWT token contains:
{ role: 'admin', tokenVersion: 5 }

// On each request, verify:
SELECT tokenVersion FROM users WHERE id = userId
// If DB tokenVersion (6) > JWT tokenVersion (5): Invalid!
```

**When to Increment:**
1. Role changes (admin → bd_manager)
2. Account deactivation (isActive: false)
3. Email changes
4. Password changes
5. Manual admin action ("Invalidate all sessions")

**User Experience:**
```
User's browser → Request with JWT (tokenVersion: 5)
Server → Check DB: tokenVersion = 6
Server → Clear cookies, redirect to /login
Login page → Show: "Your permissions have changed. Please log in again."
```

### Graceful Degradation Strategy

**Database Failure Handling:**
```typescript
// Normal mode:
const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
return user.role // Fresh from database

// Degraded mode (DB down):
const cached = await redis.get(`user:role:${userId}`)
if (cached && Date.now() - cached.cachedAt < 300000) { // 5 min TTL
  return cached.role // From cache
}
throw new Error('Database unavailable and no valid cache')
```

**UI Feedback:**
```typescript
{isDegraded && (
  <div className="bg-yellow-100 p-4">
    ⚠️ Running in degraded mode - Some features may be unavailable
  </div>
)}
```

---

## Technical Approach

### Phase 1: Foundation (3 hours)

#### 1.1 Create Role Type System

**File:** `/src/lib/roles.ts` (NEW)
```typescript
export enum UserRole {
  ADMIN = 'admin',
  BEREICHSLEITER = 'bereichsleiter',
  BD_MANAGER = 'bd_manager',
}

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.BEREICHSLEITER]: 'Bereichsleiter',
  [UserRole.BD_MANAGER]: 'BD Manager',
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.BD_MANAGER]: 1,
  [UserRole.BEREICHSLEITER]: 2,
  [UserRole.ADMIN]: 3,
};

export function hasRoleHigherOrEqual(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function parseUserRole(value: string): UserRole | null {
  if (Object.values(UserRole).includes(value as UserRole)) {
    return value as UserRole;
  }
  return null;
}
```

**File:** `/src/lib/route-protection.ts` (NEW)
```typescript
import { UserRole } from './roles';

export interface RouteRule {
  pattern: string;
  allowedRoles: UserRole[];
  exact?: boolean;
  description?: string;
}

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

export function getRequiredRole(pathname: string): UserRole[] | null {
  // Sort routes by specificity (longer patterns first)
  const sortedRoutes = [...PROTECTED_ROUTES].sort((a, b) => b.pattern.length - a.pattern.length);

  for (const route of sortedRoutes) {
    if (route.exact) {
      if (pathname === route.pattern) {
        return route.allowedRoles;
      }
    } else {
      if (pathname === route.pattern || pathname.startsWith(route.pattern + '/')) {
        return route.allowedRoles;
      }
    }
  }

  return null;
}
```

**File:** `/src/lib/auth/authorization.ts` (NEW)
```typescript
'use server';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@/lib/roles';
import { cache } from 'react';

export const getSession = cache(async () => {
  return await auth();
});

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  return session;
}

export async function requireRole(requiredRole: UserRole) {
  const session = await requireAuth();
  if (session.user.role !== requiredRole) {
    redirect('/unauthorized');
  }
  return session;
}

export async function requireAnyRole(requiredRoles: UserRole[]) {
  const session = await requireAuth();
  if (!requiredRoles.includes(session.user.role)) {
    redirect('/unauthorized');
  }
  return session;
}

export async function canAccessResource(
  resourceOwnerId: string,
  adminBypass: boolean = true
): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  if (adminBypass && session.user.role === UserRole.ADMIN) {
    return true;
  }

  return session.user.id === resourceOwnerId;
}
```

#### 1.2 Update TypeScript Types

**File:** `/src/types/next-auth.d.ts` (MODIFY)
```typescript
import { UserRole } from '@/lib/roles';

declare module 'next-auth' {
  interface User {
    id: string;
    name: string | null;
    email: string;
    role: UserRole; // Changed from string to UserRole
    isActive?: boolean;
    tokenVersion?: number;
  }

  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string;
      role: UserRole; // Changed from string to UserRole
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole; // Changed from string to UserRole
    tokenVersion?: number;
  }
}
```

#### 1.3 Update Auth Configuration

**File:** `/src/auth.ts` (MODIFY)
```typescript
// Add import:
import { UserRole, parseUserRole } from '@/lib/roles';

// In authorize() function:
async authorize(credentials) {
  // ... existing validation ...

  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    return null;
  }

  // ✅ NEW: Check if user is active
  if (!user.isActive) {
    console.warn(`Inactive user login attempt: ${email}`);
    return null;
  }

  const isValidPassword = await verifyPassword(user.password, password);
  if (!isValidPassword) {
    return null;
  }

  // ✅ NEW: Parse and validate role
  const validRole = parseUserRole(user.role);
  if (!validRole) {
    console.error(`Invalid role in database: ${user.role} for user ${user.id}`);
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: validRole,
    tokenVersion: user.tokenVersion,
  };
}

// In jwt() callback:
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.role = user.role;
    token.tokenVersion = user.tokenVersion;
  }
  return token;
}

// In session() callback:
async session({ session, token }) {
  if (token && session.user) {
    session.user.id = token.id as string;
    session.user.role = token.role as UserRole; // Now typed correctly
  }
  return session;
}
```

### Phase 2: Database Layer (2 hours)

#### 2.1 Update Schema with Enum

**File:** `/src/db/schema.ts` (MODIFY)
```typescript
import { pgEnum, pgTable, /* ... existing imports ... */ } from 'drizzle-orm/pg-core';
import { UserRole } from '@/lib/roles';

// ✅ NEW: Create enum type
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'bereichsleiter',
  'bd_manager',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),

  // ✅ CHANGED: Use enum instead of varchar
  role: userRoleEnum('role').notNull().default('bd_manager'),

  isActive: boolean('is_active').notNull().default(true),

  // ✅ NEW: Add tokenVersion field
  tokenVersion: integer('token_version').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

#### 2.2 Create Migration

**File:** `/drizzle/0002_add_rbac_enums.sql` (NEW)
```sql
-- Step 1: Create pre-migration validation
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM users
  WHERE role NOT IN ('admin', 'bereichsleiter', 'bd_manager');

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % users have invalid role values', invalid_count;
  END IF;
END $$;

-- Step 2: Create enum type
CREATE TYPE user_role_enum AS ENUM ('admin', 'bereichsleiter', 'bd_manager');

-- Step 3: Add new columns
ALTER TABLE users ADD COLUMN role_new user_role_enum NOT NULL DEFAULT 'bd_manager';
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- Step 4: Migrate data
UPDATE users SET role_new = role::text::user_role_enum;

-- Step 5: Verify migration
DO $$
DECLARE
  migration_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migration_count
  FROM users
  WHERE role::text != role_new::text;

  IF migration_count > 0 THEN
    RAISE EXCEPTION 'Migration verification failed: % roles do not match', migration_count;
  END IF;
END $$;

-- Step 6: Drop old column and rename new
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN role_new TO role;

-- Step 7: Create index on tokenVersion for performance
CREATE INDEX idx_users_token_version ON users(token_version);
```

**File:** `/drizzle/rollback/0002_add_rbac_enums.sql` (NEW)
```sql
-- Rollback procedure (keep handy!)
BEGIN;

-- Add back old varchar column
ALTER TABLE users ADD COLUMN role_old varchar(50);

-- Copy data back
UPDATE users SET role_old = role::text;

-- Drop enum column
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users DROP COLUMN token_version;

-- Drop enum type
DROP TYPE user_role_enum;

-- Drop index
DROP INDEX IF EXISTS idx_users_token_version;

-- Rename old column
ALTER TABLE users RENAME COLUMN role_old TO role;

COMMIT;
```

#### 2.3 Create Validation Script

**File:** `/scripts/validate-role-data.ts` (NEW)
```typescript
import { db } from '@/src/db';
import { users } from '@/src/db/schema';

async function validateRoleData() {
  console.log('🔍 Validating role data before enum migration...');

  const allUsers = await db.select().from(users);
  const invalidUsers = allUsers.filter(
    (user) => !['admin', 'bereichsleiter', 'bd_manager'].includes(user.role)
  );

  if (invalidUsers.length > 0) {
    console.error('❌ INVALID ROLE VALUES FOUND:');
    invalidUsers.forEach((user) => {
      console.error(`  - User ${user.id}: email="${user.email}", role="${user.role}"`);
    });
    process.exit(1);
  }

  console.log('✅ All role values are valid');
  console.log(`   Checked ${allUsers.length} users`);
  process.exit(0);
}

validateRoleData().catch(console.error);
```

**Add to package.json:**
```json
{
  "scripts": {
    "db:validate:roles": "bun run scripts/validate-role-data.ts"
  }
}
```

### Phase 3: Middleware & Routes (3 hours)

#### 3.1 Refactor Middleware

**File:** `/src/middleware.ts` (REPLACE)
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getRequiredRole } from '@/lib/route-protection';
import { UserRole } from '@/lib/roles';

export default auth(async (req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const session = req.auth;
  const isLoggedIn = !!session?.user;

  // Public routes (no authentication required)
  const publicRoutes = ['/', '/login', '/register', '/api/auth'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    // Redirect authenticated users away from auth pages
    if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }
    return NextResponse.next();
  }

  // Check authentication
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ✅ NEW: Check tokenVersion for session invalidation
  if (session?.user?.tokenVersion !== undefined) {
    // TODO: Implement database check (Phase 5: DB integration)
    // For now, skip check to avoid DB query in middleware
  }

  // Check role-based access
  const requiredRoles = getRequiredRole(pathname);

  if (requiredRoles) {
    const userRole = session.user.role as UserRole;

    if (!requiredRoles.includes(userRole)) {
      // User doesn't have required role
      const isApiRoute = pathname.startsWith('/api');

      if (isApiRoute) {
        // Return 403 JSON for API routes
        return NextResponse.json(
          { error: 'Forbidden', message: 'Insufficient permissions' },
          { status: 403 }
        );
      } else {
        // Redirect to /unauthorized for page routes
        return NextResponse.redirect(
          new URL(`/unauthorized?required=${requiredRoles[0]}&current=${userRole}`, nextUrl)
        );
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
```

#### 3.2 Create Unauthorized Page

**File:** `/src/app/unauthorized/page.tsx` (NEW)
```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ROLE_DISPLAY_NAMES, UserRole } from '@/lib/roles';

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: { required?: string; current?: string };
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const requiredRole = searchParams.required as UserRole;
  const currentRole = session.user.role as UserRole;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Zugriff verweigert
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Sie haben nicht die erforderlichen Berechtigungen für diese Seite.
          </p>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Aktuelle Rolle:</span>{' '}
              {ROLE_DISPLAY_NAMES[currentRole] || currentRole}
            </p>
            {requiredRole && (
              <p className="text-sm text-blue-800 mt-1">
                <span className="font-semibold">Erforderliche Rolle:</span>{' '}
                {ROLE_DISPLAY_NAMES[requiredRole] || requiredRole}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <a
              href="/dashboard"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
            >
              Zurück zum Dashboard
            </a>
            <a
              href="/"
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
            >
              Zur Startseite
            </a>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <p>Falls Sie dies für einen Fehler halten, kontaktieren Sie bitte:</p>
            <a href="mailto:support@adesso.de" className="text-blue-600 hover:underline">
              support@adesso.de
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Phase 4: Server Components Integration (2 hours)

#### 4.1 Update Dashboard Page

**File:** `/src/app/dashboard/page.tsx` (MODIFY)
```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ROLE_DISPLAY_NAMES, UserRole } from '@/lib/roles';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const userRole = session.user.role as UserRole;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with role indicator */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Rolle: <span className="font-semibold">{ROLE_DISPLAY_NAMES[userRole]}</span>
              </span>
              <span className="text-sm text-gray-600">
                {session.user.email}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Role-specific content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {userRole === UserRole.ADMIN && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Sie haben Administrator-Zugriff. Sie können alle Bereiche verwalten.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard content here */}
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <p className="text-gray-500">Dashboard-Inhalte werden geladen...</p>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### Phase 5: Server Actions Protection (2 hours)

#### 5.1 Create Authorization Wrapper

**File:** `/src/lib/auth/server-action-wrapper.ts` (NEW)
```typescript
'use server';

import { headers } from 'next/headers';
import { auth } from '@/auth';
import { UserRole } from '@/lib/roles';

export async function withAuth<T>(
  handler: (userId: string, userRole: UserRole) => Promise<T>
): Promise<T> {
  const session = await auth();

  if (!session?.user) {
    throw new Error('UNAUTHORIZED');
  }

  return handler(session.user.id, session.user.role as UserRole);
}

export async function withRole<T>(
  requiredRole: UserRole,
  handler: (userId: string, userRole: UserRole) => Promise<T>
): Promise<T> {
  return withAuth(async (userId, userRole) => {
    if (userRole !== requiredRole) {
      throw new Error('FORBIDDEN');
    }
    return handler(userId, userRole);
  });
}

export async function withAnyRole<T>(
  requiredRoles: UserRole[],
  handler: (userId: string, userRole: UserRole) => Promise<T>
): Promise<T> {
  return withAuth(async (userId, userRole) => {
    if (!requiredRoles.includes(userRole)) {
      throw new Error('FORBIDDEN');
    }
    return handler(userId, userRole);
  });
}
```

#### 5.2 Example: Protected Admin Action

**File:** `/src/app/actions/admin/business-lines.ts` (NEW)
```typescript
'use server';

import { db } from '@/db';
import { businessLines } from '@/db/schema';
import { withRole, UserRole } from '@/lib/auth/server-action-wrapper';
import { revalidatePath } from 'next/cache';

export async function createBusinessLine(data: {
  name: string;
  leaderEmail: string;
}) {
  return withRole(UserRole.ADMIN, async (userId, userRole) => {
    // ✅ Authorization check complete - user is admin

    const [newBusinessLine] = await db
      .insert(businessLines)
      .values({
        name: data.name,
        leaderEmail: data.leaderEmail,
        createdBy: userId,
        createdAt: new Date(),
      })
      .returning();

    revalidatePath('/admin/business-lines');

    // Audit log
    console.log(`[AUDIT] User ${userId} (${userRole}) created business line ${newBusinessLine.id}`);

    return newBusinessLine;
  });
}
```

### Phase 6: Testing & Validation (4 hours)

#### 6.1 Create Automated Tests

**File:** `/src/lib/__tests__/roles.test.ts` (NEW)
```typescript
import { describe, it, expect } from 'vitest';
import { UserRole, parseUserRole, hasRoleHigherOrEqual } from '../roles';

describe('UserRole', () => {
  describe('parseUserRole', () => {
    it('should parse valid role values', () => {
      expect(parseUserRole('admin')).toBe(UserRole.ADMIN);
      expect(parseUserRole('bereichsleiter')).toBe(UserRole.BEREICHSLEITER);
      expect(parseUserRole('bd_manager')).toBe(UserRole.BD_MANAGER);
    });

    it('should reject invalid role values', () => {
      expect(parseUserRole('superadmin')).toBeNull();
      expect(parseUserRole('Admin')).toBeNull(); // Case sensitive
      expect(parseUserRole('')).toBeNull();
    });
  });

  describe('hasRoleHigherOrEqual', () => {
    it('should correctly compare role hierarchy', () => {
      expect(hasRoleHigherOrEqual(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
      expect(hasRoleHigherOrEqual(UserRole.ADMIN, UserRole.BEREICHSLEITER)).toBe(true);
      expect(hasRoleHigherOrEqual(UserRole.ADMIN, UserRole.BD_MANAGER)).toBe(true);

      expect(hasRoleHigherOrEqual(UserRole.BEREICHSLEITER, UserRole.ADMIN)).toBe(false);
      expect(hasRoleHigherOrEqual(UserRole.BEREICHSLEITER, UserRole.BEREICHSLEITER)).toBe(true);
      expect(hasRoleHigherOrEqual(UserRole.BEREICHSLEITER, UserRole.BD_MANAGER)).toBe(true);

      expect(hasRoleHigherOrEqual(UserRole.BD_MANAGER, UserRole.ADMIN)).toBe(false);
      expect(hasRoleHigherOrEqual(UserRole.BD_MANAGER, UserRole.BEREICHSLEITER)).toBe(false);
      expect(hasRoleHigherOrEqual(UserRole.BD_MANAGER, UserRole.BD_MANAGER)).toBe(true);
    });
  });
});
```

**File:** `/src/lib/__tests__/route-protection.test.ts` (NEW)
```typescript
import { describe, it, expect } from 'vitest';
import { getRequiredRole } from '../route-protection';
import { UserRole } from '../roles';

describe('getRequiredRole', () => {
  it('should return null for public routes', () => {
    expect(getRequiredRole('/')).toBeNull();
    expect(getRequiredRole('/login')).toBeNull();
    expect(getRequiredRole('/register')).toBeNull();
  });

  it('should require authentication for dashboard', () => {
    const result = getRequiredRole('/dashboard');
    expect(result).toEqual([UserRole.ADMIN, UserRole.BEREICHSLEITER, UserRole.BD_MANAGER]);
  });

  it('should require admin for admin routes', () => {
    expect(getRequiredRole('/admin')).toEqual([UserRole.ADMIN]);
    expect(getRequiredRole('/admin/business-lines')).toEqual([UserRole.ADMIN]);
    expect(getRequiredRole('/admin/employees')).toEqual([UserRole.ADMIN]);
  });

  it('should require admin or BL for BL routes', () => {
    expect(getRequiredRole('/bereichsleiter')).toEqual([UserRole.ADMIN, UserRole.BEREICHSLEITER]);
  });

  it('should handle sub-routes correctly', () => {
    expect(getRequiredRole('/admin/business-lines/123')).toEqual([UserRole.ADMIN]);
    expect(getRequiredRole('/dashboard/some-page')).toEqual([
      UserRole.ADMIN,
      UserRole.BEREICHSLEITER,
      UserRole.BD_MANAGER,
    ]);
  });

  it('should not match similar but different routes', () => {
    expect(getRequiredRole('/admin-test')).toBeNull();
    expect(getRequiredRole('/dashboardfake')).toBeNull();
  });
});
```

#### 6.2 Create E2E Tests

**File:** `/e2e/auth-004-rbac.spec.ts` (NEW)
```typescript
import { test, expect } from '@playwright/test';

test.describe('AUTH-004: Role-Based Access Control', () => {
  test.beforeEach(async ({ page }) => {
    // Reset database state before each test
    await page.goto('/api/test/reset');
  });

  test('BD Manager cannot access admin routes', async ({ page }) => {
    // Login as BD Manager
    await page.goto('/login');
    await page.fill('[name="email"]', 'bd@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');

    // Try to access admin
    await page.goto('/admin/business-lines');

    // Should redirect to unauthorized
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.locator('text=Zugriff verweigert')).toBeVisible();
    await expect(page.locator('text=BD Manager')).toBeVisible();
    await expect(page.locator('text=Administrator')).toBeVisible();
  });

  test('Admin can access admin routes', async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');

    // Can access admin
    await page.goto('/admin/business-lines');
    await expect(page.locator('h1')).toContainText('Business Lines');
  });

  test('API route returns 403 JSON for unauthorized access', async ({ page }) => {
    // Login as BD Manager
    await page.goto('/login');
    await page.fill('[name="email"]', 'bd@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Try to access admin API
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/admin/business-lines', { method: 'GET' });
        return { status: res.status, body: await res.json() };
      } catch (e) {
        return { error: (e as Error).message };
      }
    });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error', 'Forbidden');
  });

  test('Deactivated user cannot login', async ({ page }) => {
    // Try to login with deactivated account
    await page.goto('/login');
    await page.fill('[name="email"]', 'inactive@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('Role change invalidates session', async ({ page, context }) => {
    // Login as Admin on browser 1
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Simulate admin changing own role (via API call)
    await page.evaluate(async () => {
      await fetch('/api/test/change-role', {
        method: 'POST',
        body: JSON.stringify({ newRole: 'bd_manager' }),
      });
    });

    // Try to access admin route
    await page.goto('/admin/business-lines');

    // Should redirect to unauthorized (session invalidated)
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});
```

#### 6.3 Create Server Action Protection Test

**File:** `/scripts/check-server-actions.ts` (NEW)
```typescript
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

function findUnprotectedServerActions() {
  const actionsDir = join(process.cwd(), 'src/app/actions');
  const actionFiles = readdirSync(actionsDir, { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.ts'));

  const unprotected: string[] = [];

  for (const file of actionFiles) {
    const filePath = join(actionsDir, file);
    const content = readFileSync(filePath, 'utf-8');

    // Check if it's a server action
    if (!content.includes("'use server'")) {
      continue;
    }

    // Check if it performs mutations (INSERT, UPDATE, DELETE)
    const hasMutations =
      content.includes('.insert(') ||
      content.includes('.update(') ||
      content.includes('.delete(');

    if (!hasMutations) {
      continue; // Read-only actions don't require role checks
    }

    // Check if it has role protection
    const hasRoleCheck =
      content.includes('requireRole') ||
      content.includes('requirePermission') ||
      content.includes('withRole') ||
      content.includes('withAnyRole');

    if (!hasRoleCheck) {
      unprotected.push(filePath);
    }
  }

  return unprotected;
}

const unprotected = findUnprotectedServerActions();

if (unprotected.length > 0) {
  console.error('❌ UNPROTECTED SERVER ACTIONS FOUND:');
  unprotected.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
} else {
  console.log('✅ All server actions have role checks');
  process.exit(0);
}
```

**Add to package.json:**
```json
{
  "scripts": {
    "test:server-actions": "bun run scripts/check-server-actions.ts"
  }
}
```

---

## Acceptance Criteria

### Functional Requirements

#### Core Functionality

- [ ] **AC-001:** BD Manager can access /dashboard but not /admin/*
- [ ] **AC-002:** Bereichsleiter can access /dashboard and /bereichsleiter/* but not /admin/*
- [ ] **AC-003:** Admin can access /dashboard, /bereichsleiter/*, and /admin/*
- [ ] **AC-004:** Unauthenticated users redirected to /login for protected routes
- [ ] **AC-005:** API routes return 403 JSON for unauthorized access (not redirect)
- [ ] **AC-006:** Page routes redirect to /unauthorized with German error messages

#### Server Action Protection

- [ ] **AC-007:** All admin server actions require UserRole.ADMIN before execution
- [ ] **AC-008:** BD Manager cannot invoke admin server actions (CVE-2025-29927 fixed)
- [ ] **AC-009:** Server actions throw clear error messages for unauthorized access
- [ ] **AC-010:** Automated test verifies all server actions have role checks

#### Session Management

- [ ] **AC-011:** Deactivated users (isActive: false) cannot login
- [ ] **AC-012:** Role changes invalidate existing sessions via tokenVersion
- [ ] **AC-013:** Password changes invalidate existing sessions
- [ ] **AC-014:** Email changes invalidate existing sessions
- [ ] **AC-015:** Users see clear message when session invalidated: "Your permissions have changed"

#### Database & Migration

- [ ] **AC-016:** Database uses PostgreSQL enum for roles (not varchar)
- [ ] **AC-017:** Pre-migration validation script checks for invalid role values
- [ ] **AC-018:** Migration script includes atomic transaction (all-or-nothing)
- [ ] **AC-019:** Rollback script tested and documented
- [ ] **AC-020:** Migration verified in staging environment before production

#### Error Handling

- [ ] **AC-021:** Corrupted JWT tokens clear cookies and redirect to /login
- [ ] **AC-022:** Expired JWT tokens redirect to /login with "session expired" message
- [ ] **AC-023:** Database connection failure shows degraded mode warning
- [ ] **AC-024:** Invalid role values in database log error and fail secure
- [ ] **AC-025:** All auth errors logged with IP address and timestamp

#### UI/UX

- [ ] **AC-026:** Dashboard displays user's current role in header
- [ ] **AC-027:** /unauthorized page shows current role and required role
- [ ] **AC-028:** Navigation menu shows role-appropriate links only
- [ ] **AC-029:** Loading states shown during slow auth checks (> 100ms)

### Non-Functional Requirements

#### Performance

- [ ] **AC-030:** Middleware executes in < 10ms for 95% of requests
- [ ] **AC-031:** Authorization checks add < 5ms overhead to server actions
- [ ] **AC-032:** Cached roles (degraded mode) serve in < 2ms

#### Security

- [ ] **AC-033:** No magic string role comparisons (use UserRole enum)
- [ ] **AC-034:** All admin server actions protected with requireRole()
- [ ] **AC-035:** Token invalidation prevents privilege escalation
- [ ] **AC-036:** isActive field checked in authorize() function
- [ ] **AC-037:** Rate limiting applied to unauthorized attempts (10 req/10 sec)

#### Quality

- [ ] **AC-038:** Unit tests for role helper functions (parseUserRole, hasRoleHigherOrEqual)
- [ ] **AC-039:** Unit tests for route protection logic (getRequiredRole)
- [ ] **AC-040:** E2E tests for all 3 roles accessing protected routes
- [ ] **AC-041:** E2E test for deactivated user login attempt
- [ ] **AC-042:** E2E test for role change session invalidation
- [ ] **AC-043:** Automated test verifies no unprotected server actions

#### Maintainability

- [ ] **AC-044:** TypeScript types augmented correctly (UserRole instead of string)
- [ ] **AC-045:** PROTECTED_ROUTES configuration centralized in one file
- [ ] **AC-046:** Authorization utilities reusable across server actions
- [ ] **AC-047:** Code comments explain security decisions
- [ ] **AC-048:** Database migration documented with rollback procedure

### Quality Gates

- [ ] **AC-049:** All automated tests pass (unit + E2E)
- [ ] **AC-050:** Code review completed by senior developer
- [ ] **AC-051:** Security review completed (CVE-2025-29927 verified fixed)
- [ ] **AC-052:** Migration tested in staging environment
- [ ] **AC-053:** Rollback procedure tested and documented
- [ ] **AC-054:** Performance benchmarks met (< 10ms middleware)

---

## Success Metrics

### Security Metrics

- **Vulnerability Fix:** CVE-2025-29927 resolved (no unprotected server actions)
- **Authorization Coverage:** 100% of admin server actions have role checks
- **Type Safety:** 0 magic string role comparisons
- **Migration Success:** 0 data loss incidents during enum migration

### Performance Metrics

- **Middleware Latency:** P95 < 10ms (measured with 1000 req/s load test)
- **Authorization Overhead:** < 5ms per server action
- **Degraded Mode Cache Hit Rate:** > 95% during DB outage simulation

### Quality Metrics

- **Test Coverage:** > 90% for authorization logic
- **E2E Test Pass Rate:** 100% (6 critical scenarios)
- **TypeScript Errors:** 0 (strict mode enabled)

### UX Metrics

- **Unauthorized Page Clarity:** Users understand why access denied
- **Error Message Quality:** All auth errors have clear German messages
- **Role Change Experience:** Users re-authenticate successfully after session invalidation

---

## Dependencies & Prerequisites

### Completed Features (Blocking AUTH-004)

- ✅ **AUTH-001:** User Registration
- ✅ **AUTH-002:** User Login
- ✅ **AUTH-003:** User Logout
- ✅ NextAuth.js v5 configured
- ✅ Database schema with users table
- ✅ Password hashing with Argon2id

### External Dependencies

- **PostgreSQL 15+**: Supports ENUM types
- **Drizzle ORM**: For schema migrations
- **Vitest**: For unit tests
- **Playwright**: For E2E tests
- **Redis (optional)**: For degraded mode caching

### Technical Prerequisites

- **Node.js 18+**: Required for Drizzle ORM
- **Bun**: Package manager
- **Git clean working directory**: For migration rollback testing

### Knowledge Prerequisites

- **NextAuth.js v5**: Understanding of callbacks and JWT strategy
- **PostgreSQL**: Knowledge of ENUM types and migrations
- **TypeScript**: Proficiency with module augmentation
- **RBAC concepts**: Understanding of role hierarchy and permissions

---

## Risk Analysis & Mitigation

### Risk 1: Migration Failure in Production (🔴 CRITICAL)

**Impact:** Database corruption, data loss, system downtime

**Probability:** Medium (15%)

**Mitigation Strategy:**
1. **Pre-migration validation script** catches invalid data BEFORE running migration
2. **Atomic transaction** ensures all-or-nothing (partial changes rolled back)
3. **Backup verification** - confirm backup file exists and is valid
4. **Staging test** - run migration in staging first
5. **Rollback script tested** - verify rollback procedure works

**Rollback Procedure:**
```bash
# If migration fails:
1. Stop application: systemctl stop dealhunter
2. Restore database: psql dealhunter < backup_YYYYMMDD.sql
3. Verify integrity: bun run db:validate:roles
4. Start application: systemctl start dealhunter
5. File incident report
```

**Success Criteria:** Migration tested in staging, rollback verified

---

### Risk 2: JWT Stale Window (🟡 HIGH)

**Impact:** Users retain old permissions for up to 30 days after role change

**Probability:** High (100% - design limitation)

**Mitigation Strategy:**
1. **tokenVersion mechanism** invalidates sessions on role change
2. **User notification** - clear message when session invalidated
3. **Admin confirmation** - warn admin that sessions will be invalidated
4. **Document limitation** - add comment in auth.ts explaining 30-day window

**Known Limitation:**
```typescript
// auth.ts
// NOTE: JWT tokens expire after 30 days. Role changes take effect immediately
// for new logins, but existing sessions retain old permissions until:
// 1. Token expires naturally
// 2. tokenVersion incremented (role, email, password changes)
// This is a trade-off between security (DB validation on every request)
// and performance (cookie-based session checks in middleware)
```

**Success Criteria:** Token invalidation works correctly, users can re-authenticate

---

### Risk 3: Server Action Authorization Gaps (🔴 CRITICAL)

**Impact:** Security breach, unauthorized data mutations

**Probability:** Medium (20% - human error)

**Mitigation Strategy:**
1. **Automated test** - script checks all server actions for role checks
2. **Code review checklist** - reviewers must verify authorization
3. **CI/CD gate** - automated test blocks PRs with unprotected actions
4. **Security audit** - manual review before deployment

**Detection Script:**
```bash
# Run in CI/CD pipeline
bun run test:server-actions
# Fails if any server action missing requireRole()
```

**Success Criteria:** Automated test passes (0 unprotected actions)

---

### Risk 4: Database Connection Failures (🟡 HIGH)

**Impact:** Users cannot login during outage

**Probability:** Low (5% - managed database)

**Mitigation Strategy:**
1. **Redis cache** - cache roles with 5-min TTL
2. **Graceful degradation** - read-only mode with warning banner
3. **Database retries** - 3 retry attempts with exponential backoff
4. **Monitoring** - alert on connection failures

**Degraded Mode Behavior:**
```typescript
try {
  const user = await db.query.users.findFirst(...)
  return user.role
} catch (error) {
  if (error.code === 'CONNECTION_ERROR') {
    const cached = await redis.get(`user:role:${userId}`)
    if (cached) {
      return { role: cached.role, degraded: true }
    }
  }
  throw error
}
```

**Success Criteria:** System functions in read-only mode during DB outage

---

### Risk 5: Corrupted JWT Tokens (🟠 MEDIUM)

**Impact:** Users unable to access application

**Probability:** Low (2% - browser bugs, tampering)

**Mitigation Strategy:**
1. **Try-catch JWT decode** - catch malformed tokens
2. **Clear cookies** - remove corrupted cookie
3. **Redirect to /login** - user re-authenticates
4. **Log security events** - track potential attacks

**Error Handling:**
```typescript
// In middleware
try {
  const session = await auth()
} catch (error) {
  if (error.code === 'JWT_MALFORMED') {
    await logSecurityEvent({ type: 'JWT_CORRUPTED', ip: req.ip })
    cookies().delete('next-auth.session-token')
    return NextResponse.redirect(new URL('/login?error=invalid_session', req.url))
  }
  throw error
}
```

**Success Criteria:** Corrupted tokens handled gracefully, users can re-login

---

### Risk 6: Breaking Existing Functionality (🟡 HIGH)

**Impact:** Regression bugs, user complaints

**Probability:** Medium (10% - schema changes)

**Mitigation Strategy:**
1. **Comprehensive E2E tests** - 6 critical scenarios
2. **Feature flags** - can disable RBAC if critical bug found
3. **Gradual rollout** - enable for 10% of users first
4. **Monitoring** - track error rates after deployment

**Rollback Plan:**
```bash
# If critical bug found:
1. Revert migration: psql dealhunter < rollback.sql
2. Revert code: git revert <commit-hash>
3. Redeploy: bun run deploy
4. Investigate and fix bug
5. Re-deploy fix
```

**Success Criteria:** All existing auth features still work (login, logout, registration)

---

## Implementation Phases

### Phase 1: Foundation (3 hours)

**Tasks:**
1. Create `/src/lib/roles.ts` with UserRole enum and helpers
2. Create `/src/lib/route-protection.ts` with PROTECTED_ROUTES config
3. Create `/src/lib/auth/authorization.ts` with requireRole utilities
4. Update `/src/types/next-auth.d.ts` to use UserRole enum
5. Update `/src/auth.ts` to use UserRole enum and check isActive

**Success Criteria:**
- [ ] UserRole enum defined with 3 values
- [ ] PROTECTED_ROUTES configuration protects all admin routes
- [ ] TypeScript compiles without errors
- [ ] isActive check added to authorize() function

**Files Modified:** 5
**Files Created:** 3

---

### Phase 2: Database Layer (2 hours)

**Tasks:**
1. Update `/src/db/schema.ts` with userRoleEnum and tokenVersion field
2. Create migration SQL: `/drizzle/0002_add_rbac_enums.sql`
3. Create rollback SQL: `/drizzle/rollback/0002_add_rbac_enums.sql`
4. Create validation script: `/scripts/validate-role-data.ts`
5. Run validation script against current database
6. Test migration in development environment

**Success Criteria:**
- [ ] Schema updated with enum type
- [ ] Migration script includes validation, enum creation, data migration, verification
- [ ] Rollback script tested successfully
- [ ] Validation script passes on current database

**Files Modified:** 1
**Files Created:** 3

**Risk Mitigation:**
- Run validation script BEFORE migration
- Test rollback in development
- Create database backup before running migration

---

### Phase 3: Middleware & Routes (3 hours)

**Tasks:**
1. Refactor `/src/middleware.ts` to use PROTECTED_ROUTES config
2. Implement tokenVersion check (Phase 5: DB integration)
3. Create `/src/app/unauthorized/page.tsx` with German error messages
4. Test middleware with all 3 roles
5. Test API route 403 responses
6. Test page route redirects to /unauthorized

**Success Criteria:**
- [ ] Middleware uses PROTECTED_ROUTES config (no hardcoded roles)
- [ ] BD Manager redirected to /unauthorized when accessing /admin
- [ ] Admin can access /admin routes
- [ ] API routes return 403 JSON (not redirect)
- [ ] /unauthorized page shows current and required roles

**Files Modified:** 1
**Files Created:** 1

---

### Phase 4: Server Components Integration (2 hours)

**Tasks:**
1. Update `/src/app/dashboard/page.tsx` to display user role
2. Add role-based UI components (admin-specific sections)
3. Test dashboard renders correctly for all 3 roles
4. Add loading states for slow auth checks

**Success Criteria:**
- [ ] Dashboard shows user's current role in header
- [ ] Admin sees admin-specific content
- [ ] BD Manager sees appropriate dashboard
- [ ] Loading states appear for slow checks (> 100ms)

**Files Modified:** 1
**Files Created:** 0

---

### Phase 5: Server Actions Protection (2 hours)

**Tasks:**
1. Create `/src/lib/auth/server-action-wrapper.ts` with withRole helper
2. Create example admin action: `/src/app/actions/admin/business-lines.ts`
3. Update all existing server actions to use requireRole()
4. Create automated test: `/scripts/check-server-actions.ts`
5. Run test to verify all actions protected

**Success Criteria:**
- [ ] withRole helper function created
- [ ] Example admin action uses withRole(UserRole.ADMIN)
- [ ] Automated test passes (0 unprotected actions)
- [ ] CVE-2025-29927 verified fixed

**Files Modified:** 0 (existing actions to be updated later)
**Files Created:** 2

---

### Phase 6: Testing & Validation (4 hours)

**Tasks:**
1. Create unit tests: `/src/lib/__tests__/roles.test.ts`
2. Create unit tests: `/src/lib/__tests__/route-protection.test.ts`
3. Create E2E tests: `/e2e/auth-004-rbac.spec.ts`
4. Run all tests and verify they pass
5. Perform manual testing with all 3 roles
6. Test migration rollback procedure
7. Performance test middleware (< 10ms)

**Success Criteria:**
- [ ] All unit tests pass (10+ test cases)
- [ ] All E2E tests pass (6+ scenarios)
- [ ] Manual testing confirms all acceptance criteria met
- [ ] Migration rollback tested successfully
- [ ] Middleware latency < 10ms (P95)

**Files Modified:** 0
**Files Created:** 3

---

## Alternative Approaches Considered

### Approach 1: Permission-Based Authorization (REJECTED)

**Description:** Assign individual permissions (e.g., 'business_lines:create', 'users:delete') to roles instead of protecting routes.

**Pros:**
- More granular control
- Easier to add new permissions

**Cons:**
- ❌ More complex for MVP (need permission management UI)
- ❌ Harder to reason about (which roles have which permissions?)
- ❌ More database queries (check multiple permissions per request)

**Decision:** Route-based protection is simpler and sufficient for MVP. Permission-based can be added later if needed.

---

### Approach 2: Database Session Strategy (REJECTED)

**Description:** Store sessions in database instead of JWT, query database on every request for role verification.

**Pros:**
- ✅ Immediate role changes (no stale window)
- ✅ Can revoke sessions instantly

**Cons:**
- ❌ Slower performance (DB query on every request)
- ❌ More database load
- ❌ SPOF if database down

**Decision:** JWT strategy with tokenVersion is better balance of security and performance. Database sessions can be considered later if immediate invalidation becomes critical.

---

### Approach 3: Decorator Pattern for Server Actions (REJECTED)

**Description:** Use TypeScript decorators to add authorization to server actions.

**Pros:**
- Declarative syntax
- Less boilerplate

**Cons:**
- ❌ TypeScript decorators are experimental
- ❌ Harder to debug
- ❌ Not well-supported in Next.js 15

**Decision:** Function-based wrappers (withRole, requireRole) are more reliable and easier to understand.

---

## Future Considerations

### Phase 7: Enhanced Security (Post-MVP)

**Token Refresh on Every Request:**
- Query database on every request to verify role
- Use Redis cache to reduce DB load
- Eliminate JWT stale window entirely

**Implement When:**
- Compliance requires immediate permission revocation
- System scales to 1000+ concurrent users
- Database performance is not a bottleneck

---

### Phase 8: Permission-Based Authorization (Post-MVP)

**Add Permission System:**
```typescript
export const PERMISSIONS = {
  'business_lines:create': [UserRole.ADMIN],
  'business_lines:update': [UserRole.ADMIN],
  'bids:create': [UserRole.BD_MANAGER, UserRole.ADMIN],
  'bids:update:own': [UserRole.BD_MANAGER, UserRole.BEREICHSLEITER, UserRole.ADMIN],
  // ...
};
```

**Implement When:**
- Need fine-grained control beyond routes
- Multiple roles per user
- Complex permission inheritance

---

### Phase 9: Multi-Factor Authentication (Post-MVP)

**Add MFA for Admins:**
- Require TOTP app for admin login
- SMS verification for sensitive operations
- Hardware key (YubiKey) support

**Implement When:**
- Handling sensitive data (GDPR compliance)
- High-value targets (admin accounts)
- Regulatory requirements

---

## Documentation Plan

### Technical Documentation

**Update CLAUDE.md:**
```markdown
## Role-Based Access Control

### Roles
- **BD Manager**: Can create bids, view own data
- **Bereichsleiter**: Can review bids, assign teams
- **Admin**: Full system access

### Protected Routes
- `/dashboard` - All authenticated users
- `/admin/*` - Admin only
- `/bereichsleiter/*` - BL + Admin

### Server Action Authorization
```typescript
import { withRole, UserRole } from '@/lib/auth/server-action-wrapper';

export async function adminAction() {
  return withRole(UserRole.ADMIN, async (userId, userRole) => {
    // Action logic here
  });
}
```

### Database Migration
- See: `/drizzle/0002_add_rbac_enums.sql`
- Rollback: `/drizzle/rollback/0002_add_rbac_enums.sql`
- Validate: `bun run db:validate:roles`
```

---

### API Documentation

**Update API.md:**
```markdown
## Authentication & Authorization

### Protected Routes
All routes starting with `/admin` require admin role.

### API Responses

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```
```

---

### User Documentation

**Create `/docs/user-guide-roles.md`:**
```markdown
# Benutzerrollen im Dealhunter System

## BD Manager
- Can create new bid opportunities
- Can view own dashboard
- Cannot access admin functions

## Bereichsleiter
- Can review assigned bids
- Can assign teams
- Can access inbox

## Administrator
- Full system access
- Can manage business lines
- Can manage employees
- Can view analytics
```

---

## References & Research

### Internal References

**Architecture Decisions:**
- NextAuth.js v5 chosen for JWT performance: `/CLAUDE.md`
- Agent Native architecture: `/CLAUDE.md`
- Database schema: `/src/db/schema.ts`

**Related Features:**
- AUTH-001: User Registration (completed)
- AUTH-002: User Login (completed)
- AUTH-003: User Logout (completed)
- ADMIN-001 through ADMIN-006 (blocked on AUTH-004)

**Current Implementation:**
- NextAuth config: `/src/auth.ts:46-75`
- Middleware: `/src/middleware.ts:1-37`
- Database schema: `/src/db/schema.ts:8`

---

### External References

**Official Documentation:**
| Resource | URL | Relevance |
|----------|-----|-----------|
| Next.js 15 Middleware | https://nextjs.org/docs/app/building-your-application/routing/middleware | Route protection |
| NextAuth.js v5 RBAC | https://authjs.dev/guides/role-based-access-control | Role management |
| NextAuth.js TypeScript | https://authjs.dev/getting-started/typescript | Type augmentation |
| Drizzle ORM Enums | https://orm.drizzle.team/docs/schema-postgresql#enum | PostgreSQL enums |
| OWASP Access Control | https://owasp.org/www-community/Access_Control | Security best practices |

**Security Resources:**
- CVE-2025-29927: Missing Server Action Authorization
- OWASP Broken Access Control: https://owasp.org/www-project-web-security-testing-guide/
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

**Community Best Practices:**
- Clerk RBAC Guide (2025): https://clerk.com/blog/nextjs-role-based-access-control
- Medium - RBAC in Next.js: https://medium.com/@nakiboddin.saiyad/role-based-access-control-rbac-in-next-js-projects-93addde77b16

---

### Related Work

**Previous PRs:**
- feat: implement user registration (AUTH-001)
- feat: implement user login (AUTH-002)
- feat: implement user logout (AUTH-003)

**Related Issues:**
- CVE-2025-29927: Fix server action authorization vulnerability
- Issue #42: Implement RBAC system

**Design Documents:**
- `/SPEC.md` - Complete MVP specification
- `/FEATURES.json` - 75+ testable features

---

## Post-Generation Options

**Plan created at:** `plans/feat-auth-004-role-based-access-control.md`

**What would you like to do next?**

1. **Open plan in editor** - Review the plan file
2. **Run `/deepen-plan`** - Enhance each section with parallel research agents (best practices, performance, UI)
3. **Run `/plan_review`** - Get feedback from reviewers (DHH, Kieran, Simplicity, Architecture)
4. **Start `/workflows:work`** - Begin implementing this plan locally
5. **Simplify** - Reduce detail level (choose: MINIMAL or MORE)

---

**Status:** 🔳 Ready for implementation
**Estimated Completion:** 16 hours (2 days)
**Dependencies:** All previous AUTH features completed ✅
**Blockers:** None - ready to start
