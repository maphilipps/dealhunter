---
status: pending
priority: p2
issue_id: "054"
tags: [code-review, performance, dea-186, database]
dependencies: []
---

# Missing Database Index on rawChunks.rfpId

## Problem Statement

There is no database index on the `rawChunks.rfpId` column, causing every RAG query to perform a full table scan. This will cause significant performance degradation at scale.

**Why it matters:**
- Every RAG query scans ALL chunks in the table
- At 100k total chunks: linear scan for each query
- 13 sequential queries per extraction = 13 full table scans
- Critical performance bottleneck

## Findings

### Performance Oracle Analysis

**Location:** `lib/rag/raw-retrieval-service.ts:99-102`

**Query Pattern:**
```typescript
const chunks = await db
  .select()
  .from(rawChunks)
  .where(eq(rawChunks.rfpId, query.rfpId)); // No LIMIT, full scan
```

**Performance Impact:**
| Chunks | Current (no index) | With Index |
|--------|-------------------|------------|
| 1,000  | ~100ms            | ~1ms       |
| 10,000 | ~1s               | ~1ms       |
| 100,000| ~10s              | ~1ms       |

**Schema Review:**
The `rawChunks` table in `lib/db/schema.ts` does not define an index on `rfpId`.

## Proposed Solutions

### Option A: Add Index via Migration (Recommended)
**Pros:** Proper database solution, dramatic performance improvement
**Cons:** Requires migration
**Effort:** Small (15 minutes)
**Risk:** Low

```typescript
// drizzle migration
CREATE INDEX idx_rawchunks_rfpid ON rawChunks(rfpId);
CREATE INDEX idx_rawchunks_rfpid_chunkindex ON rawChunks(rfpId, chunkIndex);
```

Or in Drizzle schema:
```typescript
export const rawChunks = sqliteTable('rawChunks', {
  // ... existing columns
}, (table) => ({
  rfpIdIdx: index('idx_rawchunks_rfpid').on(table.rfpId),
  rfpIdChunkIdx: index('idx_rawchunks_rfpid_chunk').on(table.rfpId, table.chunkIndex),
}));
```

### Option B: Add with db:push
**Pros:** Quick for development
**Cons:** Not a proper migration
**Effort:** Small (5 minutes)
**Risk:** Low

Update schema and run `npm run db:push`.

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected Files:**
- `lib/db/schema.ts` - Add index definition
- Migration file (if using migrations)

**Components:** Database, RAG Pipeline

**Database Changes:**
- Add index `idx_rawchunks_rfpid` on `rawChunks(rfpId)`
- Optional: Add composite index on `(rfpId, chunkIndex)`

## Acceptance Criteria

- [ ] Add index on rawChunks.rfpId in schema
- [ ] Run db:push or create migration
- [ ] Verify index exists with `.schema` command
- [ ] Benchmark query performance improvement

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Created from PR #11 review | Performance oracle flagged critical bottleneck |

## Resources

- PR: https://github.com/maphilipps/dealhunter/pull/11
- Linear Issue: DEA-186
- SQLite Index docs: https://www.sqlite.org/lang_createindex.html
