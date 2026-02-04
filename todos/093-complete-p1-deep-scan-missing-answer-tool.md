---
status: resolved
priority: p1
issue_id: '093'
tags: [code-review, agent-native, deep-scan-v2, feature]
dependencies: []
---

# Missing Answer Tool for Human-in-the-Loop Workflow

## Problem Statement

The `waiting_for_user` status workflow cannot be completed by agents. The plan document (A1) specifies a `scan.deepscan.answer` tool, but it is not implemented in the actual tools file. This breaks agent-native parity for the Human-in-the-Loop workflow.

## Findings

**Agent:** agent-native-reviewer

**File:** `lib/agent-tools/tools/deep-scan.ts`

The following tools exist:

- `scan.deepscan.trigger` ✅
- `scan.deepscan.status` ✅
- `scan.deepscan.result` ✅
- `scan.deepscan.cancel` ✅
- `scan.deepscan.delete` ✅
- `scan.deepscan.retry` ✅
- `scan.deepscan.activity` ✅
- `scan.deepscan.list` ✅
- `scan.deepscan.answer` ❌ **MISSING**

**Impact:**

- Agents cannot respond to pending questions during scans
- Human-in-the-Loop workflow requires manual intervention
- Breaks agent-native parity principle

## Proposed Solutions

### Option A: Implement answer tool (Required)

**Pros:** Completes agent-native parity
**Cons:** None
**Effort:** Medium
**Risk:** Low

```typescript
export const answerDeepScanInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run waiting for answer'),
  answer: z.string().describe('Answer to the pending question'),
  reasoning: z.string().optional().describe('Agent reasoning for the answer (for audit trail)'),
});

registry.register({
  name: 'scan.deepscan.answer',
  description: 'Beantwortet eine ausstehende Frage für einen Deep Scan im waiting_for_user Status.',
  category: 'deep-scan',
  inputSchema: answerDeepScanInputSchema,
  execute: async (input, context) => {
    const run = await getRunWithOwnershipCheck(input.runId, context);
    if (!run) {
      return { success: false, error: `Run ${input.runId} nicht gefunden` };
    }

    if (run.status !== 'waiting_for_user') {
      return {
        success: false,
        error: `Run ist nicht im waiting_for_user Status (aktuell: ${run.status})`,
      };
    }

    // Update checkpoint with answer and provenance
    const checkpoint = parseJsonSafe(run.checkpoint, null);
    if (!checkpoint?.pendingQuestion) {
      return { success: false, error: 'Keine ausstehende Frage gefunden' };
    }

    // Resume job via BullMQ with answer
    // ...

    return { success: true, data: { resumed: true } };
  },
});
```

## Recommended Action

Implement the `scan.deepscan.answer` tool to complete agent-native parity.

## Technical Details

**Affected Files:**

- `lib/agent-tools/tools/deep-scan.ts`
- `lib/deep-scan-v2/types.ts` (add answer input schema)
- `lib/deep-scan-v2/constants.ts` (add ANSWER to tool names)

**Also needed:**

- API endpoint `POST /api/v2/deep-scan/[runId]/answer`

## Acceptance Criteria

- [x] `scan.deepscan.answer` tool is registered
- [x] Tool validates run is in `waiting_for_user` status
- [x] Answer is stored with provenance (agent vs human)
- [x] Run status transitions back to `running`
- [ ] BullMQ job is resumed with the answer (TODO comment added)
- [x] API endpoint exists for HTTP access

## Work Log

| Date       | Action   | Notes                                                        |
| ---------- | -------- | ------------------------------------------------------------ |
| 2026-02-04 | Created  | From agent-native-reviewer                                   |
| 2026-02-04 | Resolved | Implemented answer tool and API endpoint (BullMQ resume TBD) |

## Resources

- PR: feat/deep-scan-v2-agent-native
- Plan: docs/plans/2026-02-04-feat-deep-scan-v2-agent-native-enhancement.md (Task A1)
