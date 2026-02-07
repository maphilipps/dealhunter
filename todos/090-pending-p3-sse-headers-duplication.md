---
status: pending
priority: p3
issue_id: '090'
tags: [code-review, code-quality, dry]
dependencies: []
---

# Duplicated SSE Headers and Cleanup in processing-stream Route

## Problem Statement

SSE response headers duplicated between terminal-job and active-job branches. Cleanup logic (clearInterval + disconnect + controller.close) repeated 3 times. Extract to shared constants and helper.

## Acceptance Criteria

- [ ] SSE headers extracted to `SSE_HEADERS` constant
- [ ] Cleanup logic in shared `closeStream()` function
