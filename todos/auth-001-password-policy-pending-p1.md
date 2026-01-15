# P1: Strengthen Password Policy

**Status:** pending
**Priority:** P1 (Important - Should Fix Before Production)
**Feature:** AUTH-001
**File:** src/lib/validations/auth.ts

## Problem

Current password validation is weak:

```typescript
password: z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number')
```

**Missing requirements:**
1. No lowercase requirement (user could use "PASSWORD1" - all caps)
2. No special character requirement
3. No maximum length (DoS vector - Argon2id on 10MB password = server crash)
4. No check against common passwords (Have I Been Pwned)
5. No check against user data (email username as password)

## OWASP 2025 Recommendations

- Min 8 characters ✅ (we have this)
- Max 64-128 characters ❌ (we're missing this - CRITICAL for DoS)
- Mix of character types ⚠️ (we have uppercase + number, missing lowercase + special)
- Not in breach database ❌ (we're missing this)
- Not similar to username/email ❌ (we're missing this)

## Solution

### Updated Zod Schema
```typescript
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
    .max(128, 'Password must not exceed 128 characters') // DoS protection
    .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least 1 special character'),
  confirmPassword: z.string()
})
.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
})
.refine((data) => {
  // Don't allow email username as password
  const emailUsername = data.email.split('@')[0].toLowerCase()
  return !data.password.toLowerCase().includes(emailUsername)
}, {
  message: "Password cannot contain your email address",
  path: ['password']
})
```

### Optional: Have I Been Pwned Integration (P2 - Nice to have)
```typescript
import crypto from 'crypto'

async function isPasswordPwned(password: string): Promise<boolean> {
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
  const text = await response.text()

  return text.includes(suffix)
}

// In Server Action
if (await isPasswordPwned(password)) {
  return {
    errors: {
      password: ['This password has been exposed in a data breach. Please choose a different password.']
    }
  }
}
```

## UI Updates Needed

Update password hint in src/app/register/page.tsx:73-75:

```typescript
<p className="text-xs text-muted-foreground">
  Min 8 characters, max 128, with uppercase, lowercase, number, and special character
</p>
```

## Acceptance Criteria

- [ ] Add maximum length (128 characters)
- [ ] Require lowercase letter
- [ ] Require special character
- [ ] Prevent email username in password
- [ ] Update UI hint text
- [ ] Test with various password combinations
- [ ] (Optional) Integrate Have I Been Pwned API

## References

- OWASP: Authentication Cheat Sheet
- NIST SP 800-63B: Digital Identity Guidelines
- Have I Been Pwned API: https://haveibeenpwned.com/API/v3#PwnedPasswords
