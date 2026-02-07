---
status: pending
priority: p1
issue_id: '076'
tags: [code-review, architecture, ai-config, breaking-change]
dependencies: []
---

# Env-Var Fallback for API Keys Removed — Potential Breaking Change

## Problem Statement

`getProviderInstance()` and `getProviderCredentials()` in `lib/ai/model-config.ts` no longer fall back to environment variables (`AI_HUB_API_KEY`, `OPENAI_DIRECT_API_KEY`, etc.) when the DB cache is empty or fails to load. Fresh deployments without DB provider configuration will fail with opaque "Missing API key for provider" errors. The JSDoc for `getProviderCredentials` still says "DB → Env fallback" but there is no env fallback.

## Findings

- **Source:** Architecture Strategist, Silent Failure Hunter, Pattern Recognition agents
- **Location:** `lib/ai/model-config.ts` lines 231-249, 300-309
- **Severity:** CRITICAL — total AI outage on DB failure or fresh deployment
- **Impact:** All AI features throw errors when DB has no provider configs

## Proposed Solutions

### Option A: Restore Env Fallback Chain (Recommended)

- **Pros:** Backward compatible, graceful degradation, works on fresh installs
- **Cons:** Two sources of truth (DB + env)
- **Effort:** Small (15 min)
- **Risk:** Low

### Option B: Document DB-Only Requirement

- **Pros:** Clean single source of truth
- **Cons:** Breaking change for existing deployments
- **Effort:** Small (10 min)
- **Risk:** Medium — requires migration guide

## Technical Details

- **Affected files:** `lib/ai/model-config.ts`
- **Functions:** `getProviderInstance()`, `getProviderCredentials()`
- **Old behavior:** DB → env vars (`AI_HUB_CONFIG`, `OPENAI_CONFIG`)
- **New behavior:** DB only, throws on missing

## Acceptance Criteria

- [ ] Fresh deployment without DB provider config does not crash
- [ ] `loadDBConfig()` catch block has accurate error message (not "using env/defaults")
- [ ] `getProviderCredentials()` JSDoc matches actual behavior
- [ ] `console.warn` in `loadDBConfig` upgraded to `logError` for Sentry tracking

## Work Log

- 2026-02-07: Created from code review (architecture-strategist, silent-failure-hunter agents)
