# P1: Fix Incorrect Redirect Pattern in Server Action

**Status:** pending
**Priority:** P1 (Important - Should Fix Before Production)
**Feature:** AUTH-001
**File:** src/app/actions/auth.ts:79

## Problem

The `redirect()` is called AFTER the try-catch block, which violates Next.js Server Actions patterns:

```typescript
try {
  // Registration logic
} catch (error) {
  return { errors: { _form: [...] } }
}

// Redirect outside try-catch - WRONG!
redirect('/login')
```

**Issues:**
1. If redirect throws (it does throw a special error to trigger navigation), it's not caught
2. TypeScript doesn't know the function ends here (no explicit return type safety)
3. Unexpected behavior if try block returns early

## Next.js redirect() Behavior

`redirect()` throws a special `NEXT_REDIRECT` error internally to trigger navigation. This is intentional and should NOT be caught by try-catch blocks.

## Solution

### Option A: Move redirect inside try block (Recommended)
```typescript
export async function registerUser(
  prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  // Validation...

  try {
    // Check existence...
    // Hash password...
    // Create user...

    // Success - redirect
    redirect('/login')
  } catch (error) {
    // Only catch database/hashing errors, not NEXT_REDIRECT
    if (error?.name === 'NEXT_REDIRECT') {
      throw error // Re-throw redirect to let Next.js handle it
    }

    console.error('Registration error:', error)
    return {
      errors: {
        _form: ['An error occurred during registration. Please try again.']
      }
    }
  }
}
```

### Option B: Use explicit return with success flag
```typescript
export async function registerUser(...): Promise<RegisterFormState & { success?: boolean }> {
  try {
    // Registration logic...
    return { success: true }
  } catch (error) {
    return { errors: { _form: [...] } }
  }
}

// In component
if (state.success) {
  redirect('/login') // Called from client component
}
```

### Option C: Separate concerns (Best for complex flows)
```typescript
// Server Action only handles data
export async function registerUser(...): Promise<RegisterFormState & { userId?: string }> {
  try {
    const [user] = await db.insert(users).values(...).returning()
    return { userId: user.id }
  } catch (error) {
    return { errors: { _form: [...] } }
  }
}

// Component handles navigation
useEffect(() => {
  if (state.userId) {
    router.push('/login')
  }
}, [state.userId])
```

## Acceptance Criteria

- [ ] redirect() is properly handled (not caught by generic catch)
- [ ] TypeScript return type is accurate
- [ ] Test successful registration redirects to /login
- [ ] Test failed registration shows error (no redirect)
- [ ] No console warnings about uncaught redirect errors

## References

- Next.js 15: Server Actions and redirect()
- Next.js redirect() API documentation
