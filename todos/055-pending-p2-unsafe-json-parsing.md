---
status: pending
priority: p2
issue_id: DEA-138
tags: [code-review, security, error-handling, json]
dependencies: []
---

# Unsafe JSON Parsing Without Error Boundaries

## Problem Statement

Multiple locations use `JSON.parse()` without try-catch, which will throw on malformed JSON stored in the database, crashing the request.

## Findings

- **Source:** security-sentinel, data-integrity-guardian
- **Files:**
  - `lib/agents/deep-scan-orchestrator.ts:getDeepScanProgress()` lines 485-488
- **Severity:** P2 - Runtime crash risk
- **Impact:** Unhandled exceptions on corrupted data

**Current code:**

```typescript
const parsedContent: unknown = JSON.parse(section.content);
const parsedSources: string[] | undefined = section.sources
  ? (JSON.parse(section.sources) as string[])
  : undefined;
```

## Proposed Solutions

### Solution 1: Safe JSON Parse Helper (Recommended)

Create reusable safe parse function.

```typescript
function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    console.error('[JSON Parse] Failed to parse:', json.substring(0, 100));
    return fallback;
  }
}
```

**Pros:** Reusable, graceful degradation
**Cons:** Need to define fallbacks
**Effort:** Small (20 min)
**Risk:** Low

### Solution 2: Zod safeParse

Use Zod for runtime validation.

**Pros:** Type-safe
**Cons:** Overkill for simple parsing
**Effort:** Medium
**Risk:** Low

## Recommended Action

Solution 1 - Create safe JSON parse helper

## Technical Details

**Affected Files:**

- `lib/agents/deep-scan-orchestrator.ts`
- Search for other `JSON.parse` usages

**Search Pattern:**

```bash
grep -r "JSON.parse" lib/ --include="*.ts"
```

## Acceptance Criteria

- [ ] All JSON.parse calls wrapped in error handling
- [ ] Graceful fallback on parse failure
- [ ] Error logged for debugging
- [ ] No unhandled exceptions

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2026-01-22 | Created from code review | Never trust stored JSON to be valid |

## Resources

- PR: DEA-138 subtasks
