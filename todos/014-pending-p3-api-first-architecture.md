---
status: pending
priority: p3
issue_id: ARCH-002
tags: [code-review, architecture, api, design]
dependencies: [ARCH-001]
---

# NICE-TO-HAVE: API-First Architecture for Deep Analysis

## Problem Statement

The Epic 7 implementation plan follows a UI-first approach (Phases 1-5), with API routes added as an afterthought in Phase 1.5 (per ARCH-001). A more maintainable approach would be API-first: design and implement API contracts before UI, ensuring the feature is composable and testable from the start.

**Impact**: Architectural technical debt, harder to refactor, less testable, API design constrained by UI assumptions
**Severity**: Design philosophy, not a critical bug

## Findings

**Architecture Strategist Report:**
- Current plan: Foundation → UI → API routes (as afterthought)
- Better pattern: Foundation → API routes → UI (consumes API)
- Benefits of API-first:
  - Forces clear interface design
  - UI becomes a client of the API (like agents, mobile apps, etc.)
  - Easier to test (API endpoints vs UI integration tests)
  - Enables parallel UI/backend development
  - Better separation of concerns

**Current Plan Phases:**
1. ✅ Phase 1: Database schema + Inngest placeholder
2. ❌ Phase 2: Content Architecture Agent (directly used by UI)
3. ❌ Phase 3: Migration Complexity Agent (directly used by UI)
4. ❌ Phase 4: Accessibility Audit Agent (directly used by UI)
5. ❌ Phase 5: PT Estimation Agent (directly used by UI)

**API-First Would Be:**
1. ✅ Phase 1: Database schema + Inngest placeholder
2. ✅ Phase 1.5: API routes (ARCH-001)
3. Phase 2: Implement agents (used by API routes)
4. Phase 3: UI (consumes API routes)
5. Phase 4: Polish and optimization

## Proposed Solutions

### Solution 1: Refactor Plan to API-First (Recommended for Future Features)
**Pros:**
- Better architecture
- More testable
- Enables parallel development
- UI and agents use same API

**Cons:**
- Delays UI visibility
- Requires API design upfront
- More planning work

**Effort**: N/A (plan change, not code change)
**Risk**: Low (improves architecture)

**Recommended Approach for NEXT Epic:**
```
Phase 1: Foundation (database, schemas, types)
Phase 2: API Design (OpenAPI spec, type definitions)
Phase 3: API Implementation (routes, validation, auth)
Phase 4: Agent Implementation (called by API routes)
Phase 5: UI Implementation (calls API routes)
```

### Solution 2: Keep UI-First for MVP, Refactor Later
**Pros:**
- Faster to show working UI
- Easier to iterate on UX
- Less upfront planning

**Cons:**
- API design constrained by UI needs
- Harder to refactor later
- More integration test complexity

**Effort**: N/A (current approach)
**Risk**: Medium (accumulates tech debt)

### Solution 3: Hybrid Approach
**Pros:**
- Implement API routes first (ARCH-001)
- Use them in UI from day 1
- Best of both worlds

**Cons:**
- Requires discipline to not bypass API
- Need to design API before implementing agents

**Effort**: Small (planning only)
**Risk**: Low

## Recommended Action

**For Epic 7: Accept current UI-first approach (already in progress)**

**For Future Epics: Adopt API-first approach**

This is not critical for Epic 7 since we're adding API routes in Phase 1.5 (ARCH-001), but future epics should start with API design.

## Technical Details

**Affected Files (future epics):**
- `docs/api-design.md` - OpenAPI specification
- `app/api/*` - API routes implemented first
- `lib/agents/*` - Agents called by API routes
- `components/*` - UI consumes API routes

**Design Pattern:**
```
┌─────────────────────────────────────┐
│             UI Layer                │
│  (React components, forms, charts)  │
└─────────────┬───────────────────────┘
              │ HTTP/SSE
              ▼
┌─────────────────────────────────────┐
│          API Routes Layer           │
│  (Auth, validation, orchestration)  │
└─────────────┬───────────────────────┘
              │ Direct function calls
              ▼
┌─────────────────────────────────────┐
│          Agent Layer                │
│  (AI SDK, business logic, tools)    │
└─────────────┬───────────────────────┘
              │ ORM queries
              ▼
┌─────────────────────────────────────┐
│         Database Layer              │
│         (Drizzle ORM)               │
└─────────────────────────────────────┘
```

**Benefits:**
- UI can be replaced (mobile app, CLI, etc.) without touching agents
- Agents can be called by webhooks, cron jobs, etc. without touching UI
- API routes can be versioned independently
- Integration tests focus on API contracts, not UI rendering

## Acceptance Criteria

(For future epics, not Epic 7)
- [ ] OpenAPI specification written before implementation
- [ ] API routes implemented and tested before UI
- [ ] UI consumes API routes exclusively (no direct agent calls)
- [ ] API documentation generated from spec
- [ ] Integration tests cover API endpoints
- [ ] Agent-native compliance verified (agents can call APIs)

## Work Log

**2026-01-17**: Issue identified by architecture-strategist during Epic 7 Phase 1 review. Marked as P3 (design guidance for future work).

## Resources

- [API-First Design Principles](https://swagger.io/resources/articles/adopting-an-api-first-approach/)
- [OpenAPI Specification](https://swagger.io/specification/)
- Related: ARCH-001 (add API routes to Epic 7)
- Similar pattern: Stripe API (API-first, UI consumes API)
