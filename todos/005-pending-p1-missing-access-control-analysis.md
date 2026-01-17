---
status: pending
priority: p1
issue_id: HIGH-003
tags: [code-review, security, access-control, authorization]
dependencies: []
---

# HIGH: Missing Access Control for Deep Analysis Records

## Problem Statement

The `deep_migration_analyses` table has no user ownership tracking and no API routes with access control. Any authenticated user could potentially access or manipulate another user's analysis results if API routes are added without proper authorization checks.

**Impact**: Unauthorized data access, competitor intelligence leakage, GDPR violation
**Likelihood**: High (when Phase 2 API routes are implemented)

## Findings

**Security Agent Report:**
- `deepMigrationAnalyses` table has no `userId` column
- Access control relies entirely on `bidOpportunityId` foreign key
- No explicit check that requesting user owns the associated bid
- When API routes added, must join through bids table to verify ownership
- Risk of IDOR (Insecure Direct Object Reference) vulnerability

**Current Schema:**
```typescript
// lib/db/schema.ts (deep_migration_analyses)
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bidOpportunityId: text('bid_opportunity_id')
    .notNull()
    .references(() => bidOpportunities.id),
  // ❌ NO userId column
  // ❌ Must join through bids to verify ownership
});
```

**Attack Scenario:**
1. Attacker discovers analysis ID (e.g., via timing attack, leaked logs)
2. Requests `/api/analysis/[id]` (future route)
3. If no ownership check → sees competitor's analysis
4. Learns about competitor's tech stack, migration complexity, PT estimates

## Proposed Solutions

### Solution 1: Add userId Column to Schema (Recommended)
**Pros:**
- Direct ownership tracking
- Fast access control queries (no joins needed)
- Explicit security boundary
- Easier to audit

**Cons:**
- Requires schema migration
- Denormalized data (userId in both tables)

**Effort**: Small (1 hour)
**Risk**: Low

**Implementation:**
```typescript
// lib/db/schema.ts
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id')  // ✅ Add this
    .notNull()
    .references(() => users.id),
  bidOpportunityId: text('bid_opportunity_id')
    .notNull()
    .references(() => bidOpportunities.id),
  // ... rest of schema
});
```

**API Route Example:**
```typescript
// app/api/analysis/[id]/route.ts (Phase 2)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const [analysis] = await db.select()
    .from(deepMigrationAnalyses)
    .where(and(
      eq(deepMigrationAnalyses.id, params.id),
      eq(deepMigrationAnalyses.userId, session.user.id) // ✅ Ownership check
    ));

  if (!analysis) return new Response('Not found', { status: 404 });
  return Response.json(analysis);
}
```

### Solution 2: Always Join Through Bids Table
**Pros:**
- No schema change needed
- Uses existing foreign key

**Cons:**
- Slower queries (requires join)
- More complex access control logic
- Easy to forget join in new routes

**Effort**: Small (per route, recurring)
**Risk**: High (can be forgotten)

**Implementation:**
```typescript
// app/api/analysis/[id]/route.ts (Phase 2)
const [analysis] = await db.select()
  .from(deepMigrationAnalyses)
  .innerJoin(bidOpportunities, eq(deepMigrationAnalyses.bidOpportunityId, bidOpportunities.id))
  .where(and(
    eq(deepMigrationAnalyses.id, params.id),
    eq(bidOpportunities.userId, session.user.id) // ❌ Easy to forget
  ));
```

### Solution 3: Row-Level Security (RLS) at DB Level
**Pros:**
- Enforced at database level
- Can't be bypassed by application code

**Cons:**
- SQLite doesn't support RLS
- Would need to switch to PostgreSQL
- Major infrastructure change

**Effort**: Large (2+ days)
**Risk**: High (migration risk)

## Recommended Action

**Use Solution 1: Add userId Column**

This is the most explicit and maintainable approach. The denormalization is acceptable given the security benefits and query performance improvement.

## Technical Details

**Affected Files:**
- `lib/db/schema.ts` - Add userId column
- `drizzle/migrations/` - Generate new migration
- `lib/inngest/functions/deep-analysis.ts` - Set userId when creating record
- Future API routes - Use userId for access control

**Migration:**
```sql
-- New migration file
ALTER TABLE `deep_migration_analyses` ADD `user_id` text NOT NULL REFERENCES users(id);
CREATE INDEX `idx_deep_migration_analyses_user_id` ON `deep_migration_analyses` (`user_id`);
```

**Breaking Changes:** Existing analysis records (if any) will need userId backfilled

## Acceptance Criteria

- [ ] userId column added to deepMigrationAnalyses schema
- [ ] Migration generated and tested
- [ ] Inngest function sets userId when creating analysis
- [ ] Index created on userId for performance
- [ ] Future API routes use userId for access control (documented in plan)
- [ ] Security test verifies users can't access others' analyses
- [ ] Existing data backfilled (if any records exist)

## Work Log

**2026-01-17**: Issue identified by security-sentinel agent during Epic 7 Phase 1 review

## Resources

- [OWASP IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- Related: ARCH-001 (no API routes yet, must add with proper access control)
- Schema file: `lib/db/schema.ts:345-383`
