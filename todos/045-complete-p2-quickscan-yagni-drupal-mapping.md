---
status: pending
priority: p2
issue_id: '045'
tags: [code-review, simplicity, quickscan, yagni]
dependencies: []
---

# YAGNI: drupalMapping aus Schema entfernen

## Problem Statement

Der Plan sieht vor, `drupalMapping` und `estimatedDrupalEntities` direkt in das QuickScan Schema aufzunehmen. Dies verletzt das YAGNI-Prinzip - diese Daten werden nur vom Website Audit Skill benötigt und können on-demand berechnet werden.

## Findings

**Source:** code-simplicity-reviewer Agent (Plan Review)

**Geplante Schema-Erweiterung (YAGNI):**

```typescript
interface ExtractedComponentsData {
  // ... existing fields ...

  // NEU (YAGNI!):
  drupalMapping: {
    suggestedParagraphTypes: string[];
    suggestedContentTypes: string[];
    suggestedTaxonomies: string[];
    suggestedMediaTypes: string[];
    estimatedViews: number;
  };

  summary: {
    // ... existing ...
    estimatedDrupalEntities: {
      // YAGNI!
      contentTypes: number;
      paragraphTypes: number;
      taxonomies: number;
      views: number;
    };
  };
}
```

**Probleme:**

1. QuickScan ist CMS-agnostisch - Drupal-spezifische Felder gehören nicht rein
2. Mapping kann vom Audit Skill on-demand berechnet werden
3. Schema wird unnötig aufgebläht
4. Bei CMS-Wechsel (Drupal→WordPress) sind die Felder irrelevant

## Proposed Solutions

### Option A: Computed Function im Audit Skill (Empfohlen)

**Pros:** Clean Separation, keine Schema-Änderung, CMS-agnostisch
**Cons:** Calculation bei jedem Aufruf
**Effort:** None (nur Plan-Änderung)
**Risk:** None

```typescript
// Im Website Audit Skill (nicht QuickScan):
function computeDrupalMapping(quickScanResult: QuickScanResultsData) {
  return {
    suggestedParagraphTypes: inferParagraphTypes(quickScanResult.extractedComponents),
    suggestedContentTypes: inferContentTypes(quickScanResult.contentTypes),
    // ...
  };
}
```

### Option B: Generisches `cmsHints` Feld

**Pros:** Flexibel für verschiedene CMS
**Cons:** Immer noch YAGNI wenn nicht benötigt
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A - Plan ändern: `drupalMapping` NICHT in QuickScan Schema aufnehmen. Stattdessen Computed Function im Audit Skill.

## Technical Details

**Affected Files:**

- Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- KEINE Code-Änderungen nötig (nur Plan korrigieren)

**Plan-Änderung:**

```diff
- // NEU: Drupal-Mapping Hints
- drupalMapping: {
-   suggestedParagraphTypes: string[];
-   ...
- };
+ // Drupal-Mapping wird vom Audit Skill on-demand berechnet
+ // Keine Schema-Erweiterung nötig
```

## Acceptance Criteria

- [ ] Plan aktualisiert: drupalMapping entfernt
- [ ] Plan aktualisiert: estimatedDrupalEntities entfernt
- [ ] Audit Skill Spec: Computed Function für Drupal Mapping dokumentiert
- [ ] QuickScan Schema bleibt CMS-agnostisch

## Work Log

| Date       | Action                        | Learnings                |
| ---------- | ----------------------------- | ------------------------ |
| 2026-01-20 | Todo erstellt aus Plan Review | YAGNI-Verletzung erkannt |

## Resources

- Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- YAGNI Principle: https://martinfowler.com/bliki/Yagni.html
