---
status: pending
priority: p1
issue_id:
tags: [code-review, database, migrations, performance, pgvector, indexes]
dependencies: [065-pending-p1-migration-history-wiped]
---

# Vector Index Not in Migration Journal

## Problem Statement

The file `drizzle/0001_create_vector_indexes.sql` exists but is NOT registered in `drizzle/meta/_journal.json`. This means the vector indexes may not be created during automated deployments, causing O(n) instead of O(log n) similarity searches - a severe performance degradation that scales with data size.

## Findings

- **Source:** code-review
- **Files:**
  - `drizzle/0001_create_vector_indexes.sql` - EXISTS but not in journal
  - `drizzle/meta/_journal.json` - Missing entry for 0001
- **Severity:** P1 - Critical performance issue + deployment failure
- **Impact:**
  - Similarity searches degrade from O(log n) to O(n)
  - Automated deployments skip index creation
  - Performance degrades exponentially with data growth

**Evidence:**

The migration file exists:

```
?? drizzle/0001_create_vector_indexes.sql
```

But journal only has one entry (likely 0000), missing 0001.

**Performance Impact:**

Without HNSW/IVFFlat indexes on vector columns:

- 10K records: ~100ms -> ~1s (10x slower)
- 100K records: ~100ms -> ~10s (100x slower)
- 1M records: ~100ms -> ~100s (1000x slower)

## Proposed Solutions

### Solution 1: Add Migration to Journal (Recommended)

Manually add the 0001 migration entry to `_journal.json`.

```json
{
  "entries": [
    {
      "idx": 0,
      "version": "5",
      "when": 1737763200000,
      "tag": "0000_dry_zuras",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "5",
      "when": 1737763201000,
      "tag": "0001_create_vector_indexes",
      "breakpoints": true
    }
  ]
}
```

**Pros:** Fixes the issue, indexes created on deployment
**Cons:** Manual journal editing
**Effort:** Small (15 minutes)
**Risk:** Low

### Solution 2: Regenerate Migrations with Drizzle

Use `drizzle-kit generate` to create a new migration that includes indexes.

**Pros:** Uses standard tooling
**Cons:** May create duplicate/conflicting migrations
**Effort:** Medium
**Risk:** Medium

### Solution 3: Manual Index Creation Script

Create a separate script to verify and create indexes post-deployment.

```bash
#!/bin/bash
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);"
```

**Pros:** Works regardless of migration state
**Cons:** Outside of migration system, can drift
**Effort:** Small
**Risk:** Medium - not tracked in migrations

## Recommended Action

Solution 1 - Add the migration to the journal immediately.

Additionally:

1. Verify the index SQL is correct for PostgreSQL/pgvector
2. Test on staging environment first
3. Monitor query performance after deployment

## Technical Details

**Affected Files:**

- `drizzle/0001_create_vector_indexes.sql`
- `drizzle/meta/_journal.json`

**Expected Index Creation SQL:**

```sql
-- For pgvector with HNSW index (recommended for high recall)
CREATE INDEX IF NOT EXISTS idx_rfp_embeddings_vector
ON rfp_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For raw_chunks table
CREATE INDEX IF NOT EXISTS idx_raw_chunks_embedding
ON raw_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Verification Query:**

```sql
-- Check if indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('rfp_embeddings', 'raw_chunks')
AND indexdef LIKE '%hnsw%';
```

## Acceptance Criteria

- [ ] `drizzle/meta/_journal.json` includes entry for `0001_create_vector_indexes`
- [ ] Index migration runs successfully on `drizzle-kit migrate`
- [ ] Vector indexes verified in production database
- [ ] Similarity search queries use index (check with EXPLAIN ANALYZE)
- [ ] Query time for similarity search < 100ms for 100K records

## Work Log

| Date       | Action                   | Learnings                                    |
| ---------- | ------------------------ | -------------------------------------------- |
| 2026-01-25 | Created from code review | Always verify migration files are in journal |

## Resources

- pgvector Index Docs: https://github.com/pgvector/pgvector#indexing
- Drizzle Migration Docs: https://orm.drizzle.team/docs/migrations
- Depends on: 065-pending-p1-migration-history-wiped
