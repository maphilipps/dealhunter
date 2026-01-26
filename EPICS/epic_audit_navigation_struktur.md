# Quick Scan Audit Navigation – In-App Sidebar

**Kontext:** Navigation rechts in RFP-Detail-Seite für automatisch generierte Audit-Daten
**Stil:** Collapsible Sections (ShadCN Accordion), kompakt, max 2-3 Ebenen tief

---

## Navigations-Struktur (Vollständig)

**Basiert auf:** VitePress Manual Audit Navigation (11 Hauptkategorien, 33+ Sub-Items)

```
┌─────────────────────────────────────┐
│ 📄 Dokumente                        │ ← Bestehend
│  ├─ RFP_Ausschreibung.pdf          │
│  └─ Anlage_A_Preisblatt.xlsx       │
├─────────────────────────────────────┤
│ 📋 Deliverables                     │ ← NEU (verschoben aus Main)
│  ├─ 📌 Angebot (15.12. 14:00)      │
│  ├─ 📌 Referenzen (15.12. 14:00)   │
│  ├─ 📄 Konzept (20.12.)            │
│  └─ 📄 Präsentation (20.12.)       │
│                                     │
│  [4 Pflicht, 2 Optional]           │
├─────────────────────────────────────┤
│ 🤖 Research Status                  │ ← NEU (Agent Activity)
│  ├─ ✅ Navigation (100%)           │
│  ├─ ✅ Tech Stack (100%)           │
│  ├─ ⏳ Content-Volumen (67%)       │
│  ├─ ✅ Deliverables (100%)         │
│  ├─ ❌ Entscheider (failed)        │
│  └─ ⏳ Integrationen (34%)         │
│                                     │
│  [4 done, 1 running, 1 failed]     │
├─────────────────────────────────────┤
│ 📊 Audit-Navigation ▼               │ ← NEU (Main Navigation)
│                                     │
│  📋 Übersicht                      │ (Agent: RAG Summary)
│    ├─ Executive Summary            │
│    └─ Detaillierte Zusammenfassung │
│                                     │
│  🖥️ Aktuelle Technologie           │ (Agent: TechStack)
│    ├─ CMS & Framework             │
│    └─ Server & Infrastruktur      │
│                                     │
│  🌐 Website-Analyse                │ (Agent: Navigation, Content)
│    ├─ Navigationsstruktur          │
│    ├─ Content-Volumen              │
│    ├─ Performance                  │
│    └─ Accessibility                │
│                                     │
│  🏗️ CMS-Architektur                │ (Agent: TechStack + RAG)
│    ├─ Content-Typen & Struktur    │
│    ├─ Taxonomien & Kategorien     │
│    ├─ Mehrsprachigkeit            │
│    └─ Berechtigungskonzept        │
│                                     │
│  ⚖️ CMS-Vergleich                  │ (Agent: CMS Comparison)
│    ├─ Drupal CMS 2.0              │
│    ├─ Magnolia                     │
│    ├─ Ibexa                        │
│    └─ Feature-Matrix               │
│                                     │
│  ☁️ Hosting & Infrastruktur        │ (Agent: TechStack)
│    ├─ Server-Setup                │
│    └─ DevOps & Deployment          │
│                                     │
│  🔌 Integrationen                  │ (Agent: Integrations)
│    ├─ Single Sign-On (SSO)        │
│    ├─ Suchfunktionalität          │
│    ├─ Media Management            │
│    ├─ E-Commerce                   │
│    ├─ Newsletter                   │
│    ├─ Analytics                    │
│    └─ Third-Party Services         │
│                                     │
│  🚀 Migration & Projekt            │ (Agent: Migration + RAG)
│    ├─ Migrations-Strategie        │
│    ├─ Aufwandsschätzung           │
│    └─ Projekt-Timeline             │
│                                     │
│  👥 Projekt-Organisation           │ (Agent: RAG + Deliverables)
│    ├─ Team-Struktur               │
│    └─ Deliverables                 │
│                                     │
│  💰 Kosten & Budget                │ (Agent: Cost Estimation)
│    ├─ Kostenaufstellung           │
│    ├─ Lizenzkosten                │
│    └─ Budget-Hinweise aus RFP     │
│                                     │
│  ✅ Empfehlung                     │ (Agent: Final Recommendation)
│    └─ Zusammenfassung & Empfehlung│
└─────────────────────────────────────┘
```

---

## Sections im Detail

### 1. 📄 Dokumente (Bestehend)

**Status:** Bereits implementiert
**Funktion:** Hochgeladene PDFs/Dateien anzeigen
**Keine Änderung nötig**

---

### 2. 📋 Deliverables (Verschoben)

**Status:** Umziehen aus Main Content
**Funktion:** Quick-Access zu einzureichenden Unterlagen

**Visualisierung:**

- Pflicht-Deliverables mit 📌 Icon
- Optional mit 📄 Icon
- Deadline-Badge rechts (rot wenn < 7 Tage)
- Click → scrollt zu Deliverables Section im Main

**Beispiel:**

```
📋 Deliverables (6)
  📌 Angebot           [15.12. 14:00] ⚠️ 3 Tage
  📌 Referenzen        [15.12. 14:00] ⚠️ 3 Tage
  📄 Konzept           [20.12.]
  📄 Präsentation      [20.12.]
  📄 Projektplan       [Optional]
  📄 Sicherheitskonzept [Optional]

Zusammenfassung:
  4 Pflicht | 2 Optional
  Nächste Deadline: in 3 Tagen
```

---

### 3. 🤖 Research Status (NEU)

**Status:** Neu implementieren
**Funktion:** Live-Status aller Research Agents

**States:**

- ⏳ Running (mit % Progress)
- ✅ Done (mit Completion-Time)
- ❌ Failed (mit Error-Hint)
- ⏸️ Queued (noch nicht gestartet)

**Interaktion:**

- Hover → Tooltip mit Details (z.B. "Collecting navigation structure...")
- Click → öffnet Collapsible mit Logs

**Beispiel:**

```
🤖 Research Status

✅ Navigation          [Completed 12:34]
✅ Tech Stack          [Completed 12:35]
⏳ Content-Volumen     [Running... 67%]
   └─ Crawling pages: 134/200
✅ Deliverables        [Completed 12:36]
❌ Entscheider         [Failed]
   └─ LinkedIn rate limit exceeded
⏳ Integrationen       [Running... 34%]
   └─ Analyzing API endpoints

[4 done, 2 running, 1 failed]
```

---

### 4. 📊 Audit-Navigation (NEU)

**VOLLE TIEFE:** Alle 11 Kategorien wie in VitePress Manual Audits

---

**4.1 📋 Übersicht**

**Datenquelle:** RAG Summary Agent (generiert aus allen Agent-Ergebnissen)
**Status:** Automatisch generiert nach Abschluss aller Research Agents

```
📋 Übersicht ▼

  Executive Summary
    ├─ Projekt-Typ: Drupal Migration
    ├─ Komplexität: Hoch (4.2/5)
    ├─ Geschätzter Aufwand: 180-220 PT
    ├─ Empfohlene Team-Größe: 5-6 Personen
    └─ Geschätzte Dauer: 22-26 Wochen

  Detaillierte Zusammenfassung
    ├─ Key Findings (Top 5)
    ├─ Hauptrisiken (Top 3)
    ├─ Chancen & Potenziale
    └─ Quick Decision: BID ✅ / NO-BID ❌
```

**Click-Behavior:**

- Click auf "Executive Summary" → scrollt zu Executive Summary Card
- Click auf "Detaillierte Zusammenfassung" → scrollt zu Details Card

---

**4.2 🖥️ Aktuelle Technologie**

**Datenquelle:** TechStack Agent (HTTPX + Wappalyzer + Manual Detection)
**Status:** Automatisch generiert

```
🖥️ Aktuelle Technologie ▼

  CMS & Framework
    ├─ CMS: Drupal 10.1.5
    ├─ Framework: React 18.2
    ├─ State Management: Redux Toolkit
    ├─ Frontend Build: Webpack 5
    └─ CSS Framework: Tailwind CSS

  Server & Infrastruktur
    ├─ Webserver: nginx 1.21.6
    ├─ PHP Version: 8.1.12
    ├─ Database: PostgreSQL 14.5
    ├─ Caching: Redis 7.0 + Varnish 7.1
    └─ CDN: Cloudflare
```

**Click-Behavior:**

- Click auf "CMS & Framework" → scrollt zu Tech Stack Card
- Click auf "Server & Infrastruktur" → scrollt zu Infrastructure Card

---

**4.3 🌐 Website-Analyse**

**Datenquelle:** Navigation Agent + Content Agent + Performance Agent
**Status:** Automatisch generiert

```
🌐 Website-Analyse ▼

  Navigationsstruktur
    ├─ Haupt-Navigation: 8 items, 3 Ebenen tief
    ├─ Mega-Menü: 3 sections mit Subnavigation
    ├─ Footer-Navigation: 12 items
    └─ Mobile Navigation: Hamburger mit Drawer

  Content-Volumen
    ├─ Geschätzte Seiten: ~450
    ├─ Content-Typen: 12 (Article, Page, Event, etc.)
    ├─ Taxonomien: 5 (Tags, Kategorien, Regions, etc.)
    └─ Media Library: ~1200 Dateien (800 Images, 400 Documents)

  Performance
    ├─ Core Web Vitals: ✅ Passed
    ├─ LCP: 364ms ✅
    ├─ CLS: 0.0 ✅
    ├─ TTFB: 53ms ✅
    └─ Page Weight: 7.5 MB ⚠️ (Optimierung empfohlen)

  Accessibility
    ├─ WCAG 2.1 Level: AA ✅
    ├─ Axe Issues: 12 warnings, 2 errors
    ├─ Auto-fixable: 8 issues
    └─ Color Contrast: Passed
```

**Click-Behavior:**

- Click auf "Navigationsstruktur" → scrollt zu Navigation Card
- Click auf "Content-Volumen" → scrollt zu Content Card
- Click auf "Performance" → scrollt zu Performance Card
- Click auf "Accessibility" → scrollt zu Accessibility Card

---

**4.4 🏗️ CMS-Architektur**

**Datenquelle:** TechStack Agent + RAG (extrahiert aus RFP Dokumenten)
**Status:** Teil-automatisch (Agent + RAG Query)

```
🏗️ CMS-Architektur ▼

  Content-Typen & Struktur
    ├─ 12 Custom Content Types identifiziert
    ├─ Entity Reference Fields: 45
    ├─ Paragraphs: 23 Typen
    └─ View Modes: 8

  Taxonomien & Kategorien
    ├─ 5 Haupt-Taxonomien
    ├─ Hierarchische Tags (3 Ebenen)
    └─ ~2400 Terms gesamt

  Mehrsprachigkeit
    ├─ Sprachen: DE, FR, IT, EN
    ├─ Translation Strategy: Content Translation
    ├─ Übersetzungs-Coverage: 85% (geschätzt)
    └─ Language Fallback: Aktiviert

  Berechtigungskonzept
    ├─ Rollen: 8 identifiziert
    ├─ Custom Permissions: ~150
    └─ Workflow-States: 5 (Draft, Review, Published, Archived, Deleted)
```

**Click-Behavior:**

- Click auf "Content-Typen" → scrollt zu Architecture Card
- Click auf "Mehrsprachigkeit" → scrollt zu I18n Card

---

**4.5 ⚖️ CMS-Vergleich**

**Datenquelle:** CMS Comparison Agent (generiert Feature-Matrix)
**Status:** Automatisch generiert

```
⚖️ CMS-Vergleich ▼

  Drupal CMS 2.0
    ├─ Feature Coverage: 95%
    ├─ Enterprise-Ready: ✅
    ├─ Lizenzkosten: Open Source (€0)
    └─ adesso Expertise: Sehr hoch

  Magnolia
    ├─ Feature Coverage: 88%
    ├─ Enterprise-Ready: ✅
    ├─ Lizenzkosten: ~€120k/Jahr
    └─ adesso Expertise: Mittel

  Ibexa
    ├─ Feature Coverage: 82%
    ├─ Enterprise-Ready: ✅
    ├─ Lizenzkosten: ~€80k/Jahr
    └─ adesso Expertise: Mittel

  Feature-Matrix
    ├─ Detaillierte Gegenüberstellung (12 Kategorien)
    ├─ Scoring: Drupal 4.5/5, Magnolia 3.8/5, Ibexa 3.5/5
    └─ Empfehlung: Drupal CMS 2.0 (✅ Best Fit)
```

**Click-Behavior:**

- Click auf "Drupal CMS 2.0" → scrollt zu Drupal Card
- Click auf "Feature-Matrix" → scrollt zu Comparison Table Card

---

**4.6 ☁️ Hosting & Infrastruktur**

**Datenquelle:** TechStack Agent + RAG
**Status:** Automatisch generiert

```
☁️ Hosting & Infrastruktur ▼

  Server-Setup
    ├─ Hosting-Typ: Dedicated Server (aktuell)
    ├─ Empfohlen: Managed Cloud (Azure/AWS)
    ├─ Redundanz: Load Balancer + 3 App Servers
    ├─ Database: PostgreSQL Cluster (Primary + 2 Replicas)
    └─ Caching: Redis Cluster + Varnish Edge

  DevOps & Deployment
    ├─ CI/CD: GitLab CI aktuell
    ├─ Empfohlen: GitHub Actions + Azure DevOps
    ├─ Deployment-Strategie: Blue-Green
    ├─ Monitoring: Prometheus + Grafana
    └─ Backup: Täglich + Retention 30 Tage
```

**Click-Behavior:**

- Click auf "Server-Setup" → scrollt zu Hosting Card
- Click auf "DevOps" → scrollt zu DevOps Card

---

**4.7 🔌 Integrationen**

**Datenquelle:** Integrations Agent (HTTPX + API Detection)
**Status:** Automatisch generiert

```
🔌 Integrationen ▼

  Single Sign-On (SSO)
    ├─ Provider: Keycloak OAuth2
    ├─ Protokoll: OIDC + SAML 2.0
    ├─ User-Sync: LDAP Integration
    └─ Migrations-Aufwand: Mittel (20-30 PT)

  Suchfunktionalität
    ├─ Engine: Elasticsearch 8.5
    ├─ Indizes: 3 (Content, Media, Users)
    ├─ Features: Faceted Search, Autocomplete, Typo Tolerance
    └─ Migrations-Aufwand: Niedrig (8-12 PT)

  Media Management
    ├─ CDN: Vimeo für Videos
    ├─ Image Processing: Cloudinary
    ├─ DAM Integration: Nein (empfohlen)
    └─ Migrations-Aufwand: Mittel (15-20 PT)

  E-Commerce
    ├─ Platform: Shopify Plus
    ├─ Integration: Custom API Bridge
    ├─ Sync: Real-time via Webhooks
    └─ Migrations-Aufwand: Hoch (40-50 PT)

  Newsletter
    ├─ Provider: Mailchimp
    ├─ Subscriber-Sync: Täglich via API
    ├─ Templates: 12 Custom Templates
    └─ Migrations-Aufwand: Niedrig (5-8 PT)

  Analytics
    ├─ Tool: Google Analytics 4 + Matomo
    ├─ Tracking: GTM Container
    ├─ Custom Events: 45 definiert
    └─ Migrations-Aufwand: Niedrig (3-5 PT)

  Third-Party Services
    ├─ Zendesk (Support Chat)
    ├─ Stripe (Payments)
    ├─ SendGrid (Transactional Emails)
    └─ Gesamt-Aufwand: ~120-140 PT
```

**Click-Behavior:**

- Click auf "Single Sign-On" → scrollt zu SSO Card
- Click auf "E-Commerce" → scrollt zu E-Commerce Card
- etc.

---

**4.8 🚀 Migration & Projekt**

**Datenquelle:** Migration Agent + Timeline Agent + RAG
**Status:** Automatisch generiert

```
🚀 Migration & Projekt ▼

  Migrations-Strategie
    ├─ Ansatz: Big Bang vs. Phased Migration
    ├─ Empfehlung: Phased (3 Phasen)
    ├─ Content-Migration: Automated (Migrate API)
    ├─ Rollback-Plan: Vorhanden
    └─ Testing-Strategie: 4 Stufen (Unit, Integration, E2E, UAT)

  Aufwandsschätzung
    ├─ Discovery & Planning: 15-20 PT
    ├─ Setup & Configuration: 25-30 PT
    ├─ Content-Migration: 40-50 PT
    ├─ Integrationen: 120-140 PT
    ├─ Frontend Development: 60-80 PT
    ├─ Testing & QA: 30-40 PT
    ├─ Deployment & GoLive: 10-15 PT
    └─ GESAMT: 300-375 PT (ohne Puffer)

  Projekt-Timeline
    ├─ Phase 1: Discovery & Setup (4 Wochen)
    ├─ Phase 2: Development & Migration (14 Wochen)
    ├─ Phase 3: Testing & GoLive (4 Wochen)
    ├─ GESAMT: 22 Wochen (ohne Puffer)
    └─ Mit Puffer: 26 Wochen empfohlen
```

**Click-Behavior:**

- Click auf "Migrations-Strategie" → scrollt zu Strategy Card
- Click auf "Aufwandsschätzung" → scrollt zu Estimation Card
- Click auf "Projekt-Timeline" → scrollt zu Timeline Card

---

**4.9 👥 Projekt-Organisation**

**Datenquelle:** RAG (aus RFP) + Deliverables Agent
**Status:** Automatisch generiert

```
👥 Projekt-Organisation ▼

  Team-Struktur
    ├─ Empfohlene Größe: 5-6 Personen
    ├─ Rollen:
    │   ├─ Project Lead (1x)
    │   ├─ Drupal Backend (2x)
    │   ├─ Frontend Developer (1x)
    │   ├─ DevOps Engineer (1x)
    │   └─ QA Engineer (0.5x)
    └─ Externe Unterstützung: Design Agency (optional)

  Deliverables
    ├─ → Siehe Deliverables-Section oben (Quick-Link)
    ├─ Gesamt: 6 (4 Pflicht, 2 Optional)
    ├─ Nächste Deadline: Angebot (15.12. 14:00) ⚠️ 3 Tage
    └─ Kritische Pfade: Referenzen + Konzept
```

**Click-Behavior:**

- Click auf "Team-Struktur" → scrollt zu Team Card
- Click auf "Deliverables" → scrollt nach oben zu Deliverables Section

---

**4.10 💰 Kosten & Budget**

**Datenquelle:** Cost Estimation Agent + RAG
**Status:** Automatisch generiert

```
💰 Kosten & Budget ▼

  Kostenaufstellung
    ├─ Entwicklung: 300-375 PT × €1200 = €360k-€450k
    ├─ Projekt-Management: 15% = €54k-€68k
    ├─ Testing & QA: Inkludiert in Development
    ├─ Hosting (1. Jahr): €24k-€36k
    └─ GESAMT (ohne Lizenzen): €438k-€554k

  Lizenzkosten
    ├─ Drupal CMS 2.0: €0 (Open Source)
    ├─ Third-Party APIs: €8k-€12k/Jahr
    ├─ Hosting & Cloud: €24k-€36k/Jahr
    └─ Support & Wartung: €30k-€50k/Jahr

  Budget-Hinweise aus RFP
    ├─ Erwähntes Budget: "< 250k CHF" (Seite 3)
    ├─ Confidence: 65% (RAG-basiert)
    ├─ ⚠️ ACHTUNG: Budget zu niedrig für Scope
    └─ Empfehlung: Scope-Reduktion oder Budget-Erhöhung erforderlich
```

**Click-Behavior:**

- Click auf "Kostenaufstellung" → scrollt zu Cost Card
- Click auf "Budget-Hinweise" → scrollt zu Budget Analysis Card

---

**4.11 ✅ Empfehlung**

**Datenquelle:** Final Recommendation Agent (generiert aus allen Daten)
**Status:** Automatisch generiert als letzter Schritt

```
✅ Empfehlung ▼

  Zusammenfassung & Empfehlung
    ├─ BID/NO-BID: ✅ BID (mit Vorbehalt)
    ├─ Confidence: 78%
    ├─ Key Decision Factors:
    │   ✅ Technisch machbar (Drupal Migration)
    │   ✅ Gute Feature-Fit mit Drupal CMS 2.0
    │   ✅ adesso Expertise vorhanden
    │   ⚠️ Budget-Diskrepanz (€438k vs. €250k)
    │   ⚠️ Enge Timeline (22 Wochen ambitioniert)
    ├─ Empfohlene Strategie:
    │   1. Angebot mit realistischer Kostenschätzung
    │   2. Alternative Scope-Varianten anbieten
    │   3. Phased Migration vorschlagen (Risiko-Minimierung)
    │   4. Budget-Erhöhung oder Scope-Reduktion verhandeln
    └─ Next Steps:
        ├─ Angebot vorbereiten (bis 15.12. 14:00)
        ├─ Referenzen zusammenstellen (3-4 ähnliche Projekte)
        └─ Konzept für Phased Migration ausarbeiten
```

**Click-Behavior:**

- Click auf "Zusammenfassung" → scrollt zu Final Recommendation Card

---

## Progressive Daten-Anreicherung & Synthesizer-Architektur

**Kern-Prinzip:** Research Agents arbeiten **nacheinander**, ergänzen den RAG Store kontinuierlich, dann holt sich jede Section ihre Daten via **Synthesizer** aus RAG.

### Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Research Agents (Sequential Execution)            │
└─────────────────────────────────────────────────────────────┘
         ↓
1. Navigation Agent → RAG Store
         ↓ (RAG enriched)
2. TechStack Agent → RAG Store
         ↓ (RAG enriched)
3. Content Agent → RAG Store
         ↓ (RAG enriched)
4. Performance Agent → RAG Store
         ↓ (RAG enriched)
5. Integrations Agent → RAG Store
         ↓ (RAG enriched)
6. Deliverables Agent → RAG Store
         ↓ (RAG enriched)
7. DecisionMakers Agent → RAG Store
         ↓ (RAG enriched)
8. Timeline Agent → RAG Store

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Section Synthesizer (On-Demand)                   │
└─────────────────────────────────────────────────────────────┘
         ↓
User klickt auf "CMS-Architektur" in Navigation
         ↓
Section Synthesizer Agent ("cms-architecture")
  ├─ RAG Query: "Content-Typen, Taxonomien, Mehrsprachigkeit"
  ├─ Confidence Check (>= 70%)
  ├─ Falls nicht: Web Search / HTTPX
  └─ Strukturiert Output für diese Section

         ↓
Structured JSON Output (section-spezifisch)
  {
    "section": "cms-architecture",
    "subsections": [
      {
        "id": "content-types",
        "title": "Content-Typen & Struktur",
        "data": { ... }
      },
      ...
    ]
  }

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Dashboard Builder Agent                           │
└─────────────────────────────────────────────────────────────┘
         ↓
Dashboard Builder Agent (universal)
  ├─ Input: Structured JSON von Synthesizer
  ├─ Output: JSON Render Spec
  └─ Mappt auf Audit Catalog Components

         ↓
JSON Render Spec
  {
    "type": "audit-card",
    "props": { "id": "content-types", ... },
    "children": [ ... ]
  }

┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: JSON Render → ShadCN UI                           │
└─────────────────────────────────────────────────────────────┘
         ↓
<Card id="content-types">
  <CardHeader>Content-Typen & Struktur</CardHeader>
  <CardContent>
    <KeyValueList items={...} />
  </CardContent>
</Card>
```

### Agent-Typen

**A) Research Agents (8 Stück)** - Sammeln Roh-Daten, speichern in RAG

| Agent                | Funktion                                 | Output      |
| -------------------- | ---------------------------------------- | ----------- |
| Navigation Agent     | Crawlt Website, extrahiert Navigation    | → RAG Store |
| TechStack Agent      | HTTPX + Wappalyzer, erkennt Technologien | → RAG Store |
| Content Agent        | Schätzt Content-Volumen, Seiten, Media   | → RAG Store |
| Performance Agent    | Lighthouse + Axe, Web Vitals             | → RAG Store |
| Integrations Agent   | Erkennt APIs, SSO, E-Commerce, Analytics | → RAG Store |
| Deliverables Agent   | Extrahiert Deliverables aus RFP          | → RAG Store |
| DecisionMakers Agent | LinkedIn/Web Search für Entscheider      | → RAG Store |
| Timeline Agent       | Extrahiert Deadlines, schätzt Timeline   | → RAG Store |

**B) Section Synthesizer (11 Stück)** - Holen section-spezifische Daten aus RAG

| Synthesizer                  | RAG Query                                | Output Format          |
| ---------------------------- | ---------------------------------------- | ---------------------- |
| Overview Synthesizer         | "Executive Summary, Key Findings"        | Summary JSON           |
| Tech Current Synthesizer     | "CMS, Framework, Server, Infrastructure" | Tech JSON              |
| Website Analysis Synthesizer | "Navigation, Content, Performance, A11y" | Website JSON           |
| CMS Architecture Synthesizer | "Content-Types, Taxonomies, i18n, Perms" | Architecture JSON      |
| CMS Comparison Synthesizer   | "Drupal vs Magnolia vs Ibexa"            | Comparison Matrix JSON |
| Hosting Synthesizer          | "Server Setup, DevOps, Deployment"       | Hosting JSON           |
| Integrations Synthesizer     | "SSO, Search, Media, E-Commerce, etc."   | Integrations JSON      |
| Migration Synthesizer        | "Strategy, Effort, Timeline"             | Migration JSON         |
| Project Org Synthesizer      | "Team Structure, Deliverables"           | Org JSON               |
| Costs Synthesizer            | "Cost Breakdown, Licenses, Budget Hints" | Costs JSON             |
| Recommendation Synthesizer   | "BID/NO-BID, Confidence, Next Steps"     | Recommendation JSON    |

**C) Dashboard Builder Agent (1 Stück)** - Universal, konvertiert zu JSON Render

- Input: Structured JSON von Synthesizer
- Output: JSON Render Spec (mappt auf Audit Catalog)
- Wiederverwendbar für ALLE Sections

### Vorteile dieser Architektur

✅ **Separation of Concerns** - Research ≠ Presentation
✅ **RAG als Single Source of Truth** - Alle Daten zentral gespeichert
✅ **Progressive Enhancement** - Jeder Agent ergänzt RAG, spätere Agents nutzen frühere Daten
✅ **On-Demand Rendering** - Sections werden nur generiert, wenn User sie öffnet
✅ **Wiederverwendbarkeit** - Dashboard Builder ist universal
✅ **Testbarkeit** - Synthesizer-Output ist deterministisch testbar
✅ **Flexibilität** - Neue Sections = neuer Synthesizer, keine Änderung an Research Agents

### Daten-Flow Beispiel: "CMS-Architektur" Section

```
1. User öffnet "CMS-Architektur" in Navigation
     ↓
2. CMS Architecture Synthesizer startet
     ├─ RAG Query: "Welche Content-Typen wurden gefunden?"
     ├─ RAG Query: "Welche Taxonomien existieren?"
     ├─ RAG Query: "Ist die Site mehrsprachig?"
     └─ RAG Query: "Welche Berechtigungsrollen wurden erwähnt?"
     ↓
3. Confidence Check
     ├─ Content-Typen: 85% ✅ (aus TechStack + Content Agent)
     ├─ Taxonomien: 75% ✅ (aus Content Agent)
     ├─ Mehrsprachigkeit: 45% ⚠️ (niedrig)
     │   └─ → Web Search für fehlende Infos
     └─ Berechtigungen: 30% ⚠️ (niedrig)
         └─ → Template-basiert (Standard Drupal Roles)
     ↓
4. Structured JSON Output
{
  "section": "cms-architecture",
  "confidence": 68,
  "subsections": [
    {
      "id": "content-types",
      "title": "Content-Typen & Struktur",
      "confidence": 85,
      "data": {
        "count": 12,
        "types": [...],
        "entityReferences": 45
      }
    },
    { ... }
  ]
}
     ↓
5. Dashboard Builder Agent
     ↓
6. JSON Render Spec
     ↓
7. <Card id="content-types"> ... </Card>
```

### Agent-zu-Navigation Mapping (vereinfacht)

| Navigation Section             | Synthesizer                  | RAG Data Sources                   |
| ------------------------------ | ---------------------------- | ---------------------------------- |
| **1. Übersicht**               | Overview Synthesizer         | Alle 8 Research Agents             |
| **2. Aktuelle Technologie**    | Tech Current Synthesizer     | TechStack Agent                    |
| **3. Website-Analyse**         | Website Analysis Synthesizer | Navigation + Content + Performance |
| **4. CMS-Architektur**         | CMS Architecture Synthesizer | TechStack + Content + RFP Docs     |
| **5. CMS-Vergleich**           | CMS Comparison Synthesizer   | TechStack + Templates              |
| **6. Hosting & Infrastruktur** | Hosting Synthesizer          | TechStack + RFP Docs               |
| **7. Integrationen**           | Integrations Synthesizer     | Integrations Agent                 |
| **8. Migration & Projekt**     | Migration Synthesizer        | Alle Agents (Complexity-basiert)   |
| **9. Projekt-Organisation**    | Project Org Synthesizer      | Timeline + Deliverables + RFP      |
| **10. Kosten & Budget**        | Costs Synthesizer            | Migration Synthesizer + RFP        |
| **11. Empfehlung**             | Recommendation Synthesizer   | Alle Agents + Costs                |

**GESAMT:**

- **8 Research Agents** (sammeln Daten → RAG)
- **11 Section Synthesizers** (RAG → strukturiertes JSON)
- **1 Dashboard Builder Agent** (JSON → JSON Render Spec)

---

## JSON Render Integration

**Problem:** Wir wissen nicht genau, welche Datenstruktur die Section Synthesizers zurückliefern.
**Lösung:** Dashboard Builder Agent generiert JSON Render Specs aus Synthesizer-Output.

### Workflow

```
Section Synthesizer (RAG → strukturiertes JSON)
     ↓
Dashboard Builder Agent
     ├─ Input: Synthesizer JSON
     ├─ Logik: Mappt auf Audit Catalog Components
     └─ Output: JSON Render Spec
     ↓
JSON Render Engine
     ↓
ShadCN UI Components (Cards, Tables, Charts, Lists)
     ↓
Audit Navigation Cards im Main Content
```

### JSON Render Catalog für Audit Cards

**Definierte Komponenten:**

| JSON Render Type   | ShadCN Component    | Use Case                             |
| ------------------ | ------------------- | ------------------------------------ |
| `audit-card`       | `Card`              | Wrapper für jede Audit Section       |
| `key-value-list`   | `List`              | Tech Stack, Server-Setup, etc.       |
| `badge-list`       | `Badge`             | Integrationen, Tags, Labels          |
| `metric-card`      | `Card + Progress`   | Performance Metrics (LCP, CLS, etc.) |
| `chart-bar`        | `Chart (Bar)`       | Content-Volumen, Aufwandsschätzung   |
| `chart-pie`        | `Chart (Pie)`       | CMS-Vergleich Scores                 |
| `feature-matrix`   | `Table`             | CMS Feature-Gegenüberstellung        |
| `timeline`         | `Timeline`          | Projekt-Timeline, Migration-Phasen   |
| `cost-breakdown`   | `Table + SUM`       | Kostenaufstellung                    |
| `recommendation`   | `Alert + Badge`     | BID/NO-BID mit Confidence            |
| `contact-card`     | `Card + Avatar`     | Entscheider-Kontakte                 |
| `integration-list` | `Accordion + Badge` | Integrationen mit Details            |

### Beispiel: Section Synthesizer → Dashboard Builder → JSON Render

**1. Tech Current Synthesizer Output (strukturiertes JSON):**

```json
{
  "section": "tech-current",
  "confidence": 92,
  "subsections": [
    {
      "id": "cms-framework",
      "title": "CMS & Framework",
      "type": "key-value-list",
      "data": {
        "items": [
          { "label": "CMS", "value": "Drupal 10.1.5", "badge": "current" },
          { "label": "Framework", "value": "React 18.2", "badge": "current" },
          { "label": "State Management", "value": "Redux Toolkit" },
          { "label": "Frontend Build", "value": "Webpack 5" },
          { "label": "CSS Framework", "value": "Tailwind CSS" }
        ]
      }
    },
    {
      "id": "server-infrastructure",
      "title": "Server & Infrastruktur",
      "type": "key-value-list",
      "data": {
        "items": [
          { "label": "Webserver", "value": "nginx 1.21.6" },
          { "label": "PHP Version", "value": "8.1.12" },
          { "label": "Database", "value": "PostgreSQL 14.5" },
          { "label": "Caching", "value": "Redis 7.0 + Varnish 7.1" },
          { "label": "CDN", "value": "Cloudflare" }
        ]
      }
    }
  ]
}
```

**2. Dashboard Builder Agent (generiert JSON Render Spec):**

```typescript
// Dashboard Builder Agent Logic
export async function buildDashboard(synthesizerOutput: SectionData): Promise<JsonRenderSpec> {
  const specs = synthesizerOutput.subsections.map(subsection => {
    // Mapping Logic basierend auf subsection.type
    switch (subsection.type) {
      case 'key-value-list':
        return {
          type: 'audit-card',
          props: {
            id: subsection.id,
            title: subsection.title,
            icon: 'monitor',
          },
          children: [
            {
              type: 'key-value-list',
              props: {
                items: subsection.data.items,
              },
            },
          ],
        };

      case 'metric-card':
        return {
          type: 'metric-card',
          props: {
            id: subsection.id,
            title: subsection.title,
            metrics: subsection.data.metrics,
          },
        };

      // ... weitere Mappings
    }
  });

  return { sections: specs };
}
```

**3. Dashboard Builder Output (JSON Render Spec):**

```json
{
  "sections": [
    {
      "type": "audit-card",
      "props": {
        "id": "cms-framework",
        "title": "CMS & Framework",
        "icon": "monitor"
      },
      "children": [
        {
          "type": "key-value-list",
          "props": {
            "items": [
              { "label": "CMS", "value": "Drupal 10.1.5", "badge": "current" },
              { "label": "Framework", "value": "React 18.2", "badge": "current" }
            ]
          }
        }
      ]
    },
    {
      "type": "audit-card",
      "props": {
        "id": "server-infrastructure",
        "title": "Server & Infrastruktur",
        "icon": "monitor"
      },
      "children": [
        {
          "type": "key-value-list",
          "props": {
            "items": [{ "label": "Webserver", "value": "nginx 1.21.6" }]
          }
        }
      ]
    }
  ]
}
```

**4. JSON Render Engine (rendert zu React):**

```tsx
<Card id="cms-framework">
  <CardHeader>
    <Monitor className="h-5 w-5" />
    <CardTitle>CMS & Framework</CardTitle>
  </CardHeader>
  <CardContent>
    <KeyValueList
      items={[
        { label: "CMS", value: "Drupal 10.1.5", badge: "current" },
        { label: "Framework", value: "React 18.2", badge: "current" }
      ]}
    />
  </CardContent>
</Card>

<Card id="server-infrastructure">
  <CardHeader>
    <Monitor className="h-5 w-5" />
    <CardTitle>Server & Infrastruktur</CardTitle>
  </CardHeader>
  <CardContent>
    <KeyValueList
      items={[
        { label: "Webserver", value: "nginx 1.21.6" }
      ]}
    />
  </CardContent>
</Card>
```

### Vorteile JSON Render für Audit Cards

✅ **Flexibel:** Agent kann neue Fields hinzufügen, UI passt sich automatisch an
✅ **Guardrails:** Nur vordefinierte ShadCN-Komponenten (kein Chaos)
✅ **Streaming:** Progressive Rendering während Agent arbeitet
✅ **Konsistent:** Alle Cards nutzen dieselben UI-Patterns
✅ **Testbar:** JSON Output ist deterministisch testbar

### Main Content Layout mit JSON Render

```tsx
// components/bids/facts-tab.tsx

export function FactsTab({ preQualificationId }: { preQualificationId: string }) {
  const { auditData, isLoading } = useAuditData(preQualificationId);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Alle Sections werden aus JSON Render generiert */}
      {auditData.sections.map(section => (
        <JsonRenderCard key={section.id} catalogName="audit-catalog" json={section} />
      ))}
    </div>
  );
}
```

**Integration mit Navigation:**

- Jede `<Card id="...">` hat eine ID aus dem JSON
- Sidebar Navigation nutzt diese IDs für Smooth Scroll
- Agent Output definiert welche Sections existieren → Navigation passt sich an

---

## Live-Update-Strategie

**Problem:** Research Agents laufen nacheinander, Sections werden progressiv verfügbar.
**Lösung:** Navigation und Cards werden dynamisch aktiviert, sobald Synthesizer erfolgreich war.

### States der Navigation-Items

```tsx
// Navigation Item States
type NavItemState =
  | 'locked'      // 🔒 Research Agents noch nicht fertig, keine Daten
  | 'generating'  // ⏳ Synthesizer läuft gerade
  | 'ready'       // ✅ Section verfügbar, kann angezeigt werden
  | 'error';      // ❌ Synthesizer fehlgeschlagen, Fallback zeigen

// Beispiel: Integrationen Section
{
  id: 'integrations',
  label: 'Integrationen',
  state: 'locked', // Initial
  requiredAgents: ['integrations-agent'],
  progress: 0,
}
```

### Progressive Activation Flow

```
Quick Scan startet
     ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Research Agents (0-90 Sekunden)                   │
└─────────────────────────────────────────────────────────────┘
     ↓
Navigation Agent fertig (10s)
  → "Website-Analyse" Navigation-Item: locked → generating
  → Website Analysis Synthesizer startet
  → "Website-Analyse" Navigation-Item: generating → ready ✅
  → Card wird gerendert
     ↓
TechStack Agent fertig (20s)
  → "Aktuelle Technologie" locked → generating
  → Tech Current Synthesizer startet
  → "Aktuelle Technologie" generating → ready ✅
  → Card wird gerendert
     ↓
Content Agent fertig (30s)
  → "CMS-Architektur" locked → generating (braucht auch TechStack)
  → CMS Architecture Synthesizer startet
  → "CMS-Architektur" generating → ready ✅
     ↓
... weitere Agents ...
     ↓
Alle 8 Research Agents fertig (90s)
  → "Übersicht" locked → generating
  → Overview Synthesizer startet (braucht ALLE Daten)
  → "Übersicht" generating → ready ✅

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: On-Demand Sections (sobald User navigiert)        │
└─────────────────────────────────────────────────────────────┘
     ↓
User klickt auf "CMS-Vergleich" (state: locked)
  → CMS Comparison Synthesizer startet (braucht TechStack)
  → state: generating
  → Dashboard Builder generiert JSON Render Spec
  → state: ready ✅
  → Card wird gerendert
```

### Sidebar Navigation mit Live States

```tsx
// components/audit/audit-sidebar-navigation.tsx

export function AuditSidebarNavigation({ preQualificationId }: { preQualificationId: string }) {
  const { navItems, researchStatus } = useAuditNavigation(preQualificationId);

  return (
    <Accordion type="multiple" defaultValue={['website', 'tech']}>
      {navItems.map(category => (
        <AccordionItem key={category.id} value={category.id}>
          <AccordionTrigger>
            <CategoryIcon state={category.state} />
            {category.label}
            {category.state === 'generating' && <Spinner className="ml-2" />}
            {category.state === 'locked' && (
              <Badge variant="outline" className="ml-2">
                {researchStatus[category.requiredAgents[0]]?.progress || 0}%
              </Badge>
            )}
          </AccordionTrigger>

          <AccordionContent>
            {category.items.map(item => (
              <NavLink
                key={item.id}
                to={item.id}
                label={item.label}
                state={item.state}
                disabled={item.state === 'locked'}
              />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
```

### NavLink mit State-Handling

```tsx
function NavLink({ to, label, state, disabled }: NavLinkProps) {
  const handleClick = () => {
    if (disabled) return;

    // Falls generating → zeige Loading State
    if (state === 'generating') {
      toast.info('Section wird gerade generiert...');
      return;
    }

    // Falls ready → scroll to card
    const element = document.getElementById(to);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.classList.add('highlight-pulse');
      setTimeout(() => element.classList.remove('highlight-pulse'), 2000);
    }

    // Falls locked → trigger Synthesizer (on-demand)
    if (state === 'locked') {
      triggerSynthesizer(to);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
        state === 'ready' && 'hover:bg-accent cursor-pointer',
        state === 'generating' && 'opacity-70 cursor-wait',
        state === 'locked' && 'opacity-50 cursor-not-allowed',
        state === 'error' && 'text-red-500'
      )}
    >
      {state === 'generating' && <Loader2 className="inline h-3 w-3 mr-2 animate-spin" />}
      {state === 'ready' && <CheckCircle className="inline h-3 w-3 mr-2 text-green-600" />}
      {state === 'locked' && <Lock className="inline h-3 w-3 mr-2" />}
      {state === 'error' && <AlertCircle className="inline h-3 w-3 mr-2" />}
      {label}
    </button>
  );
}
```

### Main Content mit Progressive Loading

```tsx
// components/bids/facts-tab.tsx

export function FactsTab({ preQualificationId }: { preQualificationId: string }) {
  const { sections, loading } = useAuditSections(preQualificationId);

  return (
    <div className="space-y-6">
      {sections.map(section => {
        // Section noch nicht verfügbar → Skeleton
        if (section.state === 'locked') {
          return <SectionSkeleton key={section.id} title={section.title} />;
        }

        // Section wird gerade generiert → Animated Skeleton
        if (section.state === 'generating') {
          return (
            <Card key={section.id} id={section.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {section.title}
                </CardTitle>
                <CardDescription>Wird generiert...</CardDescription>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          );
        }

        // Section fertig → JSON Render
        if (section.state === 'ready') {
          return (
            <JsonRenderCard
              key={section.id}
              catalogName="audit-catalog"
              json={section.renderSpec}
            />
          );
        }

        // Section fehlgeschlagen → Error State
        if (section.state === 'error') {
          return (
            <Card key={section.id} id={section.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertDescription>
                    Section konnte nicht generiert werden. {section.error}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          );
        }
      })}
    </div>
  );
}
```

### Vorteile Progressive Loading

✅ **Sofortiges Feedback** - User sieht Fortschritt in Echtzeit
✅ **Keine Wartezeit** - Erste Sections verfügbar während andere noch generieren
✅ **On-Demand Generation** - Teure Sections (CMS-Vergleich) nur wenn User sie öffnet
✅ **Fehler-Resilience** - Eine fehlende Section blockiert nicht den Rest
✅ **Transparenz** - User sieht genau, welche Agents fertig sind

---

## Technische Implementierung

### Component-Struktur

```tsx
// components/quick-scan/audit-sidebar-navigation.tsx

export function AuditSidebarNavigation({ preQualificationId }: { preQualificationId: string }) {
  return (
    <aside className="w-80 space-y-4 sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
      {/* 1. Dokumente (bestehend) */}
      <DocumentsSidebar bidId={preQualificationId} />

      {/* 2. Deliverables (verschoben) */}
      <DeliverablesSidebarCard preQualificationId={preQualificationId} />

      {/* 3. Research Status */}
      <ResearchStatusCard preQualificationId={preQualificationId} />

      {/* 4. Audit Navigation */}
      <AuditNavigationAccordion preQualificationId={preQualificationId} />
    </aside>
  );
}
```

### Accordion-Navigation Component (Vollständig)

```tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  FileText,
  Monitor,
  Globe,
  Building,
  Scale,
  Cloud,
  Plug,
  Rocket,
  Users,
  DollarSign,
  CheckCircle,
  List,
} from 'lucide-react';

export function AuditNavigationAccordion({ preQualificationId }: { preQualificationId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Audit-Navigation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion
          type="multiple"
          defaultValue={['overview', 'tech-current', 'website', 'integrations', 'migration']}
        >
          {/* 1. Übersicht */}
          <AccordionItem value="overview">
            <AccordionTrigger>
              <List className="h-4 w-4 mr-2" />
              Übersicht
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="executive-summary" label="Executive Summary" />
              <NavLink to="detailed-summary" label="Detaillierte Zusammenfassung" />
            </AccordionContent>
          </AccordionItem>

          {/* 2. Aktuelle Technologie */}
          <AccordionItem value="tech-current">
            <AccordionTrigger>
              <Monitor className="h-4 w-4 mr-2" />
              Aktuelle Technologie
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="cms-framework" label="CMS & Framework" />
              <NavLink to="server-infrastructure" label="Server & Infrastruktur" />
            </AccordionContent>
          </AccordionItem>

          {/* 3. Website-Analyse */}
          <AccordionItem value="website">
            <AccordionTrigger>
              <Globe className="h-4 w-4 mr-2" />
              Website-Analyse
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="navigation-structure" label="Navigationsstruktur" />
              <NavLink to="content-volume" label="Content-Volumen" />
              <NavLink to="performance" label="Performance" />
              <NavLink to="accessibility" label="Accessibility" />
            </AccordionContent>
          </AccordionItem>

          {/* 4. CMS-Architektur */}
          <AccordionItem value="cms-architecture">
            <AccordionTrigger>
              <Building className="h-4 w-4 mr-2" />
              CMS-Architektur
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="content-types" label="Content-Typen & Struktur" />
              <NavLink to="taxonomies" label="Taxonomien & Kategorien" />
              <NavLink to="multilingual" label="Mehrsprachigkeit" />
              <NavLink to="permissions" label="Berechtigungskonzept" />
            </AccordionContent>
          </AccordionItem>

          {/* 5. CMS-Vergleich */}
          <AccordionItem value="cms-comparison">
            <AccordionTrigger>
              <Scale className="h-4 w-4 mr-2" />
              CMS-Vergleich
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="drupal-cms" label="Drupal CMS 2.0" />
              <NavLink to="magnolia" label="Magnolia" />
              <NavLink to="ibexa" label="Ibexa" />
              <NavLink to="feature-matrix" label="Feature-Matrix" />
            </AccordionContent>
          </AccordionItem>

          {/* 6. Hosting & Infrastruktur */}
          <AccordionItem value="hosting">
            <AccordionTrigger>
              <Cloud className="h-4 w-4 mr-2" />
              Hosting & Infrastruktur
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="server-setup" label="Server-Setup" />
              <NavLink to="devops" label="DevOps & Deployment" />
            </AccordionContent>
          </AccordionItem>

          {/* 7. Integrationen */}
          <AccordionItem value="integrations">
            <AccordionTrigger>
              <Plug className="h-4 w-4 mr-2" />
              Integrationen
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="sso" label="Single Sign-On (SSO)" />
              <NavLink to="search" label="Suchfunktionalität" />
              <NavLink to="media-management" label="Media Management" />
              <NavLink to="e-commerce" label="E-Commerce" />
              <NavLink to="newsletter" label="Newsletter" />
              <NavLink to="analytics" label="Analytics" />
              <NavLink to="third-party" label="Third-Party Services" />
            </AccordionContent>
          </AccordionItem>

          {/* 8. Migration & Projekt */}
          <AccordionItem value="migration">
            <AccordionTrigger>
              <Rocket className="h-4 w-4 mr-2" />
              Migration & Projekt
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="migration-strategy" label="Migrations-Strategie" />
              <NavLink to="effort-estimation" label="Aufwandsschätzung" />
              <NavLink to="project-timeline" label="Projekt-Timeline" />
            </AccordionContent>
          </AccordionItem>

          {/* 9. Projekt-Organisation */}
          <AccordionItem value="project-org">
            <AccordionTrigger>
              <Users className="h-4 w-4 mr-2" />
              Projekt-Organisation
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="team-structure" label="Team-Struktur" />
              <NavLink to="deliverables-link" label="Deliverables" external />
            </AccordionContent>
          </AccordionItem>

          {/* 10. Kosten & Budget */}
          <AccordionItem value="costs">
            <AccordionTrigger>
              <DollarSign className="h-4 w-4 mr-2" />
              Kosten & Budget
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="cost-breakdown" label="Kostenaufstellung" />
              <NavLink to="license-costs" label="Lizenzkosten" />
              <NavLink to="budget-hints" label="Budget-Hinweise aus RFP" />
            </AccordionContent>
          </AccordionItem>

          {/* 11. Empfehlung */}
          <AccordionItem value="recommendation">
            <AccordionTrigger>
              <CheckCircle className="h-4 w-4 mr-2" />
              Empfehlung
            </AccordionTrigger>
            <AccordionContent>
              <NavLink to="final-recommendation" label="Zusammenfassung & Empfehlung" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
```

### NavLink Component mit Smooth Scroll

```tsx
function NavLink({ to, label, external }: { to: string; label: string; external?: boolean }) {
  const handleClick = () => {
    const element = document.getElementById(to);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Highlight effect
      element.classList.add('highlight-pulse');
      setTimeout(() => element.classList.remove('highlight-pulse'), 2000);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
    >
      {label}
      {external && <ExternalLink className="inline h-3 w-3 ml-1" />}
    </button>
  );
}
```

---

## Main Content Area Anpassungen

Damit die Navigation funktioniert, brauchen alle Cards im Main Content eine **ID**:

```tsx
// components/bids/facts-tab.tsx

<Card id="navigation">
  <CardHeader>
    <CardTitle>Navigationsstruktur</CardTitle>
  </CardHeader>
  {/* ... */}
</Card>

<Card id="tech-stack">
  <CardHeader>
    <CardTitle>Tech Stack</CardTitle>
  </CardHeader>
  {/* ... */}
</Card>

<Card id="timeline">
  <CardHeader>
    <CardTitle>Timeline & Deadlines</CardTitle>
  </CardHeader>
  {/* ... */}
</Card>

// etc.
```

### Highlight-Effekt CSS

```css
/* global.css */
@keyframes highlight-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  50% {
    box-shadow: 0 0 0 12px rgba(59, 130, 246, 0);
  }
}

.highlight-pulse {
  animation: highlight-pulse 2s ease-in-out;
}
```

---

## Responsive Behavior

### Desktop (>= 1024px)

- Sidebar rechts, sticky, 320px breit
- Main Content nimmt Rest

### Tablet (768px - 1023px)

- Sidebar wird zu Top-Navigation (Horizontal Tabs)
- Audit-Navigation in Dropdown

### Mobile (< 768px)

- Sidebar verschwindet komplett
- Audit-Navigation in Hamburger-Menu
- Research Status als Badge im Header

---

## Vorteile dieser Struktur

✅ **Kompakt:** Max 3 Ebenen, passt in Sidebar
✅ **Fokussiert:** Nur die 3 gewählten Bereiche (Technologie, RFP, Content)
✅ **Schnell:** Click → Smooth Scroll zu Card
✅ **Context-Aware:** Deliverables + Research Status immer sichtbar
✅ **Erweiterbar:** Insights-Section für zukünftige Features
✅ **ShadCN Native:** Accordion, Card, Badge – alles vorhanden

---

## Alternative: Tabs statt Accordion

Falls Accordion zu eng wirkt, **Tabs-Variante**:

```tsx
<Tabs defaultValue="website">
  <TabsList>
    <TabsTrigger value="website">Website</TabsTrigger>
    <TabsTrigger value="tech">Tech</TabsTrigger>
    <TabsTrigger value="preQualification">RFP</TabsTrigger>
  </TabsList>

  <TabsContent value="website">
    <NavLink to="navigation" label="Navigationsstruktur" />
    {/* ... */}
  </TabsContent>

  <TabsContent value="tech">
    <NavLink to="tech-stack" label="Tech Stack" />
    {/* ... */}
  </TabsContent>

  <TabsContent value="preQualification">
    <NavLink to="timeline" label="Timeline" />
    {/* ... */}
  </TabsContent>
</Tabs>
```

**Trade-off:**

- ✅ Weniger Scrolling nötig
- ❌ Nicht alle Sections gleichzeitig sichtbar

---

## Welche Variante bevorzugst du?

1. **Accordion** (alle Sections gleichzeitig sichtbar, scrollbar)
2. **Tabs** (nur eine Section aktiv, weniger Scrolling)
3. **Hybrid** (Research Status + Deliverables sticky oben, Audit-Navigation als Tabs darunter)
