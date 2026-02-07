---
status: pending
priority: p3
issue_id: '088'
tags: [code-review, observability, ai-sdk]
dependencies: []
---

# onStepFinish Missing from QualificationScan and Pitch Orchestrator

## Problem Statement

The extraction agent has `onStepFinish` for step-level observability, but the qualification-scan agent and pitch orchestrator lack it. This creates inconsistent debugging capabilities.

## Acceptance Criteria

- [ ] `onStepFinish` callback added to qualification-scan agent
- [ ] Step-level tool usage logged for all ToolLoopAgent instances
