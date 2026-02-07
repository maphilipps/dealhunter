---
status: pending
priority: p3
issue_id: '087'
tags: [code-review, code-quality, yagni]
dependencies: []
---

# Unused TaskContext in ai-elements/task.tsx

## Problem Statement

`TaskContext` provides `isOpen` but no consumer reads it. `useTask()` is called with an eslint-disable for unused variable. Either justify the context or remove it.

## Acceptance Criteria

- [ ] TaskContext removed or justified with documentation
- [ ] No eslint-disable for unused variables
