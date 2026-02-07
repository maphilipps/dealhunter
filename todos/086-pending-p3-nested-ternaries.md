---
status: pending
priority: p3
issue_id: '086'
tags: [code-review, code-quality]
dependencies: []
---

# Nested Ternaries in Streaming Components

## Problem Statement

Nested ternary operators in `qualification-publisher.ts:194-198` and `processing-chat.tsx:189-209` violate code style guidelines. Should use if/else chains or helper functions.

## Acceptance Criteria

- [ ] `publishSectionProgress` uses if/else instead of nested ternary
- [ ] `processing-chat.tsx` status display extracted to helper function
