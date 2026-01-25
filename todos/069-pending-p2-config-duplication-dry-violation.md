---
status: pending
priority: p2
issue_id:
tags: [code-review, dry-violation, maintainability, config]
dependencies: []
---

# Config Duplication Across Files

## Problem Statement

Configuration constants are duplicated across multiple files, violating the DRY (Don't Repeat Yourself) principle. This creates maintenance risk where changes need to be synchronized across multiple locations, and inconsistencies can cause bugs.

## Findings

- **Source:** code-review
- **Files:**
  - `lib/deep-scan/section-expert-mapping.ts`
  - `lib/deep-scan/expert-dependencies.ts`
  - `contexts/deep-scan-context.tsx`
- **Severity:** P2 - Maintenance risk, DRY violation
- **Impact:** Inconsistent behavior, difficult maintenance, potential bugs

**Duplicated Constants:**

| Constant               | Location 1                      | Location 2              |
| ---------------------- | ------------------------------- | ----------------------- |
| `SECTION_TO_EXPERT`    | `section-expert-mapping.ts`     | `deep-scan-context.tsx` |
| `ALL_EXPERTS`          | `expert-dependencies.ts`        | `deep-scan-context.tsx` |
| `EXPERT_DISPLAY_NAMES` | Only in `deep-scan-context.tsx` | -                       |

**Example of duplication:**

```typescript
// lib/deep-scan/section-expert-mapping.ts
export const SECTION_TO_EXPERT = {
  summary: 'customer-research',
  technical: 'integrations',
  // ... more mappings
};

// contexts/deep-scan-context.tsx
const SECTION_TO_EXPERT = {
  summary: 'customer-research',
  technical: 'integrations',
  // ... same mappings duplicated
};
```

## Proposed Solutions

### Solution 1: Single Source of Truth (Recommended)

Consolidate all expert-related configuration into one authoritative location.

```typescript
// lib/deep-scan/expert-config.ts
export const EXPERT_CONFIG = {
  experts: ['customer-research', 'integrations', ...] as const,

  sectionMapping: {
    'summary': 'customer-research',
    'technical': 'integrations',
    // ...
  },

  displayNames: {
    'customer-research': 'Customer Research',
    'integrations': 'Integrations',
    // ...
  },

  dependencies: {
    'integrations': ['customer-research'],
    // ...
  },
} as const;

export type ExpertId = typeof EXPERT_CONFIG.experts[number];
export type SectionId = keyof typeof EXPERT_CONFIG.sectionMapping;

// Helper functions
export const getAllExperts = () => EXPERT_CONFIG.experts;
export const getExpertForSection = (section: SectionId) =>
  EXPERT_CONFIG.sectionMapping[section];
export const getExpertDisplayName = (expert: ExpertId) =>
  EXPERT_CONFIG.displayNames[expert];
```

**Pros:** Single source of truth, type-safe, easy to maintain
**Cons:** Requires updating all import locations
**Effort:** Medium (1-2 hours)
**Risk:** Low

### Solution 2: Re-export from Context

Have the context re-export from the lib files.

```typescript
// contexts/deep-scan-context.tsx
import { SECTION_TO_EXPERT, ALL_EXPERTS } from '@/lib/deep-scan/expert-config';

// Add display names to the central config
export { SECTION_TO_EXPERT, ALL_EXPERTS };
```

**Pros:** Minimal changes, maintains current structure
**Cons:** Config still split across files
**Effort:** Small (30 min)
**Risk:** Low

### Solution 3: Configuration Module Pattern

Use a configuration module that provides both data and utilities.

```typescript
// lib/deep-scan/expert-registry.ts
class ExpertRegistry {
  private static instance: ExpertRegistry;

  readonly experts: readonly ExpertId[];
  readonly sectionMapping: Record<string, ExpertId>;
  readonly displayNames: Record<ExpertId, string>;

  static getInstance() {
    if (!this.instance) {
      this.instance = new ExpertRegistry();
    }
    return this.instance;
  }
}

export const expertRegistry = ExpertRegistry.getInstance();
```

**Pros:** Encapsulated, extensible
**Cons:** More complex, possibly over-engineered
**Effort:** Medium (1-2 hours)
**Risk:** Low

## Recommended Action

Solution 1 - Create a single source of truth in `lib/deep-scan/expert-config.ts`. This is the cleanest approach that provides full type safety and easy maintenance.

## Technical Details

**Affected Files:**

- `lib/deep-scan/section-expert-mapping.ts` - Remove duplicates
- `lib/deep-scan/expert-dependencies.ts` - Remove duplicates
- `contexts/deep-scan-context.tsx` - Import from central config
- Any files importing from the above

**Migration Steps:**

1. Create `lib/deep-scan/expert-config.ts` with all constants
2. Update `section-expert-mapping.ts` to import from config
3. Update `expert-dependencies.ts` to import from config
4. Update `deep-scan-context.tsx` to import from config
5. Search for any other usages and update imports
6. Remove duplicate definitions
7. Run tests to verify no regressions

**Search Pattern:**

```bash
grep -rn "SECTION_TO_EXPERT\|ALL_EXPERTS\|EXPERT_DISPLAY" lib/ contexts/ --include="*.ts" --include="*.tsx"
```

## Acceptance Criteria

- [ ] Single authoritative location for expert configuration
- [ ] No duplicate constant definitions
- [ ] All imports point to the single source
- [ ] TypeScript types derived from the config
- [ ] Tests pass with no behavior changes
- [ ] Adding a new expert requires change in only one file

## Work Log

| Date       | Action                   | Learnings                              |
| ---------- | ------------------------ | -------------------------------------- |
| 2026-01-25 | Created from code review | Config duplication creates sync issues |

## Resources

- DRY Principle: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
- TypeScript const assertions: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions
