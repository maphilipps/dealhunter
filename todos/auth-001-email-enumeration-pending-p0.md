# P0: Fix Email Enumeration Vulnerability

**Status:** pending
**Priority:** P0 (Critical - Blocks Production)
**Feature:** AUTH-001
**File:** src/app/actions/auth.ts:49-55

## Problem

The registration flow reveals whether an email address is registered through:

1. **Different error messages:**
   - Email exists → "Email already registered"
   - Other error → "An error occurred during registration"

2. **Timing differences:**
   - Existing email → Fast response (no password hashing)
   - New email → Slower response (Argon2id hashing ~100-200ms)

**Attack scenario:** Attackers can enumerate registered user emails by timing the response or observing error messages, enabling targeted phishing or account takeover attempts.

## Solution

### Generic Error Messages
```typescript
// Instead of specific "Email already registered"
return {
  errors: {
    _form: ['Registration failed. Please try again or contact support.']
  }
}
```

### Consistent Timing
```typescript
const startTime = Date.now()
const MIN_RESPONSE_TIME = 200 // Match hash operation time

try {
  // Registration logic
} catch (error) {
  // Add delay to match successful registration timing
  const elapsed = Date.now() - startTime
  if (elapsed < MIN_RESPONSE_TIME) {
    await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed))
  }
  return generic error
}
```

### Alternative: Always Hash (Simpler)
```typescript
const hashedPassword = await hashPassword(password)

const existingUser = await db.select()...
if (existingUser.length > 0) {
  return { errors: { _form: ['Registration failed'] } }
}

await db.insert(users).values({ ..., password: hashedPassword })
```

## Acceptance Criteria

- [ ] All registration errors return generic message
- [ ] Response timing is consistent (±10ms) regardless of email existence
- [ ] Test with existing vs non-existing emails
- [ ] Document the timing defense in code comments

## References

- OWASP: User Enumeration
- CWE-204: Observable Response Discrepancy
