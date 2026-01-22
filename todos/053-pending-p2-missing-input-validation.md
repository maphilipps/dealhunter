---
status: pending
priority: p2
issue_id: DEA-138
tags: [code-review, security, validation, zod]
dependencies: []
---

# Missing Input Validation on leadId/rfpId Parameters

## Problem Statement

The agent functions accept `leadId` and `rfpId` parameters without validating their format. This could allow injection attacks or cause cryptic errors on malformed input.

## Findings

- **Source:** security-sentinel
- **Files:**
  - `lib/agents/legal-check-agent.ts:runLegalCheckAgent()`
  - `lib/agents/references-agent.ts:runReferencesAgent()`
  - `lib/leads/cms-selection-service.ts`
- **Severity:** P2 - Security hardening
- **Impact:** Potential injection, poor error messages

## Proposed Solutions

### Solution 1: Zod Validation at Entry Points (Recommended)

Validate UUID format at function entry.

```typescript
import { z } from 'zod';

const IdSchema = z.string().uuid();

export async function runLegalCheckAgent(leadId: string, rfpId: string) {
  IdSchema.parse(leadId);
  IdSchema.parse(rfpId);
  // ...
}
```

**Pros:** Type-safe, clear errors, consistent
**Cons:** Zod already imported in most files
**Effort:** Small (15 min)
**Risk:** Low

### Solution 2: Shared Validation Helper

Create centralized validation utility.

**Pros:** DRY, consistent
**Cons:** Another import
**Effort:** Medium
**Risk:** Low

## Recommended Action

Solution 1 - Add Zod validation at entry points

## Technical Details

**Affected Files:**

- `lib/agents/legal-check-agent.ts`
- `lib/agents/references-agent.ts`
- `lib/leads/cms-selection-service.ts`

## Acceptance Criteria

- [ ] All public agent functions validate IDs
- [ ] Clear error messages on invalid input
- [ ] UUID format enforced

## Work Log

| Date       | Action                   | Learnings                     |
| ---------- | ------------------------ | ----------------------------- |
| 2026-01-22 | Created from code review | Validate at system boundaries |

## Resources

- PR: DEA-138 subtasks
