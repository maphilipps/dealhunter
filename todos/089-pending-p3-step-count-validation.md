---
status: pending
priority: p3
issue_id: '089'
tags: [code-review, ai-sdk, monitoring]
dependencies: []
---

# Extraction Agent Step Limit Reduced to 25 — Needs Validation

## Problem Statement

`stepCountIs(50)` was reduced to `stepCountIs(25)` in the extraction agent. For complex documents with 20+ fields, 25 steps may force early termination. Monitor logs for cases where `completeExtraction` is never called.

## Acceptance Criteria

- [ ] Warning logged when step limit reached without `completeExtraction`
- [ ] Real-world validation confirms 25 steps is sufficient
