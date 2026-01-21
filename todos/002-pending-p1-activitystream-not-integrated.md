---
status: pending
priority: p1
issue_id: '002'
tags: [code-review, architecture, ui-integration, epic-5a]
dependencies: []
---

# ActivityStream Component Not Integrated

## Problem Statement

The ActivityStream component was built as the centerpiece of Epic 5a (Agent Transparency UI) but is not integrated into the bid detail page. Users still see the old evaluation UI instead of the real-time streaming agent activity. The entire point of Epic 5a - making agent execution transparent - is not delivered.

**Why it matters:**

- Core feature requirement (TRANS-001) not implemented
- User experience remains opaque and blocking
- All the streaming infrastructure is built but unused
- Epic 5a marked as complete but not actually functional

## Findings

**Location:** `components/bids/bid-detail-client.tsx` (ActivityStream never imported or used)
**Location:** `components/ai-elements/activity-stream.tsx` (Built but orphaned)

**Evidence:**
From Architecture Strategist review:

> "CRITICAL GAP: ActivityStream component built but NEVER INTEGRATED into bid-detail-client.tsx. Users still see old EvaluationProgress component instead of real-time streaming."

**Current State:**

- ✅ ActivityStream component exists and is functional
- ✅ SSE endpoints work
- ✅ useAgentStream hook works
- ❌ Component not used anywhere
- ❌ EvaluationProgress still shows static progress
- ❌ No real-time agent activity visible to users

**Source:** Architecture Strategist review agent

## Proposed Solutions

### Solution 1: Replace EvaluationProgress with ActivityStream (Recommended)

Directly swap the components in bid-detail-client.tsx.

**Pros:**

- Simplest solution
- Delivers Epic 5a as designed
- Uses all built infrastructure
- Immediate visual feedback

**Cons:**

- Removes old progress UI (but that's the goal)
- May need to handle backwards compatibility for old bids

**Effort:** Small (1-2 hours)
**Risk:** Low

**Implementation:**

```typescript
// components/bids/bid-detail-client.tsx

// Remove old import
- import { EvaluationProgress } from './evaluation-progress';

// Add new import
+ import { ActivityStream } from '@/components/ai-elements/activity-stream';

// In the component JSX, replace:
- <EvaluationProgress bid={bid} />

// With:
+ <ActivityStream
+   streamUrl={`/api/bids/${bid.id}/evaluate/stream`}
+   title="BIT Evaluation"
+   onComplete={(decision) => {
+     // Refresh bid data or navigate
+     router.refresh();
+   }}
+   autoStart={true}
+ />
```

### Solution 2: Conditional Rendering (Old + New)

Show ActivityStream for new evaluations, EvaluationProgress for completed ones.

**Pros:**

- Preserves old UI for historical data
- Smoother migration path
- Can A/B test

**Cons:**

- More complex
- Maintains two codepaths
- Against YAGNI principle

**Effort:** Medium (3-4 hours)
**Risk:** Low

### Solution 3: Tabbed Interface

Tabs for "Live Stream" vs "Results Summary"

**Pros:**

- Users can choose view mode
- Best of both worlds

**Cons:**

- Over-engineered for current need
- Adds UI complexity
- Not in original spec

**Effort:** Medium (4-5 hours)
**Risk:** Low

**Not Recommended** - violates YAGNI.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `components/bids/bid-detail-client.tsx` (primary integration point)
- `components/bids/evaluation-progress.tsx` (may be replaced/deprecated)
- `app/(dashboard)/bids/[id]/page.tsx` (parent page, may need updates)

**Affected Components:**

- BidDetailClient (main integration)
- ActivityStream (already built, needs wiring)
- EvaluationProgress (to be replaced or conditionally rendered)

**Database Changes:**
None required.

**API Changes:**
None required - SSE endpoints already exist.

## Acceptance Criteria

- [ ] ActivityStream component visible on bid detail page
- [ ] Real-time agent events stream during evaluation
- [ ] Users see Capability, Deal Quality, Strategic Fit, Competition agents in action
- [ ] Auto-scroll to latest events works
- [ ] Abort button functional (cancels stream)
- [ ] Confidence indicators show for each agent
- [ ] Final decision displayed at end of stream
- [ ] Old EvaluationProgress removed or conditionally hidden
- [ ] No console errors during streaming
- [ ] Refresh after completion updates bid status

## Work Log

**2026-01-16**: Todo created from Architecture Strategist review findings

## Resources

- Architecture Strategist review report
- Epic 5a implementation plan
- ActivityStream component: `components/ai-elements/activity-stream.tsx`
- BidDetailClient: `components/bids/bid-detail-client.tsx`
- SSE endpoint: `app/api/bids/[id]/evaluate/stream/route.ts`
