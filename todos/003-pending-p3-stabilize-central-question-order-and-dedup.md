---
status: pending
priority: p3
issue_id: '003'
tags: [code-review, ux, api, data-quality]
dependencies: []
---

# Stabilize Central Question Ordering and Deduplication

## Problem Statement

Central bidder questions are currently deduplicated by raw rendered text and returned without explicit ordering. This can lead to unstable ordering across requests and near-duplicates when inline source decorations differ.

## Findings

- In `/Users/marc.philipps/Sites/dealhunter/app/api/qualifications/[id]/dashboard-summary/route.ts:125`, dedupe key uses `sectionId::text` where `text` may include inline source suffixes.
- `createdAt` is selected (`.../route.ts:91`) but no ordering is applied before `slice(0, 30)` (`.../route.ts:136`).
- Result: order and dedupe quality can drift depending on insertion pattern and inline citation variance.

## Proposed Solutions

### Option 1: Canonicalize + Deterministic Sort (Recommended)

**Approach:** Normalize question text before dedupe (strip trailing inline source blocks), then sort by `createdAt DESC` (or stable section-first strategy) before slicing.

**Pros:**

- Predictable UI output
- Better duplicate suppression
- Small implementation effort

**Cons:**

- Requires careful normalization to avoid over-merging distinct questions

**Effort:** Small (1-2 hours)

**Risk:** Low

---

### Option 2: Dedupe by Structured Metadata

**Approach:** Persist a normalized `questionKey` at write time and dedupe by that key + section.

**Pros:**

- Strongest long-term consistency
- Cleaner read path

**Cons:**

- Requires write-path changes and possible backfill

**Effort:** Medium (3-6 hours)

**Risk:** Medium

## Recommended Action

Pending triage.

## Technical Details

**Affected files:**

- `/Users/marc.philipps/Sites/dealhunter/app/api/qualifications/[id]/dashboard-summary/route.ts`
- `/Users/marc.philipps/Sites/dealhunter/lib/qualifications/sections/decision-grade-utils.ts`

**Database changes:**

- No for Option 1
- Optional for Option 2

## Resources

- Dashboard summary central question rendering in `/Users/marc.philipps/Sites/dealhunter/app/(dashboard)/qualifications/[id]/summary/page.tsx`

## Acceptance Criteria

- [ ] Central questions appear in deterministic order across repeated calls
- [ ] Duplicate suppression is robust against inline citation formatting differences
- [ ] Section reference remains intact for every displayed question
- [ ] No regression in max item cap behavior (`<= 30`)

## Work Log

### 2026-02-11 - Initial Review Capture

**By:** Codex

**Actions:**

- Inspected central question extraction/dedupe logic.
- Identified unstable order and text-based dedupe fragility.
- Proposed low-risk normalization + sorting improvement.

**Learnings:**

- Existing output quality can be improved without changing user-facing schema.

## Notes

- This is quality/UX hardening, not a release blocker.
