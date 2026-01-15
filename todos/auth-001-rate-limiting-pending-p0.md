# P0: Add Rate Limiting for Registration

**Status:** pending
**Priority:** P0 (Critical - Blocks Production)
**Feature:** AUTH-001
**File:** src/app/actions/auth.ts (entire action needs rate limiting)

## Problem

The registration endpoint has no rate limiting, exposing the application to:

1. **Brute force attacks:** Attackers can attempt thousands of registrations
2. **DoS attacks:** Mass registration requests can overwhelm the database and Argon2id hashing (CPU-intensive)
3. **Email spam:** Automated scripts can create spam accounts
4. **Resource exhaustion:** Each registration triggers expensive password hashing

## Solution Options

### Option A: Next.js Middleware + upstash/ratelimit (Recommended)
```typescript
// src/middleware.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 registrations per hour per IP
  analytics: true
})

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/register') {
    const ip = request.ip ?? '127.0.0.1'
    const { success } = await ratelimit.limit(ip)
    if (!success) {
      return new Response('Too many requests', { status: 429 })
    }
  }
  // ... rest of middleware
}
```

### Option B: Simple in-memory rate limiting (MVP fallback)
```typescript
// lib/rate-limit.ts
const attempts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(identifier: string, maxAttempts = 3, windowMs = 3600000): boolean {
  const now = Date.now()
  const record = attempts.get(identifier)

  if (!record || now > record.resetAt) {
    attempts.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= maxAttempts) {
    return false
  }

  record.count++
  return true
}
```

### Option C: Server Action level
```typescript
export async function registerUser(prevState: RegisterFormState, formData: FormData) {
  const email = formData.get('email') as string

  if (!checkRateLimit(email, 3, 3600000)) {
    return {
      errors: {
        _form: ['Too many registration attempts. Please try again later.']
      }
    }
  }

  // ... rest of registration logic
}
```

## Recommended Limits

- **Per IP:** 3 registrations per hour
- **Per email:** 5 attempts per hour (includes failed attempts)
- **Global:** 100 registrations per minute (DoS protection)

## Acceptance Criteria

- [ ] Rate limiting implemented at middleware level
- [ ] 429 status returned when limit exceeded
- [ ] User-friendly error message shown
- [ ] Rate limit counters reset after time window
- [ ] Test with rapid registration attempts
- [ ] Document rate limit policy

## Dependencies

```bash
bun add @upstash/ratelimit @upstash/redis
```

Or for MVP: Use in-memory solution (no dependencies)

## References

- OWASP: Denial of Service
- Next.js Middleware: Rate Limiting patterns
