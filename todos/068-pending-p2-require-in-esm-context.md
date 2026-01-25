---
status: pending
priority: p2
issue_id:
tags: [code-review, code-smell, esm, typescript, circular-dependency]
dependencies: []
---

# require() in ES Module Context

## Problem Statement

The file `lib/deep-scan/section-expert-mapping.ts` uses `require()` at lines 121-122 as a workaround for circular dependencies. In an ES module context, this is a code smell that results in the imported type being inferred as `any`, bypassing TypeScript's type system.

## Findings

- **Source:** code-review
- **Files:**
  - `lib/deep-scan/section-expert-mapping.ts:121-122`
- **Severity:** P2 - Code smell, type safety violation
- **Impact:** Type inferred as `any`, hidden circular dependency issue

**Current code:**

```typescript
// Lines 121-122 - Using require() to avoid circular dependency
const { someModule } = require('./some-path');
// Type is `any`, not properly typed
```

## Proposed Solutions

### Solution 1: Refactor to Break Circular Dependency (Recommended)

Restructure the module dependencies to eliminate the circular reference.

```typescript
// Option A: Extract shared types to a separate file
// lib/deep-scan/types.ts
export interface ExpertConfig { ... }

// Option B: Use dependency injection
export function createMapping(dependencies: Dependencies) { ... }

// Option C: Lazy initialization with proper typing
let cachedModule: typeof import('./some-path') | null = null;
function getModule() {
  if (!cachedModule) {
    cachedModule = require('./some-path') as typeof import('./some-path');
  }
  return cachedModule;
}
```

**Pros:** Proper architecture, full type safety, no code smell
**Cons:** May require significant refactoring
**Effort:** Medium-Large (2-4 hours)
**Risk:** Medium (needs careful testing)

### Solution 2: Dynamic Import with Type Assertion

Replace `require()` with dynamic `import()` and proper typing.

```typescript
// Use dynamic import with type assertion
async function getExpertMapping() {
  const module = await import('./some-path');
  return module;
}

// Or for synchronous access with proper typing
const module = require('./some-path') as typeof import('./some-path');
```

**Pros:** Maintains current structure, adds type safety
**Cons:** Still a workaround, doesn't fix root cause
**Effort:** Small (15 min)
**Risk:** Low

### Solution 3: Barrel File Restructuring

Create a central barrel file that manages the dependency order.

```typescript
// lib/deep-scan/index.ts
// Export in correct dependency order
export * from './types';
export * from './base';
export * from './expert-dependencies';
export * from './section-expert-mapping';
```

**Pros:** Clean architecture
**Cons:** May require significant restructuring
**Effort:** Medium (1-2 hours)
**Risk:** Low

## Recommended Action

Solution 1 - Refactor to break the circular dependency. This is the proper fix that addresses the root cause rather than masking it.

## Technical Details

**Affected Files:**

- `lib/deep-scan/section-expert-mapping.ts`
- Related files in the circular dependency chain

**Investigation Steps:**

```bash
# Find the circular dependency chain
npx madge --circular lib/deep-scan/

# Or manually trace imports
grep -rn "from.*section-expert-mapping" lib/
grep -rn "from.*expert" lib/deep-scan/section-expert-mapping.ts
```

## Acceptance Criteria

- [ ] No `require()` calls in ES module files
- [ ] Circular dependency eliminated or properly managed
- [ ] Full TypeScript type inference restored
- [ ] No `any` types from module imports
- [ ] Build passes with `strict` mode

## Work Log

| Date       | Action                   | Learnings                                  |
| ---------- | ------------------------ | ------------------------------------------ |
| 2026-01-25 | Created from code review | require() in ESM bypasses TypeScript types |

## Resources

- TypeScript ES Modules: https://www.typescriptlang.org/docs/handbook/esm-node.html
- Circular Dependencies: https://nodejs.org/api/modules.html#cycles
- madge (dependency analyzer): https://github.com/pahen/madge
