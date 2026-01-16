---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, nextjs, error-handling, ux]
dependencies: []
---

# Missing Error and Loading Boundaries in Bid Detail Route

## Problem Statement

The bid detail route (`/bids/[id]`) has no `error.tsx` or `loading.tsx` files. This means:
1. Unhandled errors bubble to root error boundary (poor UX)
2. No loading state during Server Component data fetching (users see blank page)
3. No route-level error recovery mechanism

**Impact:** HIGH - Production errors could crash entire app, navigation feels broken with no feedback.

**Location:** `/Users/marc.philipps/Sites/dealhunter/app/(dashboard)/bids/[id]/`

## Findings

**From nextjs-reviewer agent:**

Current structure:
```
app/(dashboard)/bids/[id]/
  ├── page.tsx        # ✅ Exists
  ├── error.tsx       # ❌ MISSING
  └── loading.tsx     # ❌ MISSING
```

**Missing Capabilities:**
1. **No error boundary** - Database errors, auth failures, or invalid IDs show generic Next.js error
2. **No loading state** - 100-500ms delay during navigation shows blank screen
3. **No retry mechanism** - Users can't recover from transient errors

**User Experience Impact:**
- Navigation to bid details feels laggy/broken
- Errors are confusing and unhelpful
- No way to recover from failures without browser refresh

## Proposed Solutions

### Solution 1: Add Standard Error and Loading Components (Recommended)
**Effort:** Small (15-20 minutes)
**Risk:** Low
**Pros:** Next.js best practice, immediate UX improvement
**Cons:** None

Create two new files following Next.js 16 conventions:

**File 1:** `/Users/marc.philipps/Sites/dealhunter/app/(dashboard)/bids/[id]/loading.tsx`
```tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function BidDetailLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-32 mt-2" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**File 2:** `/Users/marc.philipps/Sites/dealhunter/app/(dashboard)/bids/[id]/error.tsx`
```tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function BidDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Bid detail error:', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Fehler beim Laden</h1>

      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-600">Ein Fehler ist aufgetreten</CardTitle>
          </div>
          <CardDescription>
            {error.message || 'Bid konnte nicht geladen werden'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>Erneut versuchen</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Recommended Action

**Create both files immediately.** This is a fundamental Next.js 16 pattern and should be present in all dynamic routes.

## Technical Details

**New Files:**
- `/Users/marc.philipps/Sites/dealhunter/app/(dashboard)/bids/[id]/loading.tsx` (new)
- `/Users/marc.philipps/Sites/dealhunter/app/(dashboard)/bids/[id]/error.tsx` (new)

**Affected Components:**
- Uses existing ShadCN components (Skeleton, Card, Button)
- Follows Apple-style UX (clean, minimal, actionable)

**Testing Requirements:**
- Navigate to bid detail and verify loading skeleton appears during data fetch
- Simulate error (invalid bid ID) and verify error UI with retry button
- Click retry button and verify page reloads

## Acceptance Criteria

- [ ] `loading.tsx` shows skeleton UI during Server Component data fetching
- [ ] `error.tsx` catches errors and displays user-friendly message
- [ ] Error boundary logs to console for debugging
- [ ] Retry button in error.tsx successfully reloads the page
- [ ] Loading state matches design system (ShadCN Skeleton components)
- [ ] Error state matches design system (red accent, AlertCircle icon)

## Work Log

<!-- Add dated entries as you work on this -->

## Resources

- Next.js 16 error.tsx: https://nextjs.org/docs/app/api-reference/file-conventions/error
- Next.js 16 loading.tsx: https://nextjs.org/docs/app/api-reference/file-conventions/loading
- ShadCN Skeleton: https://ui.shadcn.com/docs/components/skeleton
- Next.js Reviewer: See agent output above
