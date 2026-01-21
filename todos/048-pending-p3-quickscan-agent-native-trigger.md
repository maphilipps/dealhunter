---
status: pending
priority: p3
issue_id: '048'
tags: [code-review, agent-native, quickscan, api]
dependencies: []
---

# Agent-Native: QuickScan Trigger API Endpoint

## Problem Statement

QuickScan kann aktuell nur über die UI gestartet werden (Button-Klick). Für vollständige Agent-Native Architektur fehlt ein API-Endpoint, über den Agents programmatisch QuickScans auslösen können.

## Findings

**Source:** agent-native-reviewer Agent (Plan Review)

**Agent-Native Score:** 78% (gut, aber verbesserungswürdig)

**Fehlende Capabilities:**

1. `POST /api/rfps/{id}/quick-scan/trigger` - QuickScan starten
2. `GET /api/rfps/{id}/quick-scan/status` - Status abfragen
3. `GET /api/rfps/{id}/quick-scan/result` - Ergebnis abrufen

**Use Cases für Agent-Trigger:**

- Automatischer QuickScan bei neuem RFP (via Inngest)
- Bulk-Rescan aller RFPs mit veralteten Scans
- Integration mit externen Systemen (Slack Bot, API)

## Proposed Solutions

### Option A: REST API Endpoints (Empfohlen)

**Pros:** Standard, einfach zu implementieren
**Cons:** Polling für Status nötig
**Effort:** Small (2-4h)
**Risk:** Low

```typescript
// app/api/rfps/[id]/quick-scan/trigger/route.ts
export async function POST(request: Request, { params }) {
  const { id } = await params;
  // Start QuickScan, return scan ID
  return Response.json({ scanId, status: 'started' });
}

// app/api/rfps/[id]/quick-scan/status/route.ts
export async function GET(request: Request, { params }) {
  const { id } = await params;
  // Return current status
  return Response.json({ status, progress, eta });
}
```

### Option B: WebSocket für Real-Time Updates

**Pros:** Real-Time Status
**Cons:** Komplexer, Infrastruktur nötig
**Effort:** Medium
**Risk:** Medium

### Option C: SSE Endpoint (bereits vorhanden)

**Pros:** Streaming existiert bereits
**Cons:** Muss für Agent-Consumption angepasst werden
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A + C kombinieren: REST für Trigger/Status, SSE für Real-Time wenn gewünscht.

## Technical Details

**New Files:**

- `app/api/rfps/[id]/quick-scan/trigger/route.ts`
- `app/api/rfps/[id]/quick-scan/status/route.ts`
- `app/api/rfps/[id]/quick-scan/result/route.ts`

## Acceptance Criteria

- [ ] POST /trigger startet QuickScan, gibt scanId zurück
- [ ] GET /status gibt aktuellen Status zurück
- [ ] GET /result gibt fertiges Ergebnis zurück
- [ ] Auth-Check auf allen Endpoints
- [ ] OpenAPI Spec dokumentiert
- [ ] Agent kann QuickScan ohne UI starten

## Work Log

| Date       | Action                        | Learnings                      |
| ---------- | ----------------------------- | ------------------------------ |
| 2026-01-20 | Todo erstellt aus Plan Review | Agent-Native Gap identifiziert |

## Resources

- Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- Agent-Native Architecture: `.claude/skills/agent-native-architecture/SKILL.md`
