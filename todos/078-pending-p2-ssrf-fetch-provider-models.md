---
status: pending
priority: p2
issue_id: '078'
tags: [code-review, security, ssrf]
dependencies: []
---

# SSRF Vector in fetchProviderModels

## Problem Statement

`fetchProviderModels` in `lib/admin/ai-config-actions.ts` fetches `${baseUrl}/models` where `baseUrl` is from the DB (admin-settable). An admin could set it to an internal network address to probe infrastructure or exfiltrate API keys.

## Findings

- **Source:** Security Sentinel
- **Location:** `lib/admin/ai-config-actions.ts:229-236`
- **Impact:** Internal network probing, cloud metadata access, API key exfiltration

## Proposed Solutions

### Option A: URL Allowlist (Recommended)

Validate `baseUrl` against known provider URL patterns (_.openai.com, _.anthropic.com, \*.3asabc.de). Reject private IP ranges.

- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] `baseUrl` validated against allowlist before fetch
- [ ] Private/internal IPs rejected
- [ ] HTTPS enforced
