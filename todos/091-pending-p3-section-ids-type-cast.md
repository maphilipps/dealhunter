---
status: pending
priority: p3
issue_id: '091'
tags: [code-review, type-safety]
dependencies: []
---

# SECTION_IDS Uses as unknown as Double Cast

## Problem Statement

`SECTION_IDS` in `orchestrator-worker.ts` uses `as unknown as readonly [...]` to maintain the tuple type. This bypasses type checking — adding/removing sections from SECTION_DEFINITIONS won't cause a compile error. Use a derived type from the definitions array instead.

## Proposed Solutions

```typescript
export const SECTION_IDS = SECTION_DEFINITIONS.map(s => s.id);
export type SectionId = (typeof SECTION_DEFINITIONS)[number]['id'];
```

## Acceptance Criteria

- [ ] `SECTION_IDS` type derived from `SECTION_DEFINITIONS` without manual cast
- [ ] Adding/removing a section definition causes compile error at all usage sites
