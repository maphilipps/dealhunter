# QuickScan Refactoring: Analyse-Dokumentation

**Status:** ✅ Analyse vollständig - Ready for Implementation
**Datum:** 2026-01-20
**Umfang:** 3 Dokumentation-Dateien mit 77KB detaillierte Analyse

## Dokumentation

### 1. **QUICKSCAN_REFACTORING_ANALYSIS.md** (40 KB)
Die umfassende technische Analyse mit 14 Sektionen:

- **Abschnitt 1:** Executive Summary & Ziele
- **Abschnitt 2:** Bestehende QuickScan-Implementierung (Architektur, Dateipfade, Zeilennummern)
- **Abschnitt 3:** Event-Types und Streaming Infrastructure (vollständig dokumentiert)
- **Abschnitt 4:** UI-Komponenten für Agent-Activity (AgentActivityView, AgentMessage)
- **Abschnitt 5:** Schema-Definitionen (20+ Zod Schemas + Drupal Mapping)
- **Abschnitt 6:** Business Units Singleton Cache (KERN-FEATURE!)
- **Abschnitt 7:** Refactoring-Blueprint für 2-Phasen Workflow
- **Abschnitt 8:** Integration Points für Website Audit Skill
- **Abschnitt 9:** Komponenten-Hierarchie
- **Abschnitt 10:** Key Dateipfade Referenz (alle absolut)
- **Abschnitt 11:** Refactoring Checklist (mit Prioritäten)
- **Abschnitt 12:** Testing Strategy (Unit, Integration, E2E)
- **Abschnitt 13:** Performance Considerations
- **Abschnitt 14:** Zusammenfassung & Nächste Schritte

### 2. **QUICKSCAN_LINE_REFERENCE.md** (24 KB)
Schnelle Zeilen-Referenz für Code-Navigation:

- **Streaming Infrastructure:** event-types.ts, event-emitter.ts (exakte Zeilen)
- **Server Actions:** startQuickScan, retriggerQuickScan, getQuickScanResult (lines)
- **Agent Orchestration:** Business Units Cache, Tech Stack Detection
- **UI Components:** AgentActivityView, AgentMessage (alle Zeilen dokumentiert)
- **Schemas:** 20+ Schemas mit Zeilennummern
- **Database:** quickScans table (18 JSON fields)
- **Tools:** Multi-Page Analyzer, Migration Analyzer, Component Extractor, etc.
- **Quick Reference:** 2-Phase Implementation Blueprint

### 3. **QUICKSCAN_ANALYSIS_SUMMARY.txt** (13 KB)
Visuelle Zusammenfassung für schnelle Übersicht:

- Executive Summary
- Key Findings (6 Checkboxen)
- Current Architecture (ASCII-Diagramm)
- Refactoring Needed (Prioritäts-Checkliste)
- File Structure
- Key Code Sections
- Integration Points
- Performance Notes
- Testing Requirements
- Critical Success Factors

## Schnelle Navigation

### Für Überblick (Start hier)
```
1. README_ANALYSIS.md (diese Datei)
2. QUICKSCAN_ANALYSIS_SUMMARY.txt (visuelle Zusammenfassung)
```

### Für Implementation
```
1. QUICKSCAN_LINE_REFERENCE.md (Zeilen-Nummern & Code)
2. QUICKSCAN_REFACTORING_ANALYSIS.md Sektion 11 (Refactoring Checklist)
```

### Für Deep Dive
```
1. QUICKSCAN_REFACTORING_ANALYSIS.md (vollständig lesen)
2. QUICKSCAN_LINE_REFERENCE.md (Zeilen durchklicken)
3. Repository-Code direkt öffnen (mit absoluten Pfaden)
```

## Key Findings

✅ **COMPLETE & READY:**
- Streaming Infrastructure (SSE + Web Streams API)
- Business Units Singleton Cache (lines 66-92 in agent.ts)
- Phase Event System (PHASE_START, ANALYSIS_COMPLETE already defined)
- Schema Definitions (20+ Zod schemas + DrupalMappingData)
- UI Components (AgentActivityView, AgentMessage)
- Tools (10 specialized sub-tools, all parallelizable)

⚠️ **REFACTORING NEEDED:**
- Explicit 2-phase event emission (COLLECT + SYNTHESIZE)
- DrupalMappingData generation in synthesis phase
- Phase Progress UI component
- Website Audit Skill integration

## Critical Code References

### Business Units Singleton Cache
**File:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/agent.ts`
**Lines:** 66-92
**Status:** ✅ Already implemented - Use this pattern!

```typescript
let cachedBusinessUnits: CachedBusinessUnit[] | null = null;

async function getBusinessUnitsOnce(): Promise<CachedBusinessUnit[]> {
  if (!cachedBusinessUnits) {
    const units = await db.select().from(businessUnitsTable);
    cachedBusinessUnits = units.map(...);
  }
  return cachedBusinessUnits;
}
```

### Phase Events Already Defined
**File:** `/Users/marc.philipps/Sites/dealhunter/lib/streaming/event-types.ts`
**Lines:** 11-31
**Status:** ✅ Ready to use

```typescript
PHASE_START = 'phase-start',
ANALYSIS_COMPLETE = 'analysis-complete',

interface PhaseStartData {
  phase: QuickScanPhase; // 'bootstrap' | 'multi_page' | 'analysis' | 'synthesis'
  message: string;
  timestamp: number;
}
```

### Drupal Mapping Data Structure
**File:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/types.ts`
**Lines:** 392-399
**Status:** ✅ Defined and ready

```typescript
export interface DrupalMappingData {
  suggestedParagraphTypes: string[];    // z.B. ["hero", "cards_grid"]
  suggestedContentTypes: string[];      // z.B. ["article", "product"]
  suggestedTaxonomies: string[];        // z.B. ["category", "tag"]
  suggestedMediaTypes: string[];        // z.B. ["image", "video"]
  estimatedViews: number;
}
```

### Database Schema Ready
**File:** `/Users/marc.philipps/Sites/dealhunter/lib/db/schema.ts`
**Lines:** 412-479
**Status:** ✅ All 18 JSON fields ready to persist

```typescript
export const quickScans = sqliteTable('quick_scans', {
  // ... existing fields ...
  
  // QuickScan 2.0 Fields (Lines 449-455)
  siteTree: text('site_tree'),
  contentTypes: text('content_types'),
  migrationComplexity: text('migration_complexity'),
  decisionMakers: text('decision_makers'),
  
  // Activity & Visualization
  activityLog: text('activity_log'),     // For streaming replay
  visualizationTree: text('visualization_tree'),  // For json-render
});
```

## Workflow Overview

```
PHASE 1: COLLECT (Parallel)
├─ emit({ type: PHASE_START, data: { phase: 'multi_page', ... } })
├─ Tech Stack Detection (Wappalyzer + HTML patterns)
├─ Navigation Analysis
├─ Component Extraction
├─ Decision Maker Research
├─ Content Type Classification
└─ emit({ type: ANALYSIS_COMPLETE, data: { analysis: 'collection', ... } })

PHASE 2: SYNTHESIZE (Sequential)
├─ emit({ type: PHASE_START, data: { phase: 'synthesis', ... } })
├─ Business Unit Recommendation (using cached BUs)
├─ Drupal Mapping Hint Generation
├─ Migration Complexity Assessment
├─ Decision Maker Summary
└─ emit({ type: ANALYSIS_COMPLETE, data: { analysis: 'synthesis', ... } })

DATABASE
└─ Persist all results (15+ JSON fields)
```

## File Locations (Absolute Paths)

```
Streaming:
  /Users/marc.philipps/Sites/dealhunter/lib/streaming/event-types.ts
  /Users/marc.philipps/Sites/dealhunter/lib/streaming/event-emitter.ts

Agent & Orchestration:
  /Users/marc.philipps/Sites/dealhunter/lib/quick-scan/agent.ts
  /Users/marc.philipps/Sites/dealhunter/lib/quick-scan/actions.ts
  /Users/marc.philipps/Sites/dealhunter/lib/quick-scan/schema.ts
  /Users/marc.philipps/Sites/dealhunter/lib/quick-scan/types.ts

API Route:
  /Users/marc.philipps/Sites/dealhunter/app/api/rfps/[id]/quick-scan/stream/route.ts

UI Components:
  /Users/marc.philipps/Sites/dealhunter/components/ai-elements/agent-activity-view.tsx
  /Users/marc.philipps/Sites/dealhunter/components/ai-elements/agent-message.tsx

Database:
  /Users/marc.philipps/Sites/dealhunter/lib/db/schema.ts

Tools:
  /Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/
    ├─ multi-page-analyzer.ts
    ├─ component-extractor.ts
    ├─ migration-analyzer.ts
    ├─ decision-maker-research.ts
    └─ [7 more tools]
```

## Prioritäten

### Muss (MUST - Diese Woche)
- [ ] Phase event emission implementieren (COLLECT + SYNTHESIZE)
- [ ] DrupalMappingData in synthesis generation
- [ ] DB persistence für drupalMapping testen

### Sollte (SHOULD - Nächste Woche)
- [ ] PhaseProgressCard UI component erstellen
- [ ] Task checklist per phase anzeigen
- [ ] Phase duration tracking

### Kann (NICE - 2 Wochen)
- [ ] Drupal-specific result display
- [ ] "Ten Questions for BL" generation
- [ ] Drupal baseline comparison

## Performance

- **Business Units Cache:** 1 DB query pro Session (statt 2 pro Tool)
- **Parallelization:** 10 pages analyzed in parallel (COLLECT phase)
- **Streaming:** Real-time SSE updates
- **Persistence:** Single batch DB update (all fields atomic)

## Testing

**Unit Tests:**
- getBusinessUnitsOnce() cache behavior
- Phase event emission timing
- DrupalMappingData generation

**Integration Tests:**
- Full 2-phase workflow with timing
- COLLECT before SYNTHESIZE ordering
- Event sequence correctness

**E2E Tests:**
- Website → QuickScan → UI rendering
- Agent activity streaming
- Drupal mapping validation

## Nächste Schritte

1. **Read:** QUICKSCAN_ANALYSIS_SUMMARY.txt (5 min)
2. **Review:** agent.ts lines 66-92 (Business Units Cache)
3. **Check:** event-types.ts lines 11-31 (Phase Events)
4. **Implement:** 2-phase event emission in runQuickScanWithStreaming()
5. **Test:** End-to-end flow with phase events

## Resources

- **Full Analysis:** QUICKSCAN_REFACTORING_ANALYSIS.md (40 KB)
- **Line Reference:** QUICKSCAN_LINE_REFERENCE.md (24 KB)
- **Summary:** QUICKSCAN_ANALYSIS_SUMMARY.txt (13 KB)

---

**Generated:** 2026-01-20
**Status:** ✅ COMPLETE - Ready for Implementation
**Total Analysis Size:** 77 KB across 3 files
