---
title: 'Epic: Pitch Scan v2 — PreQual-Style Chat UX Rewrite'
type: enhancement
date: 2026-02-08
issue: 162
sub_issues: [163, 164, 165, 166, 167, 168]
---

# Epic: Pitch Scan v2 — PreQual-Style Chat UX Rewrite

**Issue:** #162
**Brainstorm:** `docs/brainstorms/2026-02-08-pitch-scan-rewrite-brainstorm.md`

## Status (Today)

- [x] #163 Model-Fallback-Chain im AI-Layer (geschlossen)
- [x] #164 Dynamischer Orchestrator mit Analyse-Plan (geschlossen)
- [x] #165 Chat-basierte Scan-Fortschrittsdarstellung (PR #169)
- [x] #166 Collapsible Result Cards im Chat-Stream (PR #169)
- [ ] #167 Dynamische Navigation/Sidebar fuer Pitch Scan (offen)
- [ ] #168 Tiefere Analyse-Prompts fuer Pitch Scan Phasen (offen)

## Goals

1. Pitch Scan als Chat-basierter, dynamischer Analyse-Flow (PreQual-Style).
2. Robust bei AI Provider Glitches (Empty responses etc.).
3. Navigation/Sidebar zeigt nur relevante, tatsaechlich geplante/ausgefuehrte Phasen.
4. Ergebnisse sind tiefer, konkreter und direkt actionable.

## Non-Goals (v1)

- Follow-up Chat nach Scan (extra Conversation-Context)
- Resume nach Refresh als garantierte UX (nur Best-Effort, keine neue Persistenzschicht)

## Implementation Plan

### A) Dynamische Navigation/Sidebar (#167)

- [ ] Server: Aus `audit_scan_runs.snapshot_data` (Checkpoint) das aktuelle Pitch-Scan-`plan` und `phaseResults` laden.
- [ ] Server: Navigation fuer Sidebar erzeugen:
  - Running: `generatePendingNavigation(plan)`
  - Completed: `generateNavigation(plan, phaseResults)`
  - Fallback: Static sections (falls kein Plan vorhanden)
- [ ] Files:
  - `app/(dashboard)/pitches/[id]/layout.tsx` (load latest run snapshot, pass to sidebar)
  - `components/pitches/pitch-sidebar-right.tsx` (render pitch-scan subsections from dynamic nav)
  - `lib/pitch-scan/navigation.ts` (ensure routes support anchors + pending state)
  - `lib/pitches/navigation-config.ts` (pitch-scan subsections no longer hardcoded)
- [ ] UI: `LeadSidebarRight` so umbauen, dass Pitch-Scan Subsections dynamisch gerendert werden (inkl. "pending/hasContent" Visual-State).
- [ ] Routing: Pitch-Scan Section routes muessen dynamische Section IDs akzeptieren:
  - `app/api/pitches/[id]/pitch-scan/sections/[sectionId]/route.ts`
  - `app/(dashboard)/pitches/[id]/pitch-scan/[sectionId]/page.tsx`
- [ ] UX: Sidebar Links fuer laufenden Scan bevorzugt als Anchor in den Chat (`/pitches/:id/pitch-scan#section-<id>`), wenn sinnvoll.
- [ ] Tests:
  - Unit: "dynamic section id is allowed if present in plan/checkpoint"
  - Integration: "sidebar renders dynamic plan sections when snapshotData.plan exists"

### B) Tiefere Prompts + PreQual Kontext (#168)

Basis: `docs/plans/2026-02-08-enhancement-deeper-pitch-scan-prompts-plan.md`

- [ ] Types: `PhaseContext` um `preQualContext` erweitern (string + metadata).
- [ ] Data: PreQual Kontext aus `deal_embeddings` laden (ueber `pitches.preQualificationId`), truncation + graceful degradation.
- [ ] Orchestrators: PreQual Kontext 1x laden und in jede Phase-Execution injizieren (legacy + dynamic).
- [ ] Prompting: Phase Prompts auf "konkret, 3-5 Findings" ausrichten und PreQual Kontext + previous results sauber formatieren.
- [ ] Output: Phase schema so tighten, dass Findings strukturiert sind (Zod + generateWithFallback).
- [ ] UI: Ergebnisse in Cards/Detail View lesbar rendern (keine rohen JSON-Dumps).
- [ ] Files:
  - `lib/pitch-scan/types.ts`
  - `lib/pitch-scan/phases/shared.ts` (loadPreQualContext + buildUserPrompt + schema)
  - `lib/pitch-scan/phases/*.ts` (phase-specific instructions + schema compliance)
  - `lib/pitch-scan/orchestrator.ts` (inject preQualContext in both orchestrators)
  - `components/pitch-scan/scan-result-card.tsx` (render findings nicely)
  - `app/(dashboard)/pitches/[id]/pitch-scan/[sectionId]/page.tsx` (render findings nicely)
- [ ] Tests:
  - Unit: `loadPreQualContext()` handles missing PreQual and truncation
  - Unit: phase runner enforces schema (invalid output fails fast)
  - Smoke: start scan and verify at least plan_created + section_result render path works

### C) Quality Gate

- [ ] Fix working tree noise (z.B. `next-env.d.ts` nicht auf `.next/dev/...` zeigen lassen).
- [ ] Tests: `npm test` / `vitest` + `npm run typecheck` muessen gruen sein.
- [ ] E2E Smoke: Pitch Scan page laedt, Start Button, SSE stream connect, Cards rendern.

### D) Delivery

- [ ] PR description updaten (Scope: Epic #162, Subissues referenzieren).
- [ ] Feature-Video aufnehmen und in PR einhaengen.
- [ ] Issue #167 und #168 kommentieren (erledigt, PR link) und schliessen.
- [ ] Epic #162 kommentieren (Status, PR link) und schliessen.

## Acceptance Criteria

- [ ] Sidebar zeigt Pitch-Scan Navigation basierend auf Plan/Results (nicht mehr fix 13 subsections).
- [ ] Dynamische section IDs funktionieren in API + Detail Page (keine 404 fuer geplante Phasen).
- [ ] Phase output ist tiefer und actionable (3-5 konkrete Findings pro Phase, customer-context aware).
- [ ] Scan-UX: Chat stream bleibt stabil, Cards koennen expanden und Detail-Links funktionieren.
- [ ] Video ist in PR eingebettet (Preview GIF + MP4 Link).
