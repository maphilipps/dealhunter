---
status: pending
priority: p2
issue_id: DATA-003
tags: [code-review, database, validation, data-integrity]
dependencies: [HIGH-002]
---

# IMPORTANT: No JSON Validation at Database Level

## Problem Statement

The `deepMigrationAnalyses` table stores complex JSON data in text columns without any validation. Invalid JSON can be stored, causing runtime errors when the application tries to parse it. This creates a data integrity risk and makes debugging difficult.

**Impact**: Runtime JSON parse errors, invalid data stored, difficult debugging
**Likelihood**: Medium (AI outputs can be malformed, webhook data corrupted)

## Findings

**Data Integrity Guardian Report:**

- 4 JSON columns: contentArchitecture, migrationComplexity, accessibilityAudit, ptEstimation
- No validation that text is valid JSON
- No validation against Zod schemas at DB level
- Corrupted JSON can be stored → runtime errors when parsing
- No way to query invalid records

**Evidence:**

```typescript
// lib/db/schema.ts (current)
contentArchitecture: text('content_architecture'), // ❌ No JSON validation
migrationComplexity: text('migration_complexity'), // ❌ No JSON validation
accessibilityAudit: text('accessibility_audit'),   // ❌ No JSON validation
ptEstimation: text('pt_estimation'),               // ❌ No JSON validation
```

**Current Risk:**

```typescript
// Inngest function writes data
await db.update(deepMigrationAnalyses)
  .set({
    contentArchitecture: '{"invalid": json}', // ❌ Invalid JSON stored
  });

// Later, UI tries to parse
const analysis = await db.select().from(deepMigrationAnalyses)...;
const parsed = JSON.parse(analysis.contentArchitecture); // 💥 Throws error
```

**Note:** This is related to HIGH-002 (Stored XSS), but focuses on data integrity rather than security.

## Proposed Solutions

### Solution 1: Validate with Zod Before DB Write (Recommended)

**Pros:**

- Uses existing schemas in lib/deep-analysis/schemas.ts
- Prevents invalid data at source
- Type-safe validation
- Consistent with HIGH-002 fix

**Cons:**

- Application-level only (DB doesn't enforce)
- Need to validate in ALL write paths

**Effort**: Small (1 hour, covered by HIGH-002)
**Risk**: Low

**Implementation:**

```typescript
// lib/inngest/functions/deep-analysis.ts
import {
  ContentArchitectureSchema,
  MigrationComplexitySchema,
  AccessibilityAuditSchema,
  PTEstimationSchema,
} from '@/lib/deep-analysis/schemas';

try {
  // Validate against schemas
  const validated = {
    contentArchitecture: ContentArchitectureSchema.parse(contentArchResult),
    migrationComplexity: MigrationComplexitySchema.parse(migrationComplexityResult),
    accessibilityAudit: AccessibilityAuditSchema.parse(accessibilityAuditResult),
    ptEstimation: PTEstimationSchema.parse(ptEstimationResult),
  };

  // Store validated JSON
  await db
    .update(deepMigrationAnalyses)
    .set({
      contentArchitecture: JSON.stringify(validated.contentArchitecture), // ✅ Valid
      migrationComplexity: JSON.stringify(validated.migrationComplexity),
      accessibilityAudit: JSON.stringify(validated.accessibilityAudit),
      ptEstimation: JSON.stringify(validated.ptEstimation),
      status: 'completed',
    })
    .where(eq(deepMigrationAnalyses.id, analysisId));
} catch (error) {
  // Validation failed → mark as failed
  await db
    .update(deepMigrationAnalyses)
    .set({
      status: 'failed',
      errorMessage: `Invalid AI output: ${error.message}`,
    })
    .where(eq(deepMigrationAnalyses.id, analysisId));

  throw error;
}
```

### Solution 2: SQLite JSON Type + CHECK Constraint

**Pros:**

- Database-level enforcement
- Can query with JSON functions (json_extract, etc.)
- Rejects invalid JSON at insert time

**Cons:**

- SQLite has limited JSON support (no schema validation)
- Can only check if valid JSON, not if matches schema
- Less flexible than TEXT columns

**Effort**: Medium (2-3 hours)
**Risk**: Medium (schema migration complexity)

**Implementation:**

```sql
-- Migration
ALTER TABLE `deep_migration_analyses`
  ADD COLUMN `content_architecture_validated` TEXT
  CHECK (json_valid(content_architecture_validated)); -- ✅ SQLite JSON check
```

**Limitations:**

- Only validates JSON syntax, not structure
- Can't enforce Zod schema at DB level
- Still need application validation for schema compliance

### Solution 3: Add JSON Parsing Check on Read

**Pros:**

- Defensive programming
- Catches errors gracefully

**Cons:**

- Doesn't prevent bad data storage
- Error handling at every read site
- Doesn't help with debugging source of bad data

**Effort**: Small (1 hour)
**Risk**: Medium (can hide underlying issues)

**Implementation:**

```typescript
// lib/bids/actions.ts
function parseAnalysisJSON<T>(json: string | null, schema: ZodSchema<T>): T | null {
  if (!json) return null;

  try {
    const parsed = JSON.parse(json);
    return schema.parse(parsed);
  } catch (error) {
    console.error('Invalid JSON in database:', error);
    // Log to Sentry/monitoring
    return null; // ❌ Silently fails, hard to debug
  }
}
```

## Recommended Action

**Use Solution 1: Validate with Zod Before DB Write**

This is the most practical approach for SQLite and aligns with the HIGH-002 fix. Database-level JSON validation in SQLite is limited, so application-level validation with Zod schemas is the best option.

## Technical Details

**Affected Files:**

- `lib/inngest/functions/deep-analysis.ts` - Add Zod validation (same as HIGH-002)
- `lib/deep-analysis/schemas.ts` - Schemas already exist

**Database Changes:** None (validation is application-level)

**Breaking Changes:** Invalid AI outputs will fail analysis (correct behavior)

**Error Handling:**

```typescript
// If validation fails:
1. Set analysis status to 'failed'
2. Store error message in errorMessage column
3. Log validation error for debugging
4. Optionally retry with different AI parameters
```

## Acceptance Criteria

- [ ] All JSON writes validated against Zod schemas
- [ ] Invalid AI outputs set analysis status to 'failed'
- [ ] Error messages stored in errorMessage column
- [ ] No invalid JSON stored in database
- [ ] Monitoring/logging for validation failures
- [ ] Documentation updated with validation requirements
- [ ] Combined with HIGH-002 fix (same implementation)

## Work Log

**2026-01-17**: Issue identified by data-integrity-guardian agent during Epic 7 Phase 1 review

## Resources

- [Zod Validation Docs](https://zod.dev/)
- [SQLite JSON Functions](https://www.sqlite.org/json1.html)
- Related: HIGH-002 (Stored XSS - same solution)
- Existing schemas: `lib/deep-analysis/schemas.ts`
