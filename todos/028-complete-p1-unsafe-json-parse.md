---
status: pending
priority: p1
issue_id: "028"
tags: [code-review, typescript, error-handling]
dependencies: []
---

# Unsafe JSON.parse in BL Review Page

## Problem Statement

Direct `JSON.parse()` call without try-catch in `app/(dashboard)/bl-review/[id]/page.tsx:427`. If `bid.assignedTeam` contains invalid JSON, this will throw a runtime error causing a 500 error page.

**Impact:** Page crash on malformed data. The code uses `safeJsonParseOrNull` elsewhere but missed this one.

## Findings

**From kieran-typescript-reviewer and security-sentinel agents:**

**Unsafe code (line 427):**
```typescript
{JSON.stringify(JSON.parse(bid.assignedTeam), null, 2)}
```

**Safe pattern used elsewhere (line 114-137):**
```typescript
const extractedData = safeJsonParseOrNull<Record<string, unknown>>(
  bid.extractedRequirements
);
```

## Proposed Solutions

### Solution A: Use safeJsonParseOrNull (Recommended)
**Pros:** Consistent with rest of file, prevents crashes
**Cons:** None
**Effort:** Tiny (5 min)
**Risk:** None

```typescript
{JSON.stringify(safeJsonParseOrNull(bid.assignedTeam), null, 2)}
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `app/(dashboard)/bl-review/[id]/page.tsx` (line 427)

## Acceptance Criteria

- [ ] Replace `JSON.parse(bid.assignedTeam)` with `safeJsonParseOrNull(bid.assignedTeam)`
- [ ] Page renders gracefully even with malformed assignedTeam data

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from code review | Always use safe JSON parsing utilities |

## Resources

- `lib/utils/parse.ts` - safeJsonParseOrNull implementation
