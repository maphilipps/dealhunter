---
status: pending
priority: p1
issue_id: '002'
tags: [code-review, performance, quick-scan, ai-sdk]
dependencies: []
---

# Sequential AI Calls Create Performance Bottleneck

## Problem Statement

The Quick Scan runs 4 AI calls **sequentially** when 3 of them could run in **parallel**. This creates an artificial 2-3x performance penalty, taking 40-60 seconds when it could complete in 12-20 seconds.

**Impact:** HIGH - Directly violates QUICK-005 requirement (complete within 5 minutes) and creates poor user experience.

**Location:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/agent.ts:58-76`

## Findings

**From performance-oracle agent:**

Current implementation (SEQUENTIAL - O(n) time):

```typescript
const techStack = await detectTechStack(htmlContent, input.websiteUrl);
const contentVolume = await analyzeContentVolume(htmlContent);
const features = await detectFeatures(htmlContent);
const blRecommendation = await recommendBusinessLine({
  techStack,
  contentVolume,
  features,
  extractedRequirements: input.extractedRequirements,
});
```

**Performance Analysis:**

- `detectTechStack`: ~10-15s
- `analyzeContentVolume`: ~10-15s
- `detectFeatures`: ~8-12s
- `recommendBusinessLine`: ~8-10s (depends on previous results)

**Current total:** 40-60s (all sequential)
**Optimal total:** 12-20s (parallel + sequential)
**Performance gain:** 60-70% reduction

**Why sequential is unnecessary:**

- Tech stack, content, and features are independent analyses
- All read from the same HTML input
- No data dependencies between them
- Only BL recommendation needs the results of all three

## Proposed Solutions

### Solution 1: Promise.all for Independent Calls (Recommended)

**Effort:** Small (5-10 minutes)
**Risk:** Low
**Pros:** Simple, dramatic performance improvement, no architectural changes
**Cons:** None

```typescript
// Parallel execution: O(1) time
const [techStack, contentVolume, features] = await Promise.all([
  detectTechStack(htmlContent, input.websiteUrl),
  analyzeContentVolume(htmlContent),
  detectFeatures(htmlContent),
]);

// BL recommendation depends on previous results, so must be sequential
const blRecommendation = await recommendBusinessLine({
  techStack,
  contentVolume,
  features,
  extractedRequirements: input.extractedRequirements,
});
```

### Solution 2: Batch into Single AI Call

**Effort:** Medium (30-45 minutes)
**Risk:** Medium (changes prompt structure)
**Pros:** Single API call, even faster, lower cost
**Cons:** Larger prompt, harder to debug, loss of modularity

Combine all 4 analyses into one `generateObject` call with a union schema.

**Not recommended** - modularity and maintainability are more valuable than marginal gains.

## Recommended Action

**Implement Solution 1 immediately.** This is a trivial code change with massive impact.

## Technical Details

**Affected Files:**

- `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/agent.ts:58-76` (change to Promise.all)

**Database Changes:** None

**Breaking Changes:** None - output remains identical

**Testing Requirements:**

- Verify all 4 analyses still return correct data
- Measure actual performance improvement (expect 40-60s → 15-25s)
- Ensure error handling works (if one parallel call fails, others should still complete or all should fail gracefully)

## Acceptance Criteria

- [ ] Tech stack, content, and features run in parallel using `Promise.all`
- [ ] BL recommendation runs after parallel calls complete
- [ ] Total Quick Scan time reduced to <25 seconds (measured in logs)
- [ ] Error in one parallel call doesn't crash entire scan (graceful degradation)
- [ ] All existing tests pass
- [ ] Activity log shows correct timestamps (parallel calls should have similar start times)

## Work Log

<!-- Add dated entries as you work on this -->

## Resources

- Vercel AI SDK Docs: Parallel `generateObject` calls
- Promise.all MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
- Performance Oracle Review: See agent output above
