# P0: Fix TOCTOU Race Condition in User Registration

**Status:** pending
**Priority:** P0 (Critical - Blocks Production)
**Feature:** AUTH-001
**File:** src/app/actions/auth.ts:43-66

## Problem

The current registration flow uses a check-then-insert pattern that creates a race condition:

```typescript
// 1. Check if user exists
const existingUser = await db.select()...
if (existingUser.length > 0) { return error }

// 2. Insert user (race window here)
await db.insert(users).values(...)
```

**Attack scenario:** Two simultaneous registration requests with the same email can both pass the existence check before either inserts the user, resulting in duplicate records or database constraint violations.

## Solution Options

### Option A: Database Unique Constraint (Recommended)
```typescript
try {
  await db.insert(users).values({ name, email, password: hashedPassword, role: 'bd_manager' })
} catch (error) {
  if (error.code === '23505') { // PostgreSQL unique violation
    return { errors: { email: ['Email already registered'] } }
  }
  throw error
}
```

### Option B: Use ON CONFLICT
```typescript
const result = await db
  .insert(users)
  .values({ name, email, password: hashedPassword, role: 'bd_manager' })
  .onConflictDoNothing({ target: users.email })
  .returning()

if (result.length === 0) {
  return { errors: { email: ['Email already registered'] } }
}
```

## Acceptance Criteria

- [ ] Remove the separate existence check query
- [ ] Handle unique constraint violations properly
- [ ] Test with concurrent registration requests
- [ ] Verify error message is user-friendly

## References

- OWASP: Race Conditions
- PostgreSQL error code 23505 (unique_violation)
