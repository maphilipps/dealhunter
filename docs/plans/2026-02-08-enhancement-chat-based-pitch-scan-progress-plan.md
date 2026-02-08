---
title: Chat-basierte Scan-Fortschrittsdarstellung
type: enhancement
date: 2026-02-08
issue: 165
epic: 162
depends_on: [164]
---

# Chat-basierte Scan-Fortschrittsdarstellung

## Overview

Transform the Pitch Scan progress display from a static progress bar to a **dynamic chat-based interface** that narrates the agent's analysis process in real-time. This creates transparency and consistency with the Pre-Qualification Scan UX.

**Part of Epic #162** — Pitch Scan v2 Rewrite
**Depends on:** ✅ #164 (Dynamic Orchestrator) — COMPLETED

## Problem Statement

The current Pitch Scan shows progress as a **progress bar with status text** in a sidebar (`ScanPipelineProgress`). Users cannot see:

- What the agent is concretely analyzing
- Why certain phases are running
- What insights are being discovered
- How phases relate to each other

This creates an **intransparent, uninviting experience** where users just see a percentage increase without context.

## Proposed Solution

Display scan progress as a **chat conversation** analogous to the Pre-Qualification Scan. The agent "narrates" its analysis process with messages like:

```
🤖 Agent: Ich starte die Analyse von example.com...
🤖 Agent: Website erkannt als WordPress-basierte Corporate-Seite.
🤖 Agent: Ich prüfe jetzt die Performance (Lighthouse-Analyse)...
📊 [Performance-Ergebnis als Collapsible Card]
🤖 Agent: Weiter mit der Content-Analyse...
📊 [Content-Ergebnis als Collapsible Card]
🤖 Agent: Analyse abgeschlossen! 4 von 5 geplanten Schritten erfolgreich.
```

### Why Chat-Based?

1. **Transparency** — Users understand what's happening and why
2. **Consistency** — Matches Pre-Qualification Scan UX pattern
3. **Trust** — Chain-of-thought messaging builds confidence
4. **Engagement** — Active conversation feels less like "waiting"
5. **Debugging** — Visible reasoning helps support troubleshoot issues

## Technical Approach

### Architecture Decision (From Brainstorm 2026-02-08)

- ✅ **Reuse PreQual Chat Patterns** — Don't rebuild from scratch
- ✅ **SSE Events as Chat Messages** — Existing infrastructure works
- ✅ **No Message Persistence (v1)** — Chat state is ephemeral during scan
- ✅ **Collapsible Result Cards** — Phase results as expandable UI elements
- ✅ **Dynamic Phase List** — Orchestrator determines phases, UI adapts

### Key Components

#### 1. New Event Types

**File:** `lib/streaming/event-types.ts`

Add chat-specific event types to existing `AgentEventType` enum:

```typescript
enum AgentEventType {
  // ... existing events (START, COMPLETE, ERROR, etc.)

  // NEW: Chat-specific events
  AGENT_THINKING = 'agent-thinking', // AI reasoning/planning message
  AGENT_FINDING = 'agent-finding', // Key insight discovered
  SECTION_RESULT = 'section-result', // Section completion with result
  PLAN_CREATED = 'plan-created', // Orchestrator analysis plan
}

interface AgentThinkingData {
  agent: string;
  message: string;
  reasoning?: string;
  timestamp: string;
}

interface AgentFindingData {
  agent: string;
  finding: string;
  confidence?: number;
  category?: string;
  timestamp: string;
}

interface SectionResultData {
  sectionId: string;
  sectionLabel: string;
  confidence: number;
  summary?: string;
  findings?: Finding[];
  timestamp: string;
}

interface PlanCreatedData {
  phases: Array<{ id: string; label: string }>;
  reasoning?: string;
  estimatedDuration?: number;
  timestamp: string;
}
```

#### 2. Chat Progress Component

**File:** `components/pitch-scan/scan-progress-chat.tsx`

New component following `ProcessingChat.tsx` pattern:

```typescript
interface ScanProgressChatProps {
  pitchId: string;
  runId: string;
}

export function ScanProgressChat({ pitchId, runId }: ScanProgressChatProps) {
  const {
    events,
    phases,
    status,
    progress,
    error,
    isConnected
  } = usePitchScanProgress(pitchId);

  // Filter to visible events only
  const visibleEvents = useMemo(
    () => events.filter(isVisibleEvent),
    [events]
  );

  // Calculate phase completion
  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const totalPhases = phases.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pitch Scan Analysis</CardTitle>
            <CardDescription>
              {status === 'running' && `Analyzing website...`}
              {status === 'completed' && `Analysis complete`}
              {status === 'error' && `Analysis failed`}
            </CardDescription>
          </div>
          <Badge variant={statusToBadgeVariant(status)}>
            {status}
          </Badge>
        </div>

        {/* Progress Bar */}
        {status === 'running' && (
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {completedPhases} of {totalPhases} phases completed
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <Conversation>
          <ConversationContent>
            {/* Collapsible Phase Overview */}
            <Task defaultOpen={false}>
              <TaskTrigger
                completedCount={completedPhases}
                totalCount={totalPhases}
              />
              <TaskContent>
                {phases.map(phase => (
                  <TaskItem
                    key={phase.id}
                    status={phaseStatusToTaskStatus(phase.status)}
                  >
                    {phase.label}
                    {phase.message && (
                      <span className="text-muted-foreground ml-2">
                        {phase.message}
                      </span>
                    )}
                  </TaskItem>
                ))}
              </TaskContent>
            </Task>

            {/* Event Stream */}
            {visibleEvents.map((event, idx) => (
              <EventRenderer key={idx} event={event} />
            ))}

            {/* Live Indicator */}
            {status === 'running' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader className="h-4 w-4" />
                <span className="text-sm">Analyzing...</span>
              </div>
            )}

            {/* Terminal States */}
            {status === 'completed' && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Analysis Complete</AlertTitle>
                <AlertDescription>
                  All phases completed successfully. View results below.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Analysis Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </ConversationContent>

          <ConversationScrollButton />
        </Conversation>
      </CardContent>
    </Card>
  );
}
```

#### 3. Event Renderer

**File:** `components/pitch-scan/event-renderer.tsx`

Type-based event rendering logic:

```typescript
interface EventRendererProps {
  event: AgentEvent;
}

export function EventRenderer({ event }: EventRendererProps) {
  switch (event.type) {
    case AgentEventType.AGENT_THINKING:
      return (
        <Message from="assistant">
          <MessageContent>
            <p>{event.data.message}</p>
            {event.data.reasoning && (
              <Reasoning>
                <ReasoningTrigger />
                <ReasoningContent>{event.data.reasoning}</ReasoningContent>
              </Reasoning>
            )}
          </MessageContent>
        </Message>
      );

    case AgentEventType.AGENT_FINDING:
      return (
        <Message from="assistant">
          <MessageContent>
            <div className="flex items-start gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium">{event.data.finding}</p>
                {event.data.confidence && (
                  <ConfidenceIndicator confidence={event.data.confidence} />
                )}
              </div>
            </div>
          </MessageContent>
        </Message>
      );

    case AgentEventType.SECTION_RESULT:
      return (
        <Message from="assistant">
          <MessageContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium">{event.data.sectionLabel}</span>
              <Badge variant="secondary">
                {Math.round(event.data.confidence * 100)}% confidence
              </Badge>
            </div>
            {event.data.summary && (
              <p className="mt-2 text-muted-foreground">{event.data.summary}</p>
            )}
          </MessageContent>
        </Message>
      );

    case AgentEventType.PLAN_CREATED:
      return (
        <Message from="assistant">
          <MessageContent>
            <p className="font-medium">Analysis plan created:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {event.data.phases.map(phase => (
                <li key={phase.id}>{phase.label}</li>
              ))}
            </ul>
            {event.data.estimatedDuration && (
              <p className="text-sm text-muted-foreground mt-2">
                Estimated duration: ~{event.data.estimatedDuration} minutes
              </p>
            )}
          </MessageContent>
        </Message>
      );

    case AgentEventType.PHASE_START:
      return (
        <Message from="assistant">
          <MessageContent>
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span>Starting {event.data.label}...</span>
            </div>
          </MessageContent>
        </Message>
      );

    case AgentEventType.ERROR:
      return (
        <Message from="assistant">
          <MessageContent>
            <Alert variant="destructive" className="mt-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{event.data.message}</AlertDescription>
            </Alert>
          </MessageContent>
        </Message>
      );

    default:
      return null; // Don't render unknown events
  }
}

// Helper to determine which events should be visible in chat
function isVisibleEvent(event: AgentEvent): boolean {
  const visibleTypes = [
    AgentEventType.AGENT_THINKING,
    AgentEventType.AGENT_FINDING,
    AgentEventType.SECTION_RESULT,
    AgentEventType.PLAN_CREATED,
    AgentEventType.PHASE_START,
    AgentEventType.ERROR,
  ];
  return visibleTypes.includes(event.type);
}
```

#### 4. Update Orchestrator (Optional Enhancement)

**File:** `lib/pitch-scan/orchestrator.ts`

Emit richer chat events at key points:

```typescript
// After plan creation
await publishToChannel(runId, {
  type: AgentEventType.PLAN_CREATED,
  data: {
    phases: plan.phases.map(p => ({ id: p.id, label: p.label })),
    reasoning: 'Based on PreQual requirements and website type',
    estimatedDuration: estimatePhasesDuration(plan.phases),
    timestamp: new Date().toISOString(),
  },
});

// Before phase start
await publishToChannel(runId, {
  type: AgentEventType.AGENT_THINKING,
  data: {
    agent: 'Orchestrator',
    message: `Analyzing ${phase.label}...`,
    reasoning: `This phase is relevant because: ${phase.relevanceReason}`,
    timestamp: new Date().toISOString(),
  },
});

// After phase completion
await publishToChannel(runId, {
  type: AgentEventType.SECTION_RESULT,
  data: {
    sectionId: phase.id,
    sectionLabel: phase.label,
    confidence: result.confidence,
    summary: result.summary,
    findings: result.findings,
    timestamp: new Date().toISOString(),
  },
});
```

#### 5. Update Pitch Scan Client

**File:** `app/(dashboard)/pitches/[id]/pitch-scan/client.tsx`

Add view toggle between grid and chat:

```typescript
'use client';

export function PitchScanClient({ pitchId, runId, initialData }) {
  const [view, setView] = useState<'chat' | 'grid'>('chat');
  const { status } = usePitchScanProgress(pitchId);

  // Default to chat during active scans, grid for completed
  useEffect(() => {
    if (status === 'completed' && view === 'chat') {
      setView('grid');
    }
  }, [status, view]);

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pitch Scan</h1>

        {status === 'completed' && (
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="chat">
                <MessageSquare className="h-4 w-4 mr-2" />
                Progress
              </TabsTrigger>
              <TabsTrigger value="grid">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Results
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Conditional Render */}
      {view === 'chat' && (
        <ScanProgressChat pitchId={pitchId} runId={runId} />
      )}

      {view === 'grid' && (
        <ScanSectionGrid sections={initialData.sections} />
      )}
    </div>
  );
}
```

### Implementation Phases

#### Phase 1: Event Types & Infrastructure (2-3 hours)

**Tasks:**

- [ ] Add new event types to `lib/streaming/event-types.ts`
  - `AGENT_THINKING`, `AGENT_FINDING`, `SECTION_RESULT`, `PLAN_CREATED`
  - TypeScript interfaces for event data
- [ ] Update `isVisibleEvent()` helper function
- [ ] Add event type exports

**Success Criteria:**

- TypeScript compiles without errors
- Event types are available for import
- Existing SSE infrastructure unchanged

#### Phase 2: Chat UI Components (4-5 hours)

**Tasks:**

- [ ] Create `components/pitch-scan/scan-progress-chat.tsx`
  - Reuse `<Conversation>` primitives from ai-elements
  - Implement phase overview with `<Task>` collapsible
  - Add progress bar and status display
  - Handle terminal states (complete, error)
- [ ] Create `components/pitch-scan/event-renderer.tsx`
  - Type-based rendering for each event type
  - Implement `isVisibleEvent()` filter
  - Add icons and styling
- [ ] Update `usePitchScanProgress` hook (if needed)
  - Ensure circular buffer (MAX_EVENTS = 150)
  - Add event filtering utilities

**Success Criteria:**

- Chat component renders correctly
- Events display with appropriate styling
- Scroll-to-bottom works automatically
- Circular buffer prevents memory leaks

#### Phase 3: Client Integration (2-3 hours)

**Tasks:**

- [ ] Update `app/(dashboard)/pitches/[id]/pitch-scan/client.tsx`
  - Add view toggle (chat vs grid)
  - Default to chat during active scans
  - Switch to grid on completion
- [ ] Add route support for view parameter (optional)
  - `/pitch-scan?view=chat`
  - `/pitch-scan?view=grid`
- [ ] Update sidebar navigation (if needed)

**Success Criteria:**

- View toggle works correctly
- Chat view appears during active scans
- Grid view appears on completion
- URL state persists on reload

#### Phase 4: Orchestrator Enhancement (Optional, 2-3 hours)

**Tasks:**

- [ ] Update `lib/pitch-scan/orchestrator.ts`
  - Emit `PLAN_CREATED` after analysis plan generation
  - Emit `AGENT_THINKING` before each phase
  - Emit `SECTION_RESULT` after phase completion with summary
  - Add reasoning/context to messages
- [ ] Test with dynamic orchestrator (#164)

**Success Criteria:**

- Richer messages appear in chat
- Context explains why phases are running
- Findings are structured and clear

#### Phase 5: Testing & Polish (2-3 hours)

**Tasks:**

- [ ] Test with live pitch scan runs
  - Verify events stream correctly
  - Check circular buffer (no memory leaks)
  - Test SSE reconnection on network issues
- [ ] Test view switching
  - Chat → Grid transition smooth
  - State persists correctly
- [ ] Mobile responsiveness
  - Chat scrolls correctly on mobile
  - Collapsible sections work on touch
- [ ] Error states
  - Phase failures display correctly
  - Orchestrator errors don't crash UI
- [ ] Performance
  - No jank with many events
  - Smooth scrolling on slow devices

**Success Criteria:**

- Chat UI works reliably across browsers
- No memory leaks or performance issues
- Error handling is graceful
- Mobile UX is acceptable

### Total Estimated Effort

**12-17 hours** (~2-2.5 days)

## Technical Considerations

### SSE Infrastructure (Already Exists)

- **Endpoint:** `/api/pitches/[id]/progress` (Redis pub/sub)
- **Hook:** `usePitchScanProgress` (EventSource connection)
- **Event Format:** `data: {type, data, timestamp}\n\n`
- **Reconnection:** Exponential backoff, max 5 attempts
- **Heartbeat:** 15s keepalive

✅ **No changes needed** — existing infrastructure supports chat events

### Memory Management (Critical)

**Problem:** Long-running scans (5-10 min) generate 100+ events. Storing all in React state causes memory leaks.

**Solution:** Circular buffer (keep last 150 events)

```typescript
const MAX_EVENTS = 150;

function streamReducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case 'ADD_EVENT': {
      const allEvents = [...state.events, action.event];
      const newEvents =
        allEvents.length > MAX_EVENTS ? allEvents.slice(allEvents.length - MAX_EVENTS) : allEvents;
      return { ...state, events: newEvents };
    }
  }
}
```

### Reducer Pattern (Best Practice)

Use `useReducer` instead of multiple `useState`:

```typescript
type StreamState = {
  events: AgentEvent[];
  phases: PhaseState[];
  status: ScanStatus;
  progress: number;
  error: string | null;
  isConnected: boolean;
};

const [state, dispatch] = useReducer(streamReducer, initialState);
```

**Benefits:**

- Atomic state updates (no race conditions)
- Single re-render per event
- Easier to test
- Matches PreQual pattern

### Performance Optimization

1. **Event Filtering** — Don't render non-visible events
2. **Memoization** — `useMemo` for filtered event lists
3. **Virtualization** (future) — If >500 events, use virtual scrolling
4. **Debounced Scroll** — Scroll-to-bottom debounced at 100ms

### Backward Compatibility

- ✅ Grid view still available (toggle or separate route)
- ✅ Existing SSE events unchanged
- ✅ No database schema changes
- ✅ Old scans still work (show grid only)

## Acceptance Criteria

### Functional Requirements

- [ ] Chat UI displays real-time scan progress as conversation
- [ ] Phase overview shows all phases with live status updates
- [ ] Events render correctly based on type
  - `AGENT_THINKING` → Message with optional reasoning
  - `AGENT_FINDING` → Insight with confidence indicator
  - `SECTION_RESULT` → Completion message with summary
  - `PLAN_CREATED` → Phase list with estimated duration
  - `PHASE_START` → "Starting..." message
  - `ERROR` → Alert with error details
- [ ] Live indicator shows when scan is active
- [ ] Terminal states display correctly (complete, error)
- [ ] View toggle switches between chat and grid
- [ ] SSE reconnection works on network issues

### Non-Functional Requirements

- [ ] **Performance:** No memory leaks on long scans (circular buffer)
- [ ] **Performance:** Smooth scrolling with 150+ events
- [ ] **Performance:** < 16ms render time per event
- [ ] **Reliability:** SSE reconnection works reliably
- [ ] **Reliability:** Error states don't crash UI
- [ ] **UX:** Auto-scroll to bottom during active scan
- [ ] **UX:** Scroll button appears when user scrolls up
- [ ] **Accessibility:** Keyboard navigation works
- [ ] **Accessibility:** Screen reader announces events
- [ ] **Mobile:** Chat scrolls correctly on mobile
- [ ] **Mobile:** Collapsible sections work on touch

### Quality Gates

- [ ] TypeScript compiles without errors
- [ ] No console errors in browser
- [ ] Existing tests pass
- [ ] Manual testing across browsers (Chrome, Safari, Firefox)
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Memory profiler shows no leaks

## Dependencies & Risks

### Dependencies

- ✅ **#164 (Dynamic Orchestrator)** — COMPLETED
  - Provides dynamic phase list
  - Emits plan creation events
  - Graceful error handling
- ✅ **ai-elements library** — Exists
  - `<Conversation>`, `<Message>`, `<Task>`, `<Reasoning>`
- ✅ **SSE infrastructure** — Exists
  - `/api/pitches/[id]/progress`
  - `usePitchScanProgress` hook
  - Redis pub/sub

### Risks & Mitigation

| Risk                            | Impact | Probability | Mitigation                                   |
| ------------------------------- | ------ | ----------- | -------------------------------------------- |
| Memory leaks on long scans      | High   | Medium      | Implement circular buffer (MAX_EVENTS = 150) |
| SSE connection drops            | Medium | Low         | Existing reconnection logic handles this     |
| Too many events (UI jank)       | Medium | Low         | Filter non-visible events, debounce scroll   |
| Orchestrator emits wrong events | Low    | Low         | Type validation via TypeScript interfaces    |
| Mobile scroll issues            | Medium | Medium      | Test early, use ai-elements patterns         |
| Backward compatibility breaks   | High   | Low         | Keep grid view, don't change existing events |

## Success Metrics

### User Experience

- **Transparency:** Users understand what agent is doing at each step
- **Engagement:** Chat feels more active than progress bar
- **Trust:** Chain-of-thought builds confidence in results

### Technical

- **Performance:** < 100ms render time for 150 events
- **Reliability:** < 0.1% SSE connection failure rate
- **Memory:** < 50MB memory usage over 10-minute scan

### Product

- **Consistency:** PreQual and Pitch Scan use same UX pattern
- **Foundation:** Enables future follow-up chat (#162 v2)
- **Flexibility:** Dynamic phases supported (#164 integration)

## Future Considerations (Not in Scope)

### Phase 2 (Epic #162)

- [ ] **Follow-up Chat** — Users ask questions about scan results
  - Requires message persistence
  - Requires LLM integration for responses
  - Separate issue: #TBD

- [ ] **Collapsible Result Cards** (Issue #166)
  - Phase results as expandable cards with full content
  - Replaces simple summary messages
  - Depends on this issue (#165)

- [ ] **Dynamic Navigation** (Issue #167)
  - Sidebar/nav generated from orchestrator plan
  - Links to specific phase cards in chat
  - Depends on #165 and #166

### Long-Term

- [ ] **Chat Persistence** — Save chat history to database
- [ ] **Scan Resumption** — Continue chat on browser refresh
- [ ] **Intelligent Grouping** — Group related phases in chat sections
- [ ] **Virtual Scrolling** — For scans with >500 events

## References & Research

### Internal References

**PreQual Chat Component:**

- `components/qualifications/processing-chat.tsx:1-200` — Reference implementation
- Uses `<Conversation>` + `<Task>` + event stream pattern
- Terminal state handling with alerts

**SSE Infrastructure:**

- `lib/streaming/event-emitter.ts:1-50` — SSE creation utilities
- `lib/streaming/event-types.ts:1-100` — Event type definitions
- `app/api/pitches/[id]/progress/route.ts:1-150` — SSE endpoint (Redis pub/sub)

**Existing Hook:**

- `hooks/use-pitch-scan-progress.ts:1-200` — EventSource connection
- Snapshot hydration, reconnection logic

**AI-Elements Components:**

- `components/ai-elements/conversation.tsx` — Chat container
- `components/ai-elements/message.tsx` — Message display
- `components/ai-elements/task.tsx` — Collapsible phase list
- `components/ai-elements/reasoning.tsx` — Collapsible reasoning
- `components/ai-elements/loader.tsx` — Loading spinner

**Orchestrator:**

- `lib/pitch-scan/orchestrator.ts:1-500` — Phase execution
- `lib/pitch-scan/capabilities.ts:1-300` — Capability pool (#164)

### Institutional Learnings

**AI SDK Patterns:**

- `docs/VERCEL_AI_SDK_V5_RESEARCH.md:677-713` — useChat vs useObject gotcha
- `docs/VERCEL_AI_SDK_V5_RESEARCH.md:789-838` — SSE ReadableStream pattern
- `docs/VERCEL_AI_SDK_V5_RESEARCH.md:1058-1085` — Circular buffer for memory
- `docs/VERCEL_AI_SDK_V5_RESEARCH.md:1086-1111` — Reducer pattern

**Pitch Scan Architecture:**

- `docs/brainstorms/2026-02-08-pitch-scan-rewrite-brainstorm.md:12-75` — Chat UX decision
- `docs/brainstorms/2026-02-08-pitch-scan-rewrite-brainstorm.md:89-110` — Dynamic orchestrator

**Related Issues:**

- Issue #164 — Dynamic Orchestrator ✅ COMPLETED
- Issue #166 — Collapsible Result Cards (depends on #165)
- Issue #167 — Dynamic Navigation (depends on #166)
- Issue #168 — Deeper Prompts (parallel work)

### Key Gotchas

1. **Don't mix useChat + useObject** — Use custom hook with EventSource
2. **SSE headers must be correct** — `Connection: keep-alive` critical
3. **Implement circular buffer** — Prevent memory leaks on long scans
4. **Use useReducer** — Atomic state updates, no race conditions
5. **Filter non-visible events** — Don't render internal events
6. **Chain-of-thought messages** — Not just "Running...", explain WHY

## Implementation Checklist

### Setup

- [ ] Create feature branch: `ralph/165-chat-progress-ui`
- [ ] Review brainstorm: `docs/brainstorms/2026-02-08-pitch-scan-rewrite-brainstorm.md`
- [ ] Review PreQual chat: `components/qualifications/processing-chat.tsx`

### Phase 1: Event Types

- [ ] Add event types to `lib/streaming/event-types.ts`
- [ ] Add TypeScript interfaces for event data
- [ ] Export new types
- [ ] Update `isVisibleEvent()` helper

### Phase 2: Components

- [ ] Create `components/pitch-scan/scan-progress-chat.tsx`
- [ ] Create `components/pitch-scan/event-renderer.tsx`
- [ ] Update `usePitchScanProgress` hook (circular buffer)
- [ ] Add event filtering utilities

### Phase 3: Integration

- [ ] Update `app/(dashboard)/pitches/[id]/pitch-scan/client.tsx`
- [ ] Add view toggle (chat vs grid)
- [ ] Add route param support (optional)
- [ ] Update navigation links

### Phase 4: Orchestrator (Optional)

- [ ] Update orchestrator to emit `PLAN_CREATED`
- [ ] Add `AGENT_THINKING` before phases
- [ ] Add `SECTION_RESULT` after phases
- [ ] Include reasoning/context

### Phase 5: Testing

- [ ] Manual test with live scan
- [ ] Test SSE reconnection
- [ ] Test view switching
- [ ] Test error states
- [ ] Test mobile responsiveness
- [ ] Memory profiling (no leaks)

### Phase 6: Documentation

- [ ] Update component README
- [ ] Add JSDoc comments
- [ ] Document event types

### Phase 7: Merge

- [ ] Create PR
- [ ] Request review
- [ ] Address feedback
- [ ] Merge to main

---

## Related Issues

- **Epic #162** — Pitch Scan v2 (parent)
- **Issue #164** — Dynamic Orchestrator ✅ (dependency)
- **Issue #166** — Collapsible Result Cards (blocked by this)
- **Issue #167** — Dynamic Navigation (blocked by #166)
- **Issue #168** — Deeper Prompts (parallel)
