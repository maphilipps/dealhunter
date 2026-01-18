---
status: pending
priority: p1
issue_id: "021"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# 021 - HIGH: TypeScript `any` Type Violations

## Problem Statement

The `bid-detail-client.tsx` component uses `any` type in two locations, violating type safety conventions and reducing code reliability.

## Findings

**Source:** kieran-typescript-reviewer agent

**Location 1:** `/Users/marc.philipps/Sites/dealhunter/components/bids/bid-detail-client.tsx:38`
```typescript
const [quickScan, setQuickScan] = useState<any>(null);
```

**Location 2:** `/Users/marc.philipps/Sites/dealhunter/components/bids/bid-detail-client.tsx:56`
```typescript
const handleConfirmRequirements = async (updatedRequirements: any) => {
```

**Impact:**
- Type errors at runtime instead of compile time
- No IDE autocompletion or error detection
- Reduced code maintainability

## Proposed Solutions

### Solution 1: Import and use existing types (Recommended)
- Import `QuickScanResult` from `lib/quick-scan/schema.ts`
- Import `ExtractedRequirements` type for the callback parameter
- **Effort:** Small
- **Risk:** Low
- **Pros:** Type safety, IDE support, catches errors at compile time
- **Cons:** None

## Recommended Action

**Solution 1** - Replace `any` with proper types

## Technical Details

**Affected Files:**
- `components/bids/bid-detail-client.tsx`

**Required Changes:**

```typescript
// Import types
import type { QuickScanResult } from '@/lib/quick-scan/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

// Line 38: Replace any with QuickScanResult
const [quickScan, setQuickScan] = useState<QuickScanResult | null>(null);

// Line 56: Replace any with ExtractedRequirements
const handleConfirmRequirements = async (updatedRequirements: ExtractedRequirements) => {
```

## Acceptance Criteria

- [ ] No `any` types in bid-detail-client.tsx
- [ ] TypeScript build passes without errors
- [ ] IDE provides proper autocompletion for quickScan state

## Work Log

| Date | Action | Learning |
|------|--------|----------|
| 2026-01-18 | Discovered via kieran-typescript-reviewer | `any` violates type safety principles |

## Resources

- TypeScript strict mode: https://www.typescriptlang.org/tsconfig#strict
