---
status: pending
priority: p2
issue_id: '080'
tags: [code-review, performance, database, rag]
dependencies: []
---

# queryRawChunks Loads ALL Chunks + Embeddings Into Memory

## Problem Statement

`queryRawChunks` in `lib/rag/raw-retrieval-service.ts` loads the entire `raw_chunks` table for a qualification (including 3072-dim float vectors ~24KB each) on every call. The orchestrator-worker calls this 10+ times per pipeline, transferring 24-48MB of redundant data.

## Findings

- **Source:** Performance Oracle
- **Location:** `lib/rag/raw-retrieval-service.ts:128-131`
- **Impact:** At scale: 10+ full-table scans per job, 24-48MB redundant transfer per pipeline

## Proposed Solutions

### Option A: Push similarity search to PostgreSQL with pgvector (Recommended)

Use `<=>` operator for cosine distance in SQL. Eliminate in-memory vector transfer entirely.

- **Effort:** Large (2-3h) | **Risk:** Medium

### Option B: Cache chunks within pipeline execution

Load chunks once at orchestrator start, pass through to workers.

- **Effort:** Medium (1h) | **Risk:** Low

## Acceptance Criteria

- [ ] Embedding vectors not transferred to Node.js for similarity search
- [ ] Keyword fallback excludes `embedding` column from SELECT
- [ ] No redundant chunk loading within a single pipeline
