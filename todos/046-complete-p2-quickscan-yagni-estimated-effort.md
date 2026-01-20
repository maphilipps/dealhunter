---
status: pending
priority: p2
issue_id: "046"
tags: [code-review, simplicity, quickscan, yagni]
dependencies: ["045"]
---

# YAGNI: estimatedEffort als separate Funktion

## Problem Statement

Der Plan sieht `estimatedEffort` mit PT-Range (minPT/maxPT) im `MigrationComplexityData` vor. Dies ist eine Business-Logik-Entscheidung, die besser als separate, konfigurierbare Funktion implementiert wird.

## Findings

**Source:** code-simplicity-reviewer Agent (Plan Review)

**Geplante Schema-Erweiterung:**
```typescript
interface MigrationComplexityData {
  // ... existing ...

  // NEU (YAGNI!):
  estimatedEffort: {
    minPT: number;        // Minimum Personentage
    maxPT: number;        // Maximum Personentage
    confidence: number;   // 0-100
    assumptions: string[];
  };
}
```

**Probleme:**
1. PT-Schätzung basiert auf Faktoren, die sich ändern (Team-Erfahrung, Tooling)
2. Hardcoded im Schema = schwer anzupassen
3. Unterschiedliche Kunden haben unterschiedliche Baseline-Aufwände
4. Besser als konfigurierbare Funktion mit Parametern

## Proposed Solutions

### Option A: Separate Estimation Function (Empfohlen)

**Pros:** Konfigurierbar, testbar, Business-Logik getrennt
**Cons:** Zusätzlicher Aufruf nötig
**Effort:** Small
**Risk:** None

```typescript
// lib/estimation/effort-calculator.ts
interface EstimationConfig {
  baselinePTPerContentType: number;  // Default: 2
  baselinePTPerParagraphType: number; // Default: 1.5
  complexityMultiplier: { simple: 1, moderate: 1.5, complex: 2 };
  // ...
}

export function calculateEstimatedEffort(
  migrationComplexity: MigrationComplexityData,
  config: EstimationConfig = DEFAULT_CONFIG
): EffortEstimate {
  // Berechnung basierend auf Config
}
```

### Option B: Im Schema aber mit Config-Referenz

**Pros:** Alles in einem Objekt
**Cons:** Immer noch nicht flexibel genug
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A - PT-Schätzung als separate, konfigurierbare Funktion. MigrationComplexityData liefert nur die Rohdaten (score, factors), die Schätzung erfolgt extern.

## Technical Details

**Affected Files:**
- Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- Neues File (später): `lib/estimation/effort-calculator.ts`

**Plan-Änderung:**
```diff
interface MigrationComplexityData {
  score: number;
  recommendation: 'easy' | 'moderate' | 'complex' | 'very_complex';
  factors: { ... };
- estimatedEffort: {
-   minPT: number;
-   maxPT: number;
-   ...
- };
+ // PT-Schätzung erfolgt durch separate Funktion im Audit Skill
+ // mit konfigurierbaren Baseline-Werten
}
```

## Acceptance Criteria

- [ ] Plan aktualisiert: estimatedEffort aus MigrationComplexityData entfernt
- [ ] Audit Skill Spec: Separate Estimation Function dokumentiert
- [ ] Config-Struktur für PT-Berechnung definiert
- [ ] Beispiel-Konfiguration für adesso-Standard

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-20 | Todo erstellt aus Plan Review | Separation of Concerns |

## Resources

- Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- Abhängig von: #045 (drupalMapping YAGNI)
