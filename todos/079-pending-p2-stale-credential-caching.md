---
status: pending
priority: p2
issue_id: '079'
tags: [code-review, architecture, caching]
dependencies: []
---

# Stale Credential Caching After API Key Rotation

## Problem Statement

`embeddingClientCache`, `providerCache`, and `pdfProviderCache` are keyed by `provider:baseURL` but don't include the API key. When an admin rotates an API key via the UI, `invalidateModelConfigCache()` clears the DB config cache but NOT these provider caches. Old clients with stale keys persist until server restart.

## Findings

- **Source:** Security Sentinel, Pattern Recognition, Silent Failure Hunter
- **Location:** `lib/ai/embedding-config.ts:47`, `lib/ai/model-config.ts:229`, `lib/bids/pdf-extractor.ts`

## Proposed Solutions

### Option A: Wire invalidation to all caches (Recommended)

`invalidateModelConfigCache()` should also clear `embeddingClientCache`, `providerCache`, `pdfProviderCache`.

- **Effort:** Small (15 min) | **Risk:** Low

## Acceptance Criteria

- [ ] `invalidateModelConfigCache()` clears all 3 provider caches
- [ ] API key rotation takes effect without server restart
