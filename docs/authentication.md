# Authentication (NextAuth v5)

## Overview

Dealhunter nutzt **NextAuth v5 (beta)** - auch bekannt als Auth.js.

**Version:** `^5.0.0-beta.30` (production-ready trotz beta-Tag)

---

## Configuration

### Auth Routes

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Validate credentials
        const user = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, credentials.email)
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role;
      }
      return session;
    }
  }
});

export { handlers as GET, handlers as POST };
```

---

## Protected Routes

### Middleware (empfohlen)

```typescript
// middleware.ts
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth');

  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

### Server Components

```typescript
// app/(dashboard)/bids/page.tsx
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

export default async function BidsPage() {
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      {/* ... */}
    </div>
  );
}
```

### Server Actions

```typescript
// lib/bids/actions.ts
'use server';

import { auth } from '@/app/api/auth/[...nextauth]/route';
import { z } from 'zod';

export async function createBid(formData: FormData) {
  const session = await auth();

  if (!session) {
    return { error: 'Unauthorized' };
  }

  // Validate & process...
  return { success: true, bidId: '...' };
}
```

---

## Session Management

### Client Components

```typescript
// components/user-menu.tsx
'use client';

import { useSession, signOut } from 'next-auth/react';

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <a href="/auth/login">Login</a>;
  }

  return (
    <div>
      <span>{session.user.email}</span>
      <button onClick={() => signOut()}>Logout</button>
    </div>
  );
}
```

### Session Provider

```typescript
// app/layout.tsx
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

## Role-Based Access Control (RBAC)

### Database Schema

```typescript
// lib/db/schema.ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name'),
  role: text('role', { 
    enum: ['admin', 'bd_manager', 'analyst', 'viewer'] 
  }).default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

### Authorization Helper

```typescript
// lib/auth/authorization.ts
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function requireRole(roles: string[]) {
  const session = await auth();

  if (!session) {
    throw new Error('Unauthorized');
  }

  if (!roles.includes(session.user.role)) {
    throw new Error('Forbidden');
  }

  return session;
}

// Usage in Server Action:
export async function deleteAccount(id: string) {
  await requireRole(['admin']);
  
  // Admin-only logic...
}
```

---

## Password Hashing

```typescript
// lib/auth/password.ts
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

---

## Environment Variables

```bash
# Auto-generated by NextAuth
AUTH_SECRET=                    # Generate: openssl rand -base64 32
AUTH_URL=http://localhost:3000  # Production: https://dealhunter.adesso.de
```

---

## Login Flow

1. User navigiert zu `/auth/login`
2. Form submit → Server Action
3. NextAuth validates credentials via `authorize()`
4. Bei Erfolg: Session erstellt, JWT Token generiert
5. Redirect zu `/dashboard`
6. Middleware prüft alle nachfolgenden Requests

---

## Testing Authentication

### Unit Tests

```typescript
// lib/auth/__tests__/password.test.ts
import { hashPassword, verifyPassword } from '../password';

test('should hash and verify password', async () => {
  const password = 'test123';
  const hash = await hashPassword(password);

  expect(await verifyPassword(password, hash)).toBe(true);
  expect(await verifyPassword('wrong', hash)).toBe(false);
});
```

### E2E Tests

```typescript
// e2e/authentication.spec.ts
import { test, expect } from '@playwright/test';

test('should login and access dashboard', async ({ page }) => {
  await page.goto('/auth/login');

  await page.fill('[name="email"]', 'test@adesso.de');
  await page.fill('[name="password"]', 'test123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

---

## Security Best Practices

### DO ✅

- Nutze bcrypt mit mindestens 12 rounds
- Validiere Credentials mit Zod
- Rate Limiting für Login-Versuche (future)
- HTTPS in Production (AUTH_URL)
- Sichere SESSION_SECRET

### DON'T ❌

- Passwörter im Plaintext speichern
- Auth Logic in Client Components
- Session Tokens in LocalStorage
- Default/weak AUTH_SECRET

---

## Migration von NextAuth v4

**Breaking Changes:**
- `useSession()` braucht jetzt `SessionProvider`
- `getSession()` → `auth()`
- Config in `route.ts` statt `pages/api/auth/[...nextauth].ts`

---

## Troubleshooting

**Problem:** "Invalid session token"
```bash
# AUTH_SECRET fehlt oder falsch
echo $AUTH_SECRET
openssl rand -base64 32
```

**Problem:** Redirect Loop
```typescript
// Middleware: Überprüfe matcher config
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

**Problem:** Session nicht verfügbar in Server Components
```typescript
// Importiere auth aus richtigem Pfad
import { auth } from '@/app/api/auth/[...nextauth]/route';
```

---

## Useful Links

- [NextAuth v5 Docs](https://authjs.dev/)
- [Migration Guide](https://authjs.dev/getting-started/migrating-to-v5)
- [Providers](https://authjs.dev/getting-started/providers)
