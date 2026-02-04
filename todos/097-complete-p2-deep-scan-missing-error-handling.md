---
status: complete
priority: p2
issue_id: '097'
tags: [code-review, patterns, deep-scan-v2, error-handling]
dependencies: []
---

# Missing try/catch in Tool Execute Functions

## Problem Statement

All 8 Deep Scan tools lack try/catch blocks around database operations. Database errors will propagate as unhandled exceptions, inconsistent with the quick-scan-tools pattern.

## Findings

**Agent:** pattern-recognition-specialist

**File:** `lib/agent-tools/tools/deep-scan.ts`

**Existing pattern in quick-scan-tools.ts:**

```typescript
async execute(input, _context: ToolContext) {
  try {
    const result = await crawlNavigation(...);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Current deep-scan.ts pattern (inconsistent):**

```typescript
async execute(input, context) {
  const preQual = await db.query.preQualifications.findFirst({...});
  // No try/catch - database errors will propagate unhandled
  if (!preQual) {
    return { success: false, error: '...' };
  }
  // ...
}
```

**Impact:**

- Unhandled promise rejections
- Inconsistent error responses
- Missing error logging

## Proposed Solutions

### Option A: Add try/catch to all tools (Recommended)

**Pros:** Consistent with existing patterns
**Cons:** Verbose
**Effort:** Small
**Risk:** Low

### Option B: Create error handling wrapper

**Pros:** DRY
**Cons:** Additional abstraction
**Effort:** Medium
**Risk:** Low

```typescript
function withErrorHandling<T>(
  fn: (input: unknown, context: ToolContext) => Promise<ToolResult<T>>
) {
  return async (input: unknown, context: ToolContext): Promise<ToolResult<T>> => {
    try {
      return await fn(input, context);
    } catch (error) {
      console.error('[DeepScan] Tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}
```

## Recommended Action

Implement Option A for consistency with existing tools, or Option B if refactoring all tools.

## Technical Details

**Affected Files:**

- `lib/agent-tools/tools/deep-scan.ts` (all 8 tools)

## Acceptance Criteria

- [ ] All tools have try/catch blocks
- [ ] Error responses follow `{ success: false, error: string }` format
- [ ] Errors are logged to console
- [ ] Pattern matches quick-scan-tools.ts

## Work Log

| Date       | Action  | Notes                                      |
| ---------- | ------- | ------------------------------------------ |
| 2026-02-04 | Created | From pattern-recognition-specialist review |

## Resources

- PR: feat/deep-scan-v2-agent-native
- Reference: `lib/agent-tools/quick-scan-tools.ts`
