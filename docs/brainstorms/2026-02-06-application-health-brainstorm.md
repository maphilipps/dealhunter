---
date: 2026-02-06
topic: application-health-overhaul
---

# Application Health Overhaul

## Was wir vorhaben

Eine umfassende Bereinigung und Modernisierung der DealHunter-Anwendung. Ziel: konsistente Benennung, Agent-Native Architecture, Self-Maintaining Master Data, einheitliche AI-Visualisierung und durchgaengig gute UX.

## Warum jetzt

Die Anwendung hat durch schnelles Feature-Building technische Schulden angesammelt: inkonsistente Benennungen (Leads vs. Qualification vs. Pre-Qualification), manuelle Admin-Configs die Agenten uebernehmen sollten, unvollstaendige Renames, und fehlende Best-Practice-Patterns (AI SDK, Vercel React).

## Issues

### Prioritaet 1 — Fundament (Blocker fuer alles andere)

#### Issue 1: Naming-Konsistenz "Qualification"

**Problem:** "Leads", "Pre-Qualification", "Quick-Scan" werden inkonsistent verwendet. `/qualifications` ist nicht aufrufbar.

**Scope:**

- Alle Routes: `pre-qualifications` → `qualifications`
- Alle Komponenten: `pre-qualification-*` → `qualification-*`
- Alle Lib-Module: `lib/pre-qualifications/` → `lib/qualifications/`
- DB-Schema Labels und UI-Strings
- Navigation, Sidebar, Breadcrumbs
- API-Routes vollstaendig migrieren
- Tests aktualisieren
- `quick-scan` → `qualifications-scan` (bereits begonnen, abschliessen)

**Status:** Rename ist ~60% fertig (viele RM-Dateien im Git). Muss abgeschlossen und verifiziert werden.

---

#### Issue 9: Korrupte Dateien entfernen

**Problem:** `.!33150!page.tsx` und `.!33408!page.tsx` in `master-data/competitors/new/` — Datei-Korruption.

**Aktion:** Loeschen und sicherstellen, dass `page.tsx` korrekt existiert.

---

#### Issue 10: Backup-Dateien entfernen

**Problem:** `section-page-template.tsx.backup` liegt im Repo.

**Aktion:** Loeschen.

---

#### Issue 11: Rename abschliessen

**Problem:** Das grosse `pre-qualification` → `qualification` Rename ist halb fertig.

**Scope:**

- Alle `RM`-Dateien im Git verifizieren (Imports korrekt?)
- Tests gegen alte Pfade pruefen
- Middleware-Redirects pruefen
- Sicherstellen, dass keine alten Pfade mehr referenziert werden

---

#### Issue 12: Tote Dateien verifizieren

**Problem:** Geloeschte Dateien (`quick-scan-context.tsx`, `workers/quick-scan.ts`, etc.) — Ersatz muss verifiziert werden.

**Aktion:** Sicherstellen, dass alle Imports auf neue Dateien zeigen und kein toter Code referenziert wird.

---

### Prioritaet 2 — Architecture & Agent-Native

#### Issue 8: Agent-Native Architecture

**Problem:** Die Anwendung ist nicht konsequent agent-native. Agenten brauchen Paritaet mit der UI.

**Scope:**

- `/agent-native-architecture` Skill als Leitfaden
- Jede Aktion die ein User ausfuehren kann, muss auch ein Agent ausfuehren koennen
- Jede Information die ein User sieht, muss auch ein Agent sehen koennen
- MCP-Tools fuer alle relevanten Operationen
- Agent-Tools nach CLAUDE.md Naming Conventions

---

#### Issue 5: Admin-Configs durch Agent-Intelligence ersetzen

**Problem:** Manuelle Konfigurationen unter `/admin/configs` (Bit Evaluation, CMS Scoring, Routing) sollten nicht existieren. Agenten muessen aus den Daten lernen.

**Scope:**

- "Bit Evaluation" Config → Agent lernt Bewertungskriterien aus historischen Daten
- "CMS Scoring" Config → Agent bewertet CMS basierend auf Technology-Daten und Projekt-Anforderungen
- "Routing" Config → Agent routet basierend auf BU-Capabilities und Technology-Zuweisungen
- **Admin-Configs komplett entfernen** — kein Fallback, Agenten muessen es koennen
- BU ↔ Technology Zuweisung nur in der Business Unit Sicht
- Ergebnisse der Scans muessen in BU-Zuweisungen einfliessen
- Bestehende Zuweisungs-Logik als Agent-Tools exponieren

---

#### Issue 4: Technologies Self-Maintenance

**Problem:** `/master-data/technologies` muss sich selbst pflegen und aktuell halten (2026). Features muessen automatisch entdeckt werden.

**Scope:**

- Agent-Tools fuer Technology-Discovery (Web-Recherche, Release-Notes)
- Automatische Feature-Erkennung und -Aktualisierung
- Versionspflege (aktuelle Versionen, EOL-Daten)
- **Woechentlicher** Scheduled Job fuer Auto-Discovery
- Tools: `technology.discover_features`, `technology.update_version`, `technology.check_eol`

---

### Prioritaet 3 — UI & Visualisierung

#### Issue 2: Unified Agent Activity UI

**Problem:** Beide Scans (Qualification Scan + Pitch Scan) brauchen eine einheitliche Visualisierung der Agent-Aktivitaet.

**Scope:**

- Einheitliche AI-SDK Komponenten (`/ai-elements`)
- Queue-Ansicht: Welche Agents stehen an?
- Reasoning-Ansicht: Was denkt der Agent gerade?
- Tasks-Ansicht: Welche Aufgaben werden abgearbeitet?
- Tools-Ansicht: Welche Tools werden aufgerufen?
- Reine Visualisierung (kein interaktiver Chat waehrend Scan)
- Konsistentes Design fuer beide Scan-Typen

---

#### Issue 3: JSON Render Komponenten

**Problem:** JSON Render muss mit allen notwendigen Komponenten gefuellt werden.

**Scope:**

- Bestandsaufnahme: Welche Komponenten fehlen?
- Inhaltlich keine Aenderungen
- Vereinheitlichung der bestehenden Komponenten
- Registry (`qualifications-scan-registry.tsx`) vervollstaendigen

---

#### Issue 6: UX-Verbesserungen

**Problem:** Die Anwendung ist nicht intuitiv genug.

**Scope:** (Muss noch konkretisiert werden — eigenes Brainstorming empfohlen)

- Navigation vereinfachen
- Onboarding/Leerstaende verbessern
- Konsistente Aktions-Patterns
- Mobile Responsiveness pruefen

---

#### Issue 7: Qualification Export

**Problem:** Export der Qualifications muss perfekt sein.

**Scope:**

- **PDF + Excel** Export
- Vollstaendigkeit aller Scan-Ergebnisse
- Professionelles Layout
- Alle Sections korrekt dargestellt

---

### Prioritaet 4 — Best Practices & Quality

#### Issue 13: AI SDK Best Practices Audit

**Problem:** Code muss gegen aktuelle AI SDK Patterns geprueft werden.

**Scope:**

- `streamText` / `generateText` korrekt eingesetzt?
- Structured Outputs statt manuelles Parsing?
- `useChat` / `useCompletion` Hooks wo sinnvoll?
- Error Handling nach AI SDK Patterns?
- Tool-Calling Patterns aktuell?

---

#### Issue 14: Vercel React Best Practices Audit

**Problem:** React/Next.js Patterns muessen Vercel-Standards entsprechen.

**Scope:**

- Server Components vs. Client Components korrekt aufgeteilt?
- Suspense Boundaries an den richtigen Stellen?
- Dynamic Imports fuer schwere Komponenten?
- Data Fetching Patterns (Server Actions, Route Handlers)?
- Caching-Strategie (unstable_cache, revalidation)?
- Metadata und SEO?

---

## Abhaengigkeiten

```
Issue 9, 10, 12 (Cleanup)
        |
        v
Issue 1, 11 (Naming & Rename abschliessen)
        |
        v
Issue 8 (Agent-Native Architecture) ──────┐
        |                                  |
        v                                  v
Issue 5 (Admin-Configs → Agents)    Issue 4 (Tech Self-Maintenance)
        |
        v
Issue 2 (Unified Agent UI)
        |
        v
Issue 3 (JSON Render)
        |
        v
Issue 6 (UX) + Issue 7 (Export)
        |
        v
Issue 13, 14 (Best Practices Audits — laufend)
```

## Offene Fragen

- Issue 6 (UX): Braucht eigenes Deep-Dive Brainstorming — was genau ist nicht intuitiv?

## Naechste Schritte

→ `/workflows:plan` fuer Issue 1 + 9-12 (Cleanup & Naming) als erstes Arbeitspaket
→ Danach Issue 8 (Agent-Native) als Architektur-Grundlage
→ Issues 2-7 bauen darauf auf
→ Issues 13-14 laufen parallel als Quality Gates
