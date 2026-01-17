---
status: pending
priority: p3
issue_id: PERF-003
tags: [code-review, performance, storage, optimization]
dependencies: []
---

# NICE-TO-HAVE: JSON Compression for Large Analysis Payloads

## Problem Statement

Deep migration analysis results can be large (estimated 1MB+ per analysis with detailed content architecture, accessibility audits, etc.). Storing uncompressed JSON in SQLite text columns wastes storage and slows down queries/transfers.

**Impact**: Larger database size, slower query performance, higher bandwidth costs
**Current**: 4 bids (negligible impact)
**Future**: 10,000 analyses × 1MB = 10GB uncompressed vs ~1GB compressed (90% savings)

## Findings

**Performance Oracle Report:**
- Estimated payload sizes:
  - contentArchitecture: ~200KB (page type mapping, sample URLs)
  - migrationComplexity: ~100KB (detailed factor analysis)
  - accessibilityAudit: ~500KB (per-page audit results)
  - ptEstimation: ~200KB (breakdown by component)
  - **Total: ~1MB per analysis**
- At 10,000 analyses: 10GB uncompressed vs ~1GB with gzip (90% compression ratio typical for JSON)
- Query performance: Larger text columns slow down full table scans

**Trade-offs:**
- CPU cost: Compress on write, decompress on read (negligible with modern CPUs)
- Storage savings: 90% reduction in database size
- Bandwidth savings: Faster API responses (if compressed transfer)

## Proposed Solutions

### Solution 1: gzip Compression with Base64 Encoding (Recommended for Later)
**Pros:**
- 80-90% compression ratio for JSON
- Standard library support (Node.js zlib)
- Transparent to application logic (compress/decompress in accessor functions)

**Cons:**
- Can't query compressed JSON with SQLite JSON functions
- Adds CPU overhead (minimal)
- Need to migrate existing data

**Effort**: Medium (2-3 hours)
**Risk**: Low

**Implementation:**
```typescript
// lib/db/compression.ts
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function compressJSON<T>(data: T): Promise<string> {
  const json = JSON.stringify(data);
  const compressed = await gzipAsync(Buffer.from(json));
  return compressed.toString('base64'); // ✅ Store as base64 text
}

export async function decompressJSON<T>(compressed: string): Promise<T> {
  const buffer = Buffer.from(compressed, 'base64');
  const decompressed = await gunzipAsync(buffer);
  return JSON.parse(decompressed.toString());
}

// Usage in Inngest function:
await db.update(deepMigrationAnalyses).set({
  contentArchitecture: await compressJSON(contentArchResult), // ✅ Compressed
});

// Usage in API route:
const analysis = await db.select()...;
const contentArch = await decompressJSON(analysis.contentArchitecture); // ✅ Decompressed
```

### Solution 2: Store as Binary BLOB
**Pros:**
- More efficient than base64 encoding
- Smaller storage footprint

**Cons:**
- Less portable (harder to inspect in DB tools)
- More complex migration

**Effort**: Medium (3-4 hours)
**Risk**: Medium

### Solution 3: External Object Storage (S3/R2)
**Pros:**
- Unlimited storage
- Keep SQLite lean
- Built-in compression/CDN

**Cons:**
- External dependency
- More complex architecture
- Higher latency for small analyses

**Effort**: Large (1-2 days)
**Risk**: High (architecture change)

## Recommended Action

**DEFER to Phase 3 or later**

This is a performance optimization that's not critical for MVP. Implement when:
1. Database size exceeds 1GB
2. Query performance becomes an issue
3. Bandwidth costs become significant

**Priority**: P3 (Nice-to-have)

If implemented later, use Solution 1 (gzip + base64).

## Technical Details

**Affected Files (when implemented):**
- `lib/db/compression.ts` - NEW helper functions
- `lib/inngest/functions/deep-analysis.ts` - Use compressJSON
- `app/api/bids/[id]/deep-analysis/results/route.ts` - Use decompressJSON
- `drizzle/migrations/XXXX_compress_json.sql` - Migrate existing data

**Database Changes:** None (compression is transparent at storage level)

**Breaking Changes:** Existing uncompressed JSON must be migrated

**Compression Benchmark (typical JSON):**
```
Uncompressed: 1,000,000 bytes
gzip:           100,000 bytes (90% reduction) ✅
base64(gzip):   133,000 bytes (87% reduction after encoding)
```

## Acceptance Criteria

(When implemented in future phase)
- [ ] compressJSON and decompressJSON helper functions
- [ ] All JSON columns compressed on write
- [ ] All JSON columns decompressed on read
- [ ] Existing data migrated to compressed format
- [ ] Performance test: compression overhead < 10ms per analysis
- [ ] Database size reduced by 80%+ after migration
- [ ] Documentation updated with compression strategy

## Work Log

**2026-01-17**: Issue identified by performance-oracle agent during Epic 7 Phase 1 review. Marked as P3 (defer to later phase).

## Resources

- [Node.js zlib Documentation](https://nodejs.org/api/zlib.html)
- [SQLite BLOB Storage](https://www.sqlite.org/datatype3.html)
- [JSON Compression Benchmarks](https://github.com/pieroxy/lz-string)
