---
status: complete
priority: p2
issue_id: '098'
tags: [code-review, data-integrity, deep-scan-v2, database]
dependencies: []
---

# Missing CHECK Constraints for Enum Columns

## Problem Statement

The SQL migration defines columns as `text`, but the Drizzle schema uses typed enums. There are no CHECK constraints enforcing the enum values at the database level.

## Findings

**Agent:** data-integrity-guardian

**File:** `drizzle/0006_deep_scan_v2_tables.sql`
**Lines:** 6-32

**SQL Migration:**

```sql
"type" text NOT NULL,
"format" text NOT NULL,
"audit_type" text NOT NULL,
"status" text DEFAULT 'pending' NOT NULL,
```

**Risk:** Invalid values can be inserted directly via SQL or external tools, corrupting data integrity.

## Proposed Solutions

### Option A: Add CHECK constraints via migration amendment

**Pros:** Database-level enforcement
**Cons:** Migration needed
**Effort:** Small
**Risk:** Low

```sql
ALTER TABLE "deep_scan_v2_runs"
ADD CONSTRAINT "deep_scan_v2_runs_status_check"
CHECK ("status" IN ('pending', 'running', 'audit_complete', 'generating',
  'waiting_for_user', 'review', 'completed', 'failed', 'cancelled'));

ALTER TABLE "deep_scan_v2_runs"
ADD CONSTRAINT "deep_scan_v2_runs_progress_check"
CHECK ("progress" >= 0 AND "progress" <= 100);

ALTER TABLE "deep_scan_v2_documents"
ADD CONSTRAINT "deep_scan_v2_documents_type_check"
CHECK ("type" IN ('indication', 'calculation', 'presentation', 'proposal'));

ALTER TABLE "deep_scan_v2_documents"
ADD CONSTRAINT "deep_scan_v2_documents_format_check"
CHECK ("format" IN ('html', 'xlsx', 'pptx', 'docx', 'pdf'));

ALTER TABLE "deep_scan_v2_audit_results"
ADD CONSTRAINT "deep_scan_v2_audit_results_audit_type_check"
CHECK ("audit_type" IN ('tech_detection', 'performance', 'accessibility',
  'component_analysis', 'seo', 'security'));
```

## Recommended Action

Create amendment migration with CHECK constraints.

## Technical Details

**Affected Files:**

- `drizzle/0007_add_deep_scan_constraints.sql` (new)

## Acceptance Criteria

- [ ] Status column has CHECK constraint
- [ ] Progress column has range constraint (0-100)
- [ ] Document type/format have CHECK constraints
- [ ] Audit type has CHECK constraint
- [ ] Invalid inserts are rejected

## Work Log

| Date       | Action  | Notes                               |
| ---------- | ------- | ----------------------------------- |
| 2026-02-04 | Created | From data-integrity-guardian review |

## Resources

- PR: feat/deep-scan-v2-agent-native
