---
status: pending
priority: p2
issue_id: '082'
tags: [code-review, agent-tools, silent-failure]
dependencies: []
---

# wrapRegistryTools Silently Skips Unknown Tools

## Problem Statement

`wrapRegistryTools` in `lib/agent-tools/ai-sdk-bridge.ts` silently skips unknown tools with only a `console.warn`. If a tool name is misspelled or fails to register, the agent runs with reduced capabilities. This is inconsistent with `wrapRegistryTool` (singular) which throws.

## Findings

- **Source:** Silent Failure Hunter, Agent-Native Reviewer, TypeScript Reviewer
- **Location:** `lib/agent-tools/ai-sdk-bridge.ts:66-69`

## Proposed Solutions

### Option A: Throw on unknown tools (Recommended)

Match `wrapRegistryTool` behavior — fail fast on missing tools.

- **Effort:** Small (5 min) | **Risk:** Low

## Acceptance Criteria

- [ ] `wrapRegistryTools` throws when requested tools are missing
- [ ] Error message lists all missing tool names
