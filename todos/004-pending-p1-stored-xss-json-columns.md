---
status: pending
priority: p1
issue_id: HIGH-002
tags: [code-review, security, xss, input-validation]
dependencies: []
---

# HIGH: Stored XSS via Unvalidated JSON Columns

## Problem Statement

The `deep_migration_analyses` table stores JSON data from AI-generated analysis results in text columns without validation or sanitization. If this data is rendered in the UI without escaping, it could lead to stored XSS attacks.

**Impact**: Account takeover, session hijacking, data theft via XSS
**Likelihood**: Medium (requires malicious AI output or webhook manipulation)

## Findings

**Security Agent Report:**

- 4 JSON text columns: `contentArchitecture`, `migrationComplexity`, `accessibilityAudit`, `ptEstimation`
- No validation at database level
- No sanitization before storage
- If rendered in UI without escaping → stored XSS
- AI could be manipulated to generate malicious JSON payloads

**Attack Scenarios:**

1. Attacker manipulates AI prompt to inject `<script>` tags in analysis results
2. Malicious JSON stored in database: `{"pageType": "<script>alert(1)</script>"}`
3. When rendered in UI, executes JavaScript in victim's browser
4. Steals session token, performs actions as victim user

**Evidence:**

```typescript
// lib/db/schema.ts
contentArchitecture: text('content_architecture'), // ❌ No validation
migrationComplexity: text('migration_complexity'), // ❌ No validation
accessibilityAudit: text('accessibility_audit'),   // ❌ No validation
ptEstimation: text('pt_estimation'),               // ❌ No validation
```

## Proposed Solutions

### Solution 1: Validate Against Zod Schema Before Storage (Recommended)

**Pros:**

- Uses existing schemas in `lib/deep-analysis/schemas.ts`
- Rejects malformed/malicious data at write time
- Type-safe validation
- Prevents XSS at source

**Cons:**

- Adds validation overhead
- Need error handling for invalid AI outputs

**Effort**: Small (1 hour)
**Risk**: Low

**Implementation:**

```typescript
// lib/inngest/functions/deep-analysis.ts
import { ContentArchitectureSchema } from '@/lib/deep-analysis/schemas';

// Before saving to database:
try {
  const validated = ContentArchitectureSchema.parse(contentArchitecture);
  await db
    .update(deepMigrationAnalyses)
    .set({ contentArchitecture: JSON.stringify(validated) }) // ✅ Validated
    .where(eq(deepMigrationAnalyses.id, analysisId));
} catch (error) {
  // Log validation error, set status to 'failed'
  console.error('Invalid AI output:', error);
}
```

### Solution 2: Sanitize on Read with DOMPurify

**Pros:**

- Defense in depth (even if bad data stored)
- Works with any React rendering

**Cons:**

- Doesn't prevent bad data storage
- Client-side only
- Bundle size increase

**Effort**: Medium (2 hours)
**Risk**: Medium (can be bypassed if server-rendered)

### Solution 3: Use Prepared Statements with Parameterization

**Pros:**

- Prevents SQL injection (different attack)
- Standard practice

**Cons:**

- Already using Drizzle ORM (handles this)
- Doesn't prevent XSS in JSON content
- Not applicable to this specific issue

**Effort**: N/A (already implemented)
**Risk**: N/A

## Recommended Action

**Use Solution 1 + Solution 2 (Defense in Depth)**

1. Validate all JSON against Zod schemas BEFORE storing in database
2. Escape/sanitize when rendering in UI components (React does this by default for text content)
3. Never use `dangerouslySetInnerHTML` with analysis data

## Technical Details

**Affected Files:**

- `lib/inngest/functions/deep-analysis.ts` - Add Zod validation before DB write
- `components/deep-analysis/*.tsx` - Ensure no dangerouslySetInnerHTML usage
- `lib/deep-analysis/schemas.ts` - Schemas already exist, just need to use them

**Validation Example:**

```typescript
import {
  ContentArchitectureSchema,
  MigrationComplexitySchema,
  AccessibilityAuditSchema,
  PTEstimationSchema,
} from '@/lib/deep-analysis/schemas';

// In deep-analysis Inngest function:
const results = {
  contentArchitecture: ContentArchitectureSchema.parse(rawContentArch),
  migrationComplexity: MigrationComplexitySchema.parse(rawMigrationComplexity),
  accessibilityAudit: AccessibilityAuditSchema.parse(rawAccessibilityAudit),
  ptEstimation: PTEstimationSchema.parse(rawPTEstimation),
};

await db.update(deepMigrationAnalyses).set({
  contentArchitecture: JSON.stringify(results.contentArchitecture), // ✅ Validated
  migrationComplexity: JSON.stringify(results.migrationComplexity),
  accessibilityAudit: JSON.stringify(results.accessibilityAudit),
  ptEstimation: JSON.stringify(results.ptEstimation),
  status: 'completed',
});
```

**Database Changes:** None (validation is application-level)

**Breaking Changes:** Invalid AI outputs will be rejected (good!)

## Acceptance Criteria

- [ ] All JSON columns validated against Zod schemas before storage
- [ ] Invalid AI outputs log error and set analysis status to 'failed'
- [ ] UI components never use dangerouslySetInnerHTML with analysis data
- [ ] React default escaping relied upon for text rendering
- [ ] Security test added to verify XSS prevention
- [ ] Error handling for validation failures

## Work Log

**2026-01-17**: Issue identified by security-sentinel agent during Epic 7 Phase 1 review

## Resources

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Zod Validation Docs](https://zod.dev/)
- Existing schemas: `lib/deep-analysis/schemas.ts`
