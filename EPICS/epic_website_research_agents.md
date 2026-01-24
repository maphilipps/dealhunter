# EPIC: Website Research Agents für RFP Quick Scan

**Status:** Draft
**Priority:** High
**Komponenten:** Quick Scan Agents, RAG Integration, UI Components
**Abhängigkeiten:** RAG System, Quick Scan Workflow

---

## Vision

Automatisierte Website-Analyse durch spezialisierte Research Agents, die strukturierte Audit-Reports generieren – ähnlich wie die manuellen Website-Audits (siehe `audits/audit_lucarnofestival.ch/`), aber vollautomatisch während des RFP Quick Scans.

Statt nur Tech Stack zu erkennen, sammeln die Agents umfassende Daten:

- **Navigationsstruktur** und Sitemap
- **Performance-Metriken** (Core Web Vitals, Asset-Größen)
- **Content-Volumen** (Seitentypen, Anzahl, Komplexität)
- **Technologie-Details** (inkl. HTTPX-Detection für versteckte Technologien)
- **Entscheider-Recherche** (LinkedIn, Unternehmensstruktur)
- **Lieferumfang-Analyse** (aus Dokumenten + Timeline)

---

## Problem Statement

**Aktuell:**

- Quick Scan findet nur oberflächliche Tech Stack Infos
- 50x "Unbekannt" bei Deliverables – keine tiefe Dokumenten-Analyse
- Keine Web Search für Entscheider – alles "Unbekannt"
- HTTPX-Daten landen nicht im RAG – versteckte Technologien gehen verloren
- Timeline-Daten (Deadlines, Phasen) werden nicht korrekt aus RAG extrahiert
- Keine Sichtbarkeit welche Agents gerade arbeiten

**Gewünscht:**

- Strukturierte Audit-Reports wie bei manuellen Analysen
- Parallele Research Agents mit Live-Status in Sidebar
- RAG-first Workflow: Erst RAG, dann nur bei Bedarf externe Quellen
- Schrittweise Anreicherung: RAG → prüfen → externe Tools → RAG aktualisieren → erneut querien
- Audit-Daten persistent in JSON + Markdown (ähnlich wie `audit_data/` Struktur)

---

## Zielgruppe

**Primär:**

- **BD Team** – braucht schnelle, umfassende Website-Analysen für RFP-Bewertung
- **BL-Entscheider** – nutzen Audit-Daten für BIT/NO-BIT Entscheidung

**Sekundär:**

- **Solution Architects** – verwenden Tech Stack + Performance Daten für Projekt-Planung

---

## Erfolgsmetriken

- ✅ **Navigationsstruktur** vollständig erfasst (Haupt-Navigation, Footer, Mega-Menü)
- ✅ **Deliverables** < 10% "Unbekannt" (statt 100% aktuell)
- ✅ **Entscheider** min. 2-3 Personen pro RFP (mit LinkedIn-Profilen)
- ✅ **Tech Stack** vollständig (HTTPX + Browser-Detection kombiniert)
- ✅ **Timeline** mit min. 2 Deadlines aus Dokumenten extrahiert
- ✅ **Agent Status** in Sidebar sichtbar während Scan läuft
- ✅ **RAG Enrichment** messbar (vor/nach Vergleich)

---

## User Stories

### US-1: Navigationsstruktur analysieren (MVP)

**Als** BD-Mitarbeiter
**möchte ich** die komplette Website-Navigationsstruktur automatisch erfasst bekommen
**damit** ich verstehe welche Bereiche die Website hat und wie komplex die Struktur ist

**Akzeptanzkriterien:**

- [ ] Agent crawlt Homepage und extrahiert Haupt-Navigation
- [ ] Mega-Menüs und Dropdown-Strukturen werden erfasst
- [ ] Footer-Navigation wird separat dokumentiert
- [ ] Ergebnis in `navigation.json` + `navigation.md` gespeichert
- [ ] Struktur-Tiefe (Hierarchie-Ebenen) berechnet
- [ ] Anzahl Navigationspunkte pro Level gezählt

**Datenstruktur:**

```json
{
  "navigation": {
    "primary": [
      {
        "label": "Products",
        "url": "/products",
        "children": [
          { "label": "Software", "url": "/products/software" },
          { "label": "Hardware", "url": "/products/hardware" }
        ],
        "has_mega_menu": true,
        "depth": 2
      }
    ],
    "footer": [...],
    "utility": [...],
    "metadata": {
      "total_nav_items": 45,
      "max_depth": 3,
      "has_search": true,
      "has_language_switcher": true
    }
  }
}
```

---

### US-2: RAG-first Workflow mit Agent Status

**Als** BD-Mitarbeiter
**möchte ich** in der Sidebar sehen welche Agents gerade arbeiten und wie weit sie sind
**damit** ich den Fortschritt des Quick Scans nachvollziehen kann

**Akzeptanzkriterien:**

- [ ] Sidebar zeigt Liste aller aktiven Agents
- [ ] Pro Agent: Status (⏳ Running, ✅ Done, ❌ Failed), Progress %
- [ ] Workflow-Steps visualisiert: RAG Query → Check → Web Search → RAG Update → Re-Query
- [ ] Agent-Logs in Collapsible-Section anzeigbar
- [ ] Real-time Updates via SSE

**Workflow je Agent:**

```
1. RAG Query: "Was steht im Dokument über Deliverables?"
   └─ Confidence Check: >= 70% → weiter, < 70% → externe Recherche

2. External Research (nur bei niedrigem Confidence):
   ├─ Web Search (Exa API)
   ├─ LinkedIn Search (Entscheider)
   └─ HTTPX Scan (versteckte Technologien)

3. RAG Enrichment:
   └─ Neue Daten in Vector Store einfügen

4. Re-Query:
   └─ Gleiche Frage erneut stellen, Confidence prüfen

5. Report Generation:
   └─ JSON + MD File schreiben
```

---

### US-3: Deliverables Deep Extraction

**Als** BD-Mitarbeiter
**möchte ich** alle einzureichenden Unterlagen automatisch extrahiert bekommen
**damit** ich nicht manuell durch 100-seitige PDFs suchen muss

**Akzeptanzkriterien:**

- [ ] Agent nutzt RAG + AI-Modell für Deliverable-Extraktion
- [ ] Pflicht vs. Optional erkannt
- [ ] Deadlines mit Datum + Uhrzeit extrahiert
- [ ] Format-Anforderungen (PDF, hardcopy, digital) erfasst
- [ ] Anzahl Kopien erkannt (z.B. "3x in Papierform")
- [ ] Confidence-Score pro Deliverable
- [ ] Fallback: "Unbekannt" nur wenn wirklich keine Daten

**Beispiel-Extraktion:**

```json
{
  "deliverables": [
    {
      "name": "Angebot (Preisblatt)",
      "mandatory": true,
      "deadline": "2025-12-15",
      "deadline_time": "14:00",
      "format": "PDF + hardcopy",
      "copies": 3,
      "description": "Preisblatt gemäß Anlage A, unterschrieben",
      "confidence": 95,
      "source": "Dokument Seite 12, Abschnitt 4.2"
    }
  ]
}
```

---

### US-4: Entscheider Web Search

**Als** BD-Mitarbeiter
**möchte ich** automatisch LinkedIn-Profile und Kontaktdaten der Entscheider finden
**damit** ich gezielt die richtigen Ansprechpartner kontaktieren kann

**Akzeptanzkriterien:**

- [ ] Agent sucht erst in RFP-Dokumenten nach Kontakten
- [ ] Web Search via Exa API: "[Firmenname] Entscheider IT"
- [ ] LinkedIn-Profile via Search extrahieren
- [ ] Name, Rolle, LinkedIn-URL, optional Email/Telefon
- [ ] Deduplizierung (RFP-Kontakte + Web-Recherche)
- [ ] Confidence-Score pro Person

**Workflow:**

1. **RAG Query:** "Wer sind die Ansprechpartner im RFP?"
2. **Company Identification:** Firmenname aus RFP extrahieren
3. **Web Search:**
   - "[Firmenname] Geschäftsführung"
   - "[Firmenname] IT-Leiter"
   - "[Firmenname] Projektleiter"
4. **LinkedIn Scraping:** Profile-URLs sammeln (kein Scraping, nur public data)
5. **Merge:** RFP-Kontakte + Web-Research deduplizieren

---

### US-5: HTTPX Integration ins RAG

**Als** System
**möchte ich** HTTPX-Scan-Ergebnisse ins RAG speichern
**damit** versteckte Technologien (Server-Header, Framework-Hints) in Queries verfügbar sind

**Akzeptanzkriterien:**

- [ ] HTTPX-Scan während Quick Scan ausführen
- [ ] Ergebnisse (Server, X-Powered-By, Framework-Hints) in Vector Store
- [ ] RAG Query kann auf HTTPX-Daten zugreifen
- [ ] Merge mit Browser-basierter Detection
- [ ] Persistierung in `tech_stack.json`

**Daten-Beispiel:**

```json
{
  "httpx_detection": {
    "server": "nginx/1.21.3",
    "headers": {
      "X-Powered-By": "PHP/8.1.12",
      "X-Drupal-Cache": "HIT",
      "X-Generator": "Drupal 10"
    },
    "framework_hints": ["Drupal", "Symfony"],
    "confidence": 98
  },
  "browser_detection": {
    "cms": "Drupal",
    "version": "10.x",
    "confidence": 95
  },
  "merged_tech_stack": {
    "cms": "Drupal",
    "version": "10.1.12",
    "backend": ["PHP 8.1", "Symfony", "nginx"],
    "confidence": 98
  }
}
```

---

### US-6: Timeline + Lieferumfang RAG Query

**Als** BD-Mitarbeiter
**möchte ich** die Projekt-Timeline inkl. Lieferumfang aus Dokumenten extrahiert bekommen
**damit** ich Deadlines und Projektphasen auf einen Blick sehe

**Akzeptanzkriterien:**

- [ ] RAG Query extrahiert Projekt-Phasen (Konzept, Umsetzung, Testing, GoLive)
- [ ] Deadlines mit Datum identifiziert
- [ ] Lieferumfang pro Phase erkannt
- [ ] Wochen-Schätzungen aus Dokumenten extrahiert
- [ ] Visualisierung in Timeline Card
- [ ] Confidence-Score für Timeline-Daten

**RAG Query Template:**

```
"Welche Projekt-Phasen, Deadlines und Lieferumfänge werden im Dokument genannt?

- Liste alle Phasen mit Wochen-Angaben
- Identifiziere Abgabetermine (Datum + Uhrzeit wenn vorhanden)
- Was muss in jeder Phase geliefert werden?
- Gesamt-Projektdauer in Wochen

Format: JSON mit phases[], deadlines[], deliverables_per_phase[]"
```

---

## Architektur

### Research Agent Types

| Agent                   | Zweck                     | Datenquellen                | Output                         |
| ----------------------- | ------------------------- | --------------------------- | ------------------------------ |
| **NavigationAgent**     | Website-Struktur crawlen  | Browser (Puppeteer)         | `navigation.json` + `.md`      |
| **DeliverablesAgent**   | Einzureichende Unterlagen | RAG + AI Extraction         | `deliverables.json` + `.md`    |
| **DecisionMakersAgent** | Entscheider recherchieren | RAG → Exa Search → LinkedIn | `decision_makers.json` + `.md` |
| **TechStackAgent**      | Technologie-Analyse       | Browser + HTTPX + RAG       | `tech_stack.json` + `.md`      |
| **TimelineAgent**       | Projekt-Timeline          | RAG + AI Extraction         | `timeline.json` + `.md`        |
| **PerformanceAgent**    | Core Web Vitals           | Lighthouse + Browser        | `performance.json` + `.md`     |

### Workflow-Orchestrator

```typescript
// Pseudo-Code für Agent-Orchestration

async function runQuickScan(rfpId: string) {
  const agents = [
    new NavigationAgent(rfpId),
    new DeliverablesAgent(rfpId),
    new DecisionMakersAgent(rfpId),
    new TechStackAgent(rfpId),
    new TimelineAgent(rfpId),
    new PerformanceAgent(rfpId),
  ];

  // Parallel execution mit Status-Updates
  const results = await Promise.allSettled(agents.map(agent => agent.run()));

  // Aggregate results
  const auditReport = mergeAgentResults(results);

  // Persist to DB + File System
  await saveAuditReport(rfpId, auditReport);

  return auditReport;
}
```

### RAG-first Agent Pattern

```typescript
abstract class ResearchAgent {
  abstract name: string;
  abstract ragQuery: string;

  async run() {
    // Phase 1: RAG Query
    const ragResult = await queryRAG(this.ragQuery);
    this.updateStatus('rag_query_complete', ragResult.confidence);

    // Phase 2: Confidence Check
    if (ragResult.confidence < 70) {
      this.updateStatus('low_confidence_external_research');

      // Phase 3: External Research
      const externalData = await this.externalResearch();

      // Phase 4: RAG Enrichment
      await enrichRAG(externalData);
      this.updateStatus('rag_enriched');

      // Phase 5: Re-Query
      const improvedResult = await queryRAG(this.ragQuery);
      this.updateStatus('re_query_complete', improvedResult.confidence);

      return improvedResult;
    }

    return ragResult;
  }

  abstract externalResearch(): Promise<any>;
}
```

### Sidebar Status Component

```tsx
// components/quick-scan/agent-status-sidebar.tsx

interface AgentStatus {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  phase:
    | 'rag_query'
    | 'confidence_check'
    | 'external_research'
    | 'rag_enrichment'
    | 're_query'
    | 'complete';
  confidence: number;
  progress: number; // 0-100
  logs: string[];
  startedAt?: Date;
  completedAt?: Date;
}

export function AgentStatusSidebar({ rfpId }: { rfpId: string }) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);

  // SSE subscription für real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`/api/rfps/${rfpId}/agent-status`);

    eventSource.onmessage = event => {
      const update = JSON.parse(event.data);
      setAgents(prev => updateAgentStatus(prev, update));
    };

    return () => eventSource.close();
  }, [rfpId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Agents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.map(agent => (
          <AgentStatusCard key={agent.name} agent={agent} />
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## Audit Report Struktur

Analog zu `audits/audit_lucarnofestival.ch/audit_data/`:

```
storage/
└── rfps/
    └── {rfp_id}/
        └── audit_data/
            ├── README.md                      # Zusammenfassung
            ├── navigation.json + .md          # Navigationsstruktur
            ├── deliverables.json + .md        # Einzureichende Unterlagen
            ├── decision_makers.json + .md     # Entscheider + Kontakte
            ├── tech_stack.json + .md          # Technologie-Stack
            ├── timeline.json + .md            # Projekt-Timeline
            ├── performance.json + .md         # Performance-Audit
            └── screenshots/                   # Browser-Screenshots
```

### JSON Schema Beispiele

**navigation.json:**

```json
{
  "url": "https://example.com",
  "timestamp": "2026-01-22T10:00:00Z",
  "navigation": {
    "primary": [...],
    "footer": [...],
    "metadata": {
      "total_items": 45,
      "max_depth": 3,
      "has_search": true,
      "languages": ["de", "en"]
    }
  }
}
```

**deliverables.json:**

```json
{
  "rfp_id": "xztq...",
  "extracted_from": "RFP_Dokument.pdf",
  "deliverables": [
    {
      "name": "Angebot",
      "mandatory": true,
      "deadline": "2025-12-15T14:00:00Z",
      "format": "PDF",
      "copies": 3,
      "confidence": 95,
      "source_page": 12
    }
  ],
  "summary": {
    "total": 12,
    "mandatory": 8,
    "optional": 4,
    "avg_confidence": 87
  }
}
```

---

## UI/UX Design

### Quick Scan Results Page – Neue Struktur

**Facts Tab:**

- ✅ Navigationsstruktur Card (neu)
- ✅ Tech Stack Card (erweitert mit HTTPX-Daten)
- ✅ Performance Card
- ✅ Content Volume Card
- ✅ Deliverables Card (rechts in Sidebar, unter Dokumenten)
- ✅ Timeline Card (mit Lieferumfang integriert)
- ✅ Decision Makers Card (erweitert mit Web-Search-Daten)
- ✅ Screenshots Grid (Thumbnails, klickbar für Vollansicht)

**Entfernen:**

- ❌ Deep Migration Analysis Card (hier nicht relevant)
- ❌ Baseline Comparison Card (gehört in separate View)
- ❌ Project Planning Card (gehört in separate View)
- ❌ Notification Card (gehört in separate View)

**Sidebar (rechts):**

```
┌─────────────────────────┐
│ Dokumente               │
│ - RFP_Ausschreibung.pdf │
│ - Anlage_A.xlsx         │
├─────────────────────────┤
│ Deliverables            │ ← NEU: hier statt in Main
│ - Angebot (15.12.)      │
│ - Referenzen (15.12.)   │
│ - Konzept (20.12.)      │
├─────────────────────────┤
│ Research Agents         │ ← NEU: Agent Status
│ ⏳ Navigation (45%)     │
│ ✅ Tech Stack           │
│ ⏳ Deliverables (78%)   │
│ ❌ Decision Makers      │
│ ⏳ Timeline (23%)       │
└─────────────────────────┘
```

### Screenshot Grid Design

**Statt:** Alle Screenshots in voller Größe nacheinander
**Jetzt:** 3-spalten Grid mit Thumbnails

```tsx
<div className="grid grid-cols-3 gap-2">
  {screenshots.map(screenshot => (
    <Dialog>
      <DialogTrigger>
        <img
          src={screenshot.thumbnail}
          alt={screenshot.label}
          className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80"
        />
        <p className="text-xs text-muted-foreground mt-1">{screenshot.label}</p>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <img src={screenshot.full} alt={screenshot.label} />
      </DialogContent>
    </Dialog>
  ))}
</div>
```

---

## Implementierungs-Reihenfolge (MVP → Full)

### Phase 1: MVP - Navigationsstruktur (1-2 Tage)

**Scope:**

- NavigationAgent implementieren
- Browser-Crawling mit Puppeteer
- Basis-Datenstruktur `navigation.json` + `.md`
- Agent Status Sidebar (einfache Version)
- UI Card für Navigationsstruktur

**Output:**

- User kann Website-Navigation automatisch erfasst sehen
- Sidebar zeigt "NavigationAgent: Running → Done"

---

### Phase 2: RAG-first Workflow (2-3 Tage)

**Scope:**

- RAG Query Service implementieren
- Confidence Check Logik
- External Research Trigger
- RAG Enrichment Pipeline
- Re-Query Mechanismus
- Status-Updates via SSE

**Output:**

- Agents nutzen RAG-first Pattern
- Sidebar zeigt Workflow-Steps live

---

### Phase 3: Deliverables + Timeline (3-4 Tage)

**Scope:**

- DeliverablesAgent mit AI Extraction
- TimelineAgent mit RAG Query
- Lieferumfang-Integration in Timeline
- Sidebar: Deliverables Card verschieben
- Verbesserte Extraktion (< 10% "Unbekannt")

**Output:**

- Deliverables automatisch extrahiert
- Timeline mit Deadlines + Lieferumfang

---

### Phase 4: Entscheider + HTTPX (3-4 Tage)

**Scope:**

- DecisionMakersAgent mit Web Search
- Exa API Integration
- LinkedIn Profile Extraction
- TechStackAgent mit HTTPX
- HTTPX → RAG Pipeline

**Output:**

- Entscheider mit LinkedIn-Profilen
- Vollständiger Tech Stack (Browser + HTTPX)

---

### Phase 5: Screenshots + Performance (2-3 Tage)

**Scope:**

- Screenshot Grid Komponente
- Thumbnail-Generierung
- Dialog für Vollansicht
- PerformanceAgent (Lighthouse)

**Output:**

- Screenshots als klickbare Thumbnails
- Performance-Audit wie bei manuellen Audits

---

## Open Questions

1. **Web Search API:** Exa API ausreichend oder zusätzlich Serper/Google Custom Search?
2. **LinkedIn Scraping:** Nur public data oder auch via API (kostenpflichtig)?
3. **HTTPX Rate Limiting:** Wie viele Requests pro Website? Timeout?
4. **Agent Parallelisierung:** Alle Agents parallel oder Sequential Dependencies?
5. **Audit Storage:** File System + DB oder nur DB mit JSON column?
6. **Screenshot Anzahl:** Limit 10-15 Screenshots oder alle Unterseiten?
7. **RAG Enrichment:** Automatisch in Vector Store oder erst nach Review?

---

## Constraints & Risiken

**Technical Constraints:**

- HTTPX Scans können bei großen Sites lange dauern (5-10 Sekunden)
- Puppeteer Memory Footprint bei vielen parallelen Agents
- Exa API Rate Limits (100 requests/month free tier)
- LinkedIn blockiert aggressive Scraping

**Risiken:**

- Web Search liefert falsche/veraltete Daten → Confidence-Scores wichtig
- RAG Enrichment kann Noise einfügen → Validierung nötig
- Agent Failures müssen graceful gehandled werden → Retry-Logic
- Lange Laufzeiten (5-10 Min) für komplette Website-Analyse → Progress-Feedback kritisch

**Mitigation:**

- Confidence Thresholds klar definieren (>= 70% für Auto-Accept)
- Manual Review-Option für niedrige Confidence
- Agent Timeouts (max 2 Min pro Agent)
- Fallback auf "Unbekannt" statt falscher Daten

---

## Success Criteria

**Must-Have (MVP):**

- ✅ Navigationsstruktur vollständig erfasst
- ✅ Agent Status in Sidebar sichtbar
- ✅ RAG-first Workflow funktioniert
- ✅ Deliverables < 30% "Unbekannt" (von 100% → 30%)

**Should-Have (Phase 2-4):**

- ✅ Entscheider min. 2-3 Personen mit LinkedIn
- ✅ HTTPX Daten im RAG
- ✅ Timeline mit Deadlines + Lieferumfang
- ✅ Screenshots als Thumbnails

**Nice-to-Have (Future):**

- ✅ Performance-Audit wie bei manuellen Audits
- ✅ Accessibility-Audit (Axe-core)
- ✅ CMS-Comparison automatisch generieren
- ✅ Cost-Estimation basierend auf Audit-Daten

---

## Referenzen

- **Manual Audit Example:** `audits/audit_lucarnofestival.ch/`
- **Current Quick Scan:** `lib/quick-scan/agents/`
- **RAG System:** `lib/rag/`
- **UI Components:** `components/bids/facts-tab.tsx`

---

**Nächste Schritte:**

1. ✅ PRD Review mit Team
2. ⏳ Technical Spike: Browser Crawling Performance testen
3. ⏳ Exa API Evaluation (Search Quality)
4. ⏳ NavigationAgent Prototype (Phase 1 MVP)
