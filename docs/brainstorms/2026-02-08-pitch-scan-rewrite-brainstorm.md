# Brainstorm: Pitch Scan Rewrite — PreQual-Style Chat UX

**Date:** 2026-02-08
**Status:** Draft
**Author:** Marc Philipps + Claude

---

## What We're Building

Eine grundlegende Überarbeitung des Pitch Scans mit folgenden Kernzielen:

1. **Chat-basierte UX** — Der gesamte Scan-Fortschritt wird als Chat-Konversation dargestellt (wie beim Pre-Qualification Scan)
2. **Robusteres Error-Handling** — Model-Fallback-Chain für sporadische API-Fehler (z.B. Gemini empty responses)
3. **Dynamische Navigation** — Der Orchestrator bestimmt welche Phasen laufen UND wie die Ergebnisse gruppiert/navigiert werden
4. **Tiefere Ergebnisse** — Qualitativ hochwertigere Analyse statt oberflächlicher Texte
5. **Collapsible Result Cards** — Phasen-Ergebnisse als expandierbare Cards im Chat-Stream

---

## Why This Approach

### Ausgangsprobleme

1. **Sporadische API-Fehler**: `gemini-3-pro-preview` über den adesso AI Hub liefert manchmal leere Responses (kein `choices`-Array), was den gesamten Scan zum Absturz bringt
2. **Fehlende Sichtbarkeit**: Der User sieht nicht was der Agent gerade tut
3. **Starre Navigation**: 13 fest definierte Sections, unabhängig davon ob sie für den konkreten Pitch relevant sind
4. **Oberflächliche Ergebnisse**: Fehlende Tiefe in der Analyse

### Warum PreQual-Style?

- Konsistente UX über alle Scan-Typen (PreQual → Pitch Scan)
- Chat-Interface macht Agent-Arbeit transparent und nahbar
- Ermöglicht zukünftig nahtloses Follow-up (nicht in v1)
- Dynamische Navigation passt sich dem konkreten Anwendungsfall an

---

## Key Decisions

| #   | Entscheidung        | Gewählt                                                                 | Alternativen                      |
| --- | ------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| 1   | **UX-Pattern**      | PreQual-Style Chat Rewrite                                              | Iterative Härtung, Hybrid         |
| 2   | **Ergebnis-Format** | Collapsible Cards im Chat                                               | Fließender Bericht, Separate Tabs |
| 3   | **Follow-up Chat**  | Nicht in v1                                                             | Nahtloser Chat, Neuer Kontext     |
| 4   | **Navigation**      | Dynamisch durch Orchestrator (Phasen-Auswahl + Gruppierung)             | Statische 13 Sections             |
| 6   | **Phasen-Modell**   | Alte 13 Phasen als Capability-Pool/Inspiration, Orchestrator plant frei | Feste Pipeline                    |
| 5   | **Error-Handling**  | Model-Fallback-Chain bei sporadischen Fehlern                           | Nur Retry                         |

---

## Architektur-Skizze

### Backend

```
[Pre-Qualification Scan Ergebnisse]
        ↓ (als Kontext)
[Pitch Scan Orchestrator v2]
  ├── Dynamische Phasen-Planung (welche Phasen sind relevant?)
  ├── DAG-basierte parallele Ausführung (bleibt)
  ├── Model-Fallback-Chain (gemini → gpt-5.2 → ...)
  ├── SSE Events als Chat-Messages
  └── Dynamische Navigation-Config generieren
```

### Frontend

```
[Chat-Interface]
  ├── Agent-Messages: "Ich analysiere die Performance..."
  ├── Collapsible Result Cards: Phase-Ergebnisse
  ├── Progress-Indicators: Welche Phasen laufen/fertig
  └── Dynamische Sidebar: Vom Orchestrator generiert
```

### Model-Fallback-Chain

```
Phase-Ausführung:
  1. Primäres Modell versuchen (z.B. gemini-3-pro-preview)
  2. Bei Empty-Response oder Parse-Error:
     → Fallback-Modell verwenden (z.B. gpt-5.2)
  3. Bei komplettem Failure:
     → Phase als fehlgeschlagen markieren
     → Scan läuft weiter (graceful degradation)
```

### Dynamischer Orchestrator (Agentic)

**Kernidee: Die bisherigen 13 Phasen dienen nur als Anhaltspunkt/Inspiration — der Orchestrator entscheidet autonom.**

```
Orchestrator analysiert:
  - PreQual-Ergebnisse (Was wissen wir schon?)
  - Website-Typ (E-Commerce vs. Corporate vs. Portal)
  - Pitch-Anforderungen (Was wurde angefragt?)
  - Verfügbare Analyse-Capabilities (inspiriert von den alten 13 Phasen)

→ Erstellt dynamischen Analyse-Plan:
  - Welche Analyse-Schritte sinnvoll sind (frei wählbar, nicht auf 13 Phasen begrenzt)
  - Abhängigkeiten zwischen Schritten
  - Wie Ergebnisse gruppiert werden (z.B. "Technische Analyse" als Oberkategorie)
  - Navigation/Sidebar-Struktur

→ Die alten 13 Phasen werden zu einem "Capability-Pool":
  - discovery, performance, accessibility, seo, content, ...
  - Orchestrator wählt relevante aus und kann neue definieren
  - Phasen-Definitionen dienen als Templates, nicht als feste Pipeline
```

---

## Scope für v1 (GitHub Issue)

### Must-Have

- [ ] Model-Fallback-Chain im Orchestrator
- [ ] Chat-basierte Darstellung des Scan-Fortschritts
- [ ] Collapsible Result Cards für Phasen-Ergebnisse
- [ ] Dynamische Phasen-Auswahl (Orchestrator entscheidet welche Phasen laufen)
- [ ] Dynamische Navigation/Sidebar basierend auf tatsächlich ausgeführten Phasen
- [ ] Bessere Prompts für tiefere Ergebnisse

### Nice-to-Have (v2)

- [ ] Follow-up Chat nach Scan
- [ ] Intelligente Gruppierung der Sections (nicht nur 1:1 Phase → Section)
- [ ] Scan-Resumption bei Browser-Refresh

### Nicht im Scope

- [ ] Änderung der DAG-Engine selbst
- [ ] Neues DB-Schema (nutzt bestehende Tabellen)
- [ ] Änderung des PreQual-Scans

---

## Open Questions

1. **Model-Fallback-Konfiguration**: Soll die Fallback-Chain pro Phase konfigurierbar sein oder global?
2. **Orchestrator-Planung**: Der Orchestrator braucht einen initialen LLM-Call um den Analyse-Plan zu erstellen — welches Modell? Wie detailliert soll der Plan sein?
3. **Chat-Persistenz**: Sollen die Chat-Messages des Scans persistiert werden (für spätere Einsicht)?
4. **Migration**: Wie gehen wir mit bestehenden Pitch-Scan-Ergebnissen um?
5. **Capability-Pool**: Wie definieren wir die verfügbaren Analyse-Capabilities? Hardcoded oder auch dynamisch erweiterbar?
6. **Ergebnis-Schema**: Wenn Phasen dynamisch sind, brauchen wir ein flexibleres Ergebnis-Schema als die aktuellen festen Section-Types

---

## Referenzen

- Pre-Qualification Scan: `lib/qualification-scan/agent.ts`
- Aktueller Pitch Scan Orchestrator: `lib/pitch-scan/orchestrator.ts`
- Pitch Scan Phasen: `lib/pitch-scan/phases/*.ts`
- Navigation Config: `lib/pitches/navigation-config.ts`
- SSE Streaming: `lib/streaming/in-process/event-emitter.ts`
