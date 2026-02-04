---
status: complete
priority: p1
issue_id: '094'
tags: [code-review, agent-native, deep-scan-v2, discovery]
dependencies: []
---

# Deep Scan Agent Not Registered in Capabilities

## Problem Statement

The `/api/agent/capabilities` endpoint lists 4 agents (extraction, quick-scan, bit-evaluation, team) but does not include a "deep-scan" agent entry. Agents cannot discover Deep Scan v2 capabilities through the standard discovery mechanism.

## Findings

**Agent:** agent-native-reviewer

**File:** `app/api/agent/capabilities/route.ts`
**Lines:** 42-70

The `agents` array in the capabilities response does not include deep-scan:

```typescript
agents: [
  {
    id: 'extraction',
    name: 'Extraction Agent',
    // ...
  },
  {
    id: 'quick-scan',
    name: 'Quick Scan Agent',
    // ...
  },
  // NO deep-scan entry!
];
```

**Impact:**

- Agents cannot discover Deep Scan v2 tools via standard API
- Breaks agent-native discoverability principle
- External agents have no way to know Deep Scan exists

## Proposed Solutions

### Option A: Add Deep Scan agent to capabilities (Required)

**Pros:** Enables discovery
**Cons:** None
**Effort:** Small
**Risk:** Low

```typescript
{
  id: 'deep-scan',
  name: 'Deep Scan Agent',
  description: 'Führt umfassende Website-Analyse durch: Tech-Stack, Performance, Accessibility, Component-Analyse und generiert Indication-Dokumente',
  status: 'active',
}
```

## Recommended Action

Add the deep-scan agent entry to the capabilities endpoint.

## Technical Details

**Affected Files:**

- `app/api/agent/capabilities/route.ts`

## Acceptance Criteria

- [ ] Deep Scan agent appears in `/api/agent/capabilities` response
- [ ] All 8 Deep Scan tools are listed in the tools section
- [ ] Description accurately describes capabilities

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-04 | Created | From agent-native-reviewer |

## Resources

- PR: feat/deep-scan-v2-agent-native
