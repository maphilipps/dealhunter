# P1: Verify CSRF Protection for Server Actions

**Status:** pending
**Priority:** P1 (Important - Should Fix Before Production)
**Feature:** AUTH-001
**File:** src/app/actions/auth.ts

## Problem

Server Actions are vulnerable to CSRF attacks if not properly protected. While Next.js 15 has built-in CSRF protection for Server Actions, we need to verify it's enabled and working correctly.

**Attack scenario:** Malicious site tricks authenticated user into submitting registration form, potentially creating unauthorized accounts.

## Current State

Next.js 15 automatically protects Server Actions with:
- Origin header validation
- CSRF token validation (when using forms)

However, we should verify this protection is active.

## Solution

### 1. Verify Next.js CSRF Protection is Active

Check that the form is using proper Server Action invocation:

```typescript
// ✅ Correct - Protected by Next.js
<form action={formAction}>

// ❌ Wrong - Not protected
<form onSubmit={(e) => { fetch('/api/register', ...) }}>
```

Our code already uses the correct pattern (src/app/register/page.tsx:25).

### 2. Add Explicit Origin Check (Defense in Depth)

```typescript
// src/app/actions/auth.ts
import { headers } from 'next/headers'

export async function registerUser(...) {
  const headersList = await headers()
  const origin = headersList.get('origin')
  const host = headersList.get('host')

  if (origin && !origin.includes(host ?? '')) {
    return {
      errors: {
        _form: ['Invalid request origin']
      }
    }
  }

  // ... rest of registration logic
}
```

### 3. Test CSRF Protection

Create test that attempts CSRF attack:

```typescript
// test/auth.csrf.test.ts
test('registration blocks CSRF attack', async () => {
  const response = await fetch('http://localhost:3000/register', {
    method: 'POST',
    headers: {
      'Origin': 'https://evil-site.com',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'email=attacker@example.com&password=Test123'
  })

  expect(response.status).toBe(403) // or appropriate error
})
```

## Acceptance Criteria

- [ ] Verify form uses Server Action (not fetch/axios)
- [ ] Add explicit origin validation for defense in depth
- [ ] Test CSRF attack scenario
- [ ] Document CSRF protection mechanism
- [ ] Ensure proper error handling for CSRF violations

## References

- Next.js 15: Server Actions Security
- OWASP: CSRF Prevention Cheat Sheet
- Next.js headers() API
