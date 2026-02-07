---
status: pending
priority: p2
issue_id: '084'
tags: [code-review, architecture, streaming]
dependencies: []
---

# Two Incompatible Streaming Architectures in lib/streaming/

## Problem Statement

`lib/streaming/` now contains two streaming paradigms: (1) EventEmitter-based (`event-emitter.ts`, `event-types.ts`) for pitch/lead scans and (2) Redis pub/sub-based (`qualification-events.ts`, `qualification-publisher.ts`) for BullMQ workers. Both have similar event names with different enum values. Future developers could easily confuse them.

## Findings

- **Source:** Architecture Strategist, Pattern Recognition
- **Location:** `lib/streaming/`

## Proposed Solutions

### Option A: Document and organize by subdirectory

Split into `lib/streaming/in-process/` and `lib/streaming/redis/` with clear documentation.

- **Effort:** Medium (30 min) | **Risk:** Low

## Acceptance Criteria

- [ ] Both streaming systems are clearly documented
- [ ] Event type naming collision risk is mitigated
