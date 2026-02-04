---
status: completed
priority: p3
issue_id: '099'
tags: [code-review, simplicity, deep-scan-v2, yagni]
dependencies: []
---

# Unused Constants and Types (YAGNI Violation)

## Problem Statement

Multiple constants and types are defined but not used anywhere, violating YAGNI (You Aren't Gonna Need It) principle.

## Findings

**Agent:** code-simplicity-reviewer

**Unused constants in `lib/deep-scan-v2/constants.ts`:**

- `CHECKPOINT_INTERVAL_MS` (line 17)
- `CHECKPOINT_RETENTION_HOURS` (line 18)
- `PROGRESS_UPDATE_INTERVAL_MS` (line 21)
- `CONFIDENCE_HIGH/MEDIUM/LOW` (lines 24-26)
- `ACTIVITY_LOG_RETENTION_DAYS` (line 30)
- `PHASE_WEIGHTS` (lines 35-39)
- `AUDIT_WEIGHTS` (lines 43-50)
- `EXPERT_AGENTS` (lines 54-75)
- `DOCUMENT_CONFIG` (lines 79-95)
- `DEEP_SCAN_ERROR_CODES` (lines 99-120)

**Unused types in `lib/deep-scan-v2/types.ts`:**

- `OrchestratorCheckpoint` (lines 61-72) - no checkpoint/resume implemented
- `PendingQuestion` (lines 74-79) - no waiting_for_user flow
- `ProgressEvent` (lines 127-149) - no SSE streaming
- `DeepScanV2JobData` / `DeepScanV2JobResult` (lines 153-173) - BullMQ not integrated

**Estimated LOC reduction:** ~130 lines

## Proposed Solutions

### Option A: Remove unused code (Recommended)

**Pros:** Cleaner codebase, clearer intent
**Cons:** May need to re-add later
**Effort:** Small
**Risk:** Low

### Option B: Mark as TODO/future

**Pros:** Keeps design documentation
**Cons:** Dead code in codebase
**Effort:** None
**Risk:** None

## Recommended Action

Remove unused constants and types. Re-add when needed.

## Technical Details

**Affected Files:**

- `lib/deep-scan-v2/constants.ts`
- `lib/deep-scan-v2/types.ts`

## Acceptance Criteria

- [x] All unused constants removed
- [x] All unused types removed
- [x] No compilation errors
- [ ] Tests still pass

## Work Log

| Date       | Action    | Notes                                                                                                                                                                                                                     |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-04 | Created   | From code-simplicity-reviewer                                                                                                                                                                                             |
| 2026-02-04 | Completed | Removed unused constants (PHASE_WEIGHTS, AUDIT_WEIGHTS, EXPERT_AGENTS, DOCUMENT_CONFIG, DEEP_SCAN_ERROR_CODES) and types (OrchestratorCheckpoint, PendingQuestion, ProgressEvent, DeepScanV2JobData, DeepScanV2JobResult) |

## Resources

- PR: feat/deep-scan-v2-agent-native
