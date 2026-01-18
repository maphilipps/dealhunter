# feat: Strict BL-Review Workflow State Machine

## Enhancement Summary

**Deepened on:** 2026-01-18
**Research agents used:** best-practices-researcher, framework-docs-researcher, security-sentinel, performance-oracle, kieran-typescript-reviewer, code-simplicity-reviewer

### Key Improvements from Research

1. **SIMPLIFIED APPROACH**: Original XState-like architecture reduced by 65% - simple switch function sufficient for linear workflow
2. **SECURITY FIXES**: 5 Critical findings must be addressed (auth, IDOR, race conditions)
3. **PERFORMANCE**: Add database indexes, fix N+1 queries, server-side JSON parsing
4. **TYPE SAFETY**: Discriminated union results, exhaustiveness checking

### Critical Findings to Address

| Priority | Finding | Action |
|----------|---------|--------|
| P0 | Missing auth in `assignBusinessUnit` | Add session check |
| P0 | IDOR in team/routing actions | Add ownership verification |
| P0 | Race condition in transition | Atomic WHERE-clause gates |
| P1 | Missing DB indexes on status | Add composite indexes |
| P1 | N+1 queries in detail page | Single JOIN query |

---

## Overview

Implementierung eines strikten Workflow State Machine für den BL-Review Prozess. Der aktuelle Stand hat UI-Komponenten ohne Workflow-Enforcement - Benutzer können Tabs frei navigieren ohne Validierung. Dieses Feature fügt eine zentrale State Machine mit Validation Gates, automatischen Übergängen und UI-Feedback hinzu.

## Problem Statement

**Aktueller Zustand:**
- UI-Komponenten existieren (6 Tabs: Übersicht, BU Matching, 10 Fragen, Baseline, Planung, Team)
- Keine Workflow-Validierung - alle Tabs sind immer aktiviert
- Status-Änderungen erfolgen in einzelnen Server Actions ohne zentrale Validierung
- Keine automatischen Übergänge nach BIT-Entscheidung
- Race Conditions bei gleichzeitigem Zugriff nicht behandelt

**Zielzustand:**
- Strikte State Machine mit definierten Phasen und Übergängen
- Validation Gates verhindern ungültige Transitionen
- Tabs werden erst aktiviert wenn Vorgänger-Phase abgeschlossen
- Automatische Weiterleitung nach BIT-Entscheidung
- Optimistic Locking für Concurrent Access

## Proposed Solution

### State Machine Definition

```
┌─────────────────┐
│   bit_decided   │ (Entry Point für BL-Review)
└────────┬────────┘
         │ AUTO: route_to_bl()
         ▼
┌─────────────────┐
│     routed      │ Phase 1: BU Matching
│  (BU_PENDING)   │ Gate: Quick Scan muss fertig sein
└────────┬────────┘
         │ ACTION: confirm_bu_assignment()
         ▼
┌─────────────────┐
│   bl_reviewing  │ Phase 2: Deep Analysis
│ (ANALYSIS_PEND) │ Gate: BU Matching bestätigt
└────────┬────────┘
         │ ACTION: complete_analysis()
         ▼
┌─────────────────┐
│ analysis_done   │ Phase 3: Team Assignment
│  (TEAM_PENDING) │ Gate: Deep Analysis fertig
└────────┬────────┘
         │ ACTION: assign_team()
         ▼
┌─────────────────┐
│  team_assigned  │ Phase 4: Notification
│ (NOTIFY_PENDING)│ Gate: Team zugewiesen
└────────┬────────┘
         │ ACTION: notify_team()
         ▼
┌─────────────────┐
│    notified     │ Phase 5: Handoff
└────────┬────────┘
         │ ACTION: complete_handoff()
         ▼
┌─────────────────┐
│   handed_off    │ (Terminal State)
└─────────────────┘
```

### Status Mapping (Schema → Workflow)

| DB Status | Workflow Phase | Tab Enabled | Required Gate |
|-----------|---------------|-------------|---------------|
| `routed` | BU_MATCHING | Overview, BU Matching | quickScanId != null |
| `bl_reviewing` | DEEP_ANALYSIS | + 10 Fragen, Baseline | buMatchingConfirmedAt != null |
| `analysis_complete` | TEAM_ASSIGNMENT | + Planung | deepMigrationAnalysisId != null |
| `team_assigned` | NOTIFICATION | + Team | assignedTeam != null |
| `notified` | HANDOFF | Alle (read-only) | teamNotifiedAt != null |
| `handed_off` | COMPLETE | Alle (archived) | handedOffAt != null |

## Technical Approach

### SIMPLIFIED Architecture (Based on Research)

**Original Plan**: XState-like state machine with separate types, transitions map, Zod gate schemas, custom hooks
**Revised Plan**: Simple function with inline validation - 65% less code, same functionality

```typescript
// lib/workflow/bl-review-status.ts - ONE simple file (50 lines total)
export type BLReviewPhase = 'bu_matching' | 'deep_analysis' | 'team_assignment' | 'notification' | 'handoff';

export function canTransitionTo(
  bid: BidOpportunity,
  nextPhase: BLReviewPhase
): { allowed: boolean; reason?: string } {
  switch (nextPhase) {
    case 'deep_analysis':
      if (!bid.quickScanId) return { allowed: false, reason: 'Quick Scan erforderlich' };
      return { allowed: true };
    case 'team_assignment':
      if (!bid.deepMigrationAnalysisId) return { allowed: false, reason: 'Deep Analysis erforderlich' };
      return { allowed: true };
    case 'notification':
      if (!bid.assignedTeam) return { allowed: false, reason: 'Team erforderlich' };
      return { allowed: true };
    case 'handoff':
      return { allowed: true };
    default:
      return { allowed: true };
  }
}

export function getEnabledTabs(bid: BidOpportunity): string[] {
  const tabs = ['overview'];
  if (bid.quickScanId) tabs.push('bu-matching', 'questions');
  if (bid.deepMigrationAnalysisId) tabs.push('baseline', 'planning');
  tabs.push('team'); // Always show but with gated actions
  return tabs;
}
```

### Security-First Implementation

**CRITICAL: Add these guards to ALL existing Server Actions:**

```typescript
// Pattern for ALL bid-related Server Actions
export async function anyBidAction(bidId: string, ...) {
  // 1. Authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // 2. Authorization (ownership OR role)
  const [bid] = await db.select().from(bidOpportunities)
    .where(eq(bidOpportunities.id, bidId)).limit(1);

  if (!bid) return { success: false, error: 'Bid nicht gefunden' };

  const canAccess = bid.userId === session.user.id ||
                   session.user.role === 'admin' ||
                   (session.user.role === 'bl' && bid.assignedBusinessUnitId === session.user.businessUnitId);
  if (!canAccess) return { success: false, error: 'Keine Berechtigung' };

  // 3. Version check (optimistic locking)
  if (bid.version !== expectedVersion) {
    return { success: false, error: 'Bid wurde zwischenzeitlich geändert' };
  }

  // 4. Gate validation (inline, not separate schema)
  const transitionCheck = canTransitionTo(bid, targetPhase);
  if (!transitionCheck.allowed) {
    return { success: false, error: transitionCheck.reason };
  }

  // 5. Atomic update with version increment
  const [updated] = await db.update(bidOpportunities)
    .set({ status: newStatus, version: bid.version + 1, updatedAt: new Date() })
    .where(and(
      eq(bidOpportunities.id, bidId),
      eq(bidOpportunities.version, bid.version) // CAS check
    ))
    .returning();

  if (!updated) return { success: false, error: 'Update fehlgeschlagen' };

  revalidatePath(`/bl-review/${bidId}`);
  return { success: true };
}
```

### Phase 1: Workflow Engine (`lib/workflow/bl-review-status.ts`)

**Zod Schemas für Validation Gates:**

```typescript
// lib/workflow/gates.ts
const BUMatchingGate = z.object({
  quickScanId: z.string().min(1, "Quick Scan muss abgeschlossen sein"),
  status: z.literal("routed"),
});

const DeepAnalysisGate = z.object({
  status: z.literal("bl_reviewing"),
  buMatchingConfirmedAt: z.date(),
});

const TeamAssignmentGate = z.object({
  status: z.literal("analysis_complete"),
  deepMigrationAnalysisId: z.string().min(1),
  baselineComparisonResult: z.string().min(1),
  projectPlanningResult: z.string().min(1),
});

const NotificationGate = z.object({
  status: z.literal("team_assigned"),
  assignedTeam: z.string().min(1),
});
```

**State Machine mit XState-ähnlicher Struktur:**

```typescript
// lib/workflow/bl-review-machine.ts
type WorkflowState =
  | "routed"
  | "bl_reviewing"
  | "analysis_complete"
  | "team_assigned"
  | "notified"
  | "handed_off";

type WorkflowEvent =
  | { type: "CONFIRM_BU" }
  | { type: "COMPLETE_ANALYSIS" }
  | { type: "ASSIGN_TEAM"; team: TeamAssignment }
  | { type: "NOTIFY_TEAM" }
  | { type: "COMPLETE_HANDOFF" };

const transitions: Record<WorkflowState, Partial<Record<WorkflowEvent["type"], WorkflowState>>> = {
  routed: { CONFIRM_BU: "bl_reviewing" },
  bl_reviewing: { COMPLETE_ANALYSIS: "analysis_complete" },
  analysis_complete: { ASSIGN_TEAM: "team_assigned" },
  team_assigned: { NOTIFY_TEAM: "notified" },
  notified: { COMPLETE_HANDOFF: "handed_off" },
  handed_off: {},
};
```

### Phase 2: Transition Actions (`lib/workflow/actions.ts`)

**Zentrale Transition-Funktion mit Optimistic Locking:**

```typescript
// lib/workflow/actions.ts
async function transition(
  bidId: string,
  event: WorkflowEvent,
  expectedVersion: number
): Promise<{ success: boolean; error?: string; newState?: WorkflowState }> {
  // 1. Load current state
  // 2. Validate gate for transition
  // 3. Compare-and-swap with version check
  // 4. Update status and version
  // 5. Trigger side effects (notifications, etc.)
}
```

### Phase 3: UI Integration

**Workflow Context Hook:**

```typescript
// lib/workflow/use-workflow.ts
function useBLReviewWorkflow(bid: Bid) {
  return {
    currentPhase: mapStatusToPhase(bid.status),
    enabledTabs: getEnabledTabs(bid),
    nextAction: getNextAction(bid),
    canTransition: (event: WorkflowEvent) => validateGate(bid, event),
  };
}
```

**Tab Disabling in Detail Page:**

```typescript
// app/(dashboard)/bl-review/[id]/page.tsx
<TabsTrigger
  value="baseline"
  disabled={!workflow.enabledTabs.includes('baseline')}
>
```

**Progress Header Component:**

```typescript
// components/bl-review/workflow-progress.tsx
function WorkflowProgress({ bid }: { bid: Bid }) {
  const phases = ['BU Matching', 'Deep Analysis', 'Team', 'Notification', 'Handoff'];
  const currentIndex = phases.indexOf(mapStatusToPhase(bid.status));
  // Render progress steps with checkmarks
}
```

### Phase 4: Automatic Transitions

**Nach BIT-Entscheidung → Auto-Route:**

```typescript
// lib/bit-evaluation/actions.ts (erweitern)
// Nach bitDecision = 'bit':
// 1. Quick Scan recommendedBusinessUnit lesen
// 2. assignedBusinessUnitId setzen
// 3. Status auf 'routed' setzen
// 4. BL-User benachrichtigen
```

## Acceptance Criteria

### Functional Requirements

- [ ] Tabs sind disabled bis Vorgänger-Phase abgeschlossen
- [ ] Validation Gates verhindern ungültige Status-Übergänge
- [ ] Nach BIT-Entscheidung erfolgt automatische Weiterleitung an BL
- [ ] Fortschrittsanzeige zeigt aktuelle Phase
- [ ] Clear CTA-Buttons für nächsten Schritt
- [ ] Concurrent Access wird durch Optimistic Locking behandelt

### Non-Functional Requirements

- [ ] Keine Breaking Changes für bestehende Daten
- [ ] Alle bestehenden Server Actions bleiben kompatibel
- [ ] TypeScript strict mode compliance
- [ ] Zod Validation für alle Gates

### Quality Gates

- [ ] Unit Tests für State Machine Transitions
- [ ] Integration Tests für Gate Validation
- [ ] E2E Tests für kompletten Workflow
- [ ] Browser Tests mit Chrome DevTools MCP

## Implementation Phases (SIMPLIFIED)

### Phase 1: Workflow Status Helpers (Foundation)

**Files:**
- `lib/workflow/bl-review-status.ts` - ONE file with all helpers (50 lines)

**Tasks:**
1. `canTransitionTo()` function
2. `getEnabledTabs()` helper
3. `getWorkflowProgress()` for progress indicator

**NOT NEEDED (per simplicity review):**
- ~~`lib/workflow/types.ts`~~ - Use existing schema types
- ~~`lib/workflow/gates.ts`~~ - Inline validation
- ~~`lib/workflow/bl-review-machine.ts`~~ - Switch statement sufficient
- ~~`lib/workflow/actions.ts`~~ - Extend existing actions

### Phase 2: Database Schema Update

**Files:**
- `lib/db/schema.ts` - Neue Felder hinzufügen

**Tasks:**
1. `buMatchingConfirmedAt` Timestamp hinzufügen
2. `analysisCompletedAt` Timestamp hinzufügen
3. `handedOffAt` Timestamp hinzufügen
4. Migration ausführen

### Phase 3: Server Actions Integration

**Files:**
- `lib/routing/actions.ts` - confirm_bu_assignment
- `lib/baseline-comparison/actions.ts` - complete_analysis
- `lib/team/actions.ts` - assign_team (erweitern)
- `lib/notifications/actions.ts` - notify_team (erweitern)
- `lib/workflow/handoff-actions.ts` - complete_handoff (neu)

**Tasks:**
1. Bestehende Actions mit Workflow Gates wrappen
2. Neue handoff Action erstellen
3. Auto-routing nach BIT-Entscheidung integrieren

### Phase 4: UI Components

**Files:**
- `components/bl-review/workflow-progress.tsx` - Progress Header
- `components/bl-review/workflow-cta.tsx` - Next Step CTA
- `app/(dashboard)/bl-review/[id]/page.tsx` - Tab Disabling
- `lib/workflow/use-workflow.ts` - React Hook

**Tasks:**
1. Workflow Progress Component
2. CTA Button Component
3. Tab Disabling Logic
4. useWorkflow Hook

### Phase 5: Auto-Routing Integration

**Files:**
- `lib/bit-evaluation/actions.ts` - Auto-route nach BIT

**Tasks:**
1. Nach bitDecision='bit' automatisch routen
2. BL-User benachrichtigen (optional)

## Performance Optimizations (From Research)

### Database Indexes (CRITICAL)

```typescript
// lib/db/schema.ts - Add to bidOpportunities table
export const bidOpportunities = sqliteTable('bid_opportunities', {
  // ... existing fields ...
}, (table) => ({
  statusIdx: index("bids_status_idx").on(table.status),
  userStatusIdx: index("bids_user_status_idx").on(table.userId, table.status),
}));
```

### Server-Side JSON Parsing

Parse JSON once in Server Component, not repeatedly in Client:
```typescript
// app/(dashboard)/bl-review/[id]/page.tsx
const parsedBid = {
  ...bid,
  extractedRequirements: safeJsonParseOrNull(bid.extractedRequirements),
  bitDecisionData: safeJsonParseOrNull(bid.bitDecisionData),
  // ... other JSON fields
};
```

### Single JOIN Query for Detail Page

Replace multiple queries with one:
```typescript
const [fullBidData] = await db
  .select({ bid: bidOpportunities, quickScan: quickScans, user: users })
  .from(bidOpportunities)
  .leftJoin(quickScans, eq(bidOpportunities.quickScanId, quickScans.id))
  .leftJoin(users, eq(bidOpportunities.userId, users.id))
  .where(eq(bidOpportunities.id, id))
  .limit(1);
```

## Dependencies & Prerequisites

- Bestehende BL-Review UI Components (✅ bereits implementiert)
- Quick Scan Functionality (✅ vorhanden)
- Baseline Comparison (✅ vorhanden)
- Team Builder (✅ vorhanden)
- Notification System (✅ vorhanden)

## Risk Analysis & Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing data | Migration mit Default-Werten für neue Felder |
| Race Conditions | Optimistic Locking mit Version Check |
| Complex State Logic | Unit Tests für alle Transitions |
| UI Performance | Memoization für Workflow Hook |

## References & Research

### Internal References
- `lib/db/schema.ts:37-54` - Current status enum
- `app/(dashboard)/bl-review/[id]/page.tsx` - Detail page with tabs
- `components/bl-review/bu-matching-tab.tsx` - BU Matching UI

### External References
- XState v5 Documentation: https://stately.ai/docs/xstate-v5
- Zod Validation: https://zod.dev/
- Next.js Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- Optimistic Updates: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#optimistic-updates

### Research Findings
- Best Practice: Server-side State Machine mit Client-side Optimistic UI
- Empfohlen: Zod für Gate Validation statt manuelle Checks
- Pattern: Compare-and-swap für Concurrent Access
