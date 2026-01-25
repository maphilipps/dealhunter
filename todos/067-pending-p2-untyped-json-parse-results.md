---
status: pending
priority: p2
issue_id:
tags: [code-review, type-safety, runtime-errors, json]
dependencies: []
---

# Untyped JSON.parse Results

## Problem Statement

Multiple files use `JSON.parse()` which returns `any`, and the result is silently assigned to typed arrays without validation. This bypasses TypeScript's type checking and can cause runtime errors on malformed data.

## Findings

- **Source:** code-review
- **Files:**
  - `lib/deep-scan/checkpoint.ts`
  - `app/api/qualifications/[id]/background-job/route.ts`
- **Severity:** P2 - Type safety violation with runtime crash risk
- **Impact:** Runtime errors when JSON structure doesn't match expected types

**Current pattern:**

```typescript
// JSON.parse returns `any`, silently assigned to typed array
const data: SomeType[] = JSON.parse(jsonString);
// No runtime validation - crashes if structure doesn't match
```

## Proposed Solutions

### Solution 1: Zod Runtime Validation (Recommended)

Use Zod schemas to validate JSON.parse results at runtime.

```typescript
import { z } from 'zod';

const CheckpointSchema = z.object({
  completedExperts: z.array(z.string()),
  timestamp: z.string(),
});

type Checkpoint = z.infer<typeof CheckpointSchema>;

function parseCheckpoint(json: string): Checkpoint | null {
  try {
    const parsed = JSON.parse(json);
    const result = CheckpointSchema.safeParse(parsed);
    if (!result.success) {
      console.error('[Checkpoint] Invalid structure:', result.error);
      return null;
    }
    return result.data;
  } catch (e) {
    console.error('[Checkpoint] Failed to parse JSON:', e);
    return null;
  }
}
```

**Pros:** Full type safety, runtime validation, clear error messages
**Cons:** Need to define Zod schemas for each structure
**Effort:** Medium (1-2 hours)
**Risk:** Low

### Solution 2: Type Guard Functions

Create type guard functions for runtime checks.

```typescript
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

const parsed: unknown = JSON.parse(jsonString);
if (!isStringArray(parsed)) {
  throw new Error('Invalid data structure');
}
// parsed is now typed as string[]
```

**Pros:** Lightweight, no dependencies
**Cons:** Manual type guards for each structure, more boilerplate
**Effort:** Small (30 min)
**Risk:** Low

### Solution 3: Generic Safe Parser

Create a utility that combines JSON.parse with type assertion.

```typescript
function safeJsonParse<T>(json: string, validator: (value: unknown) => value is T, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(json);
    return validator(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
```

**Pros:** Reusable, explicit about the unsafe boundary
**Cons:** Still requires validators
**Effort:** Small (30 min)
**Risk:** Low

## Recommended Action

Solution 1 - Use Zod validation for structured data. This project already uses Zod extensively, so this maintains consistency and provides the best runtime safety.

## Technical Details

**Affected Files:**

- `lib/deep-scan/checkpoint.ts`
- `app/api/qualifications/[id]/background-job/route.ts`

**Search Pattern:**

```bash
grep -rn "JSON.parse" lib/ app/ --include="*.ts" | grep -v node_modules
```

## Acceptance Criteria

- [ ] All JSON.parse results validated with Zod schemas
- [ ] Type assertions replaced with proper runtime validation
- [ ] Graceful error handling on invalid JSON structure
- [ ] No `any` types escaping from JSON.parse boundaries
- [ ] Unit tests for malformed JSON scenarios

## Work Log

| Date       | Action                   | Learnings                                        |
| ---------- | ------------------------ | ------------------------------------------------ |
| 2026-01-25 | Created from code review | JSON.parse returns any, needs runtime validation |

## Resources

- Zod documentation: https://zod.dev/
- TypeScript type guards: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
