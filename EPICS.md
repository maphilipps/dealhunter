# Dealhunter - Feature Epics & Anforderungen

**Kern-Workflow:** Anforderung hochladen → AI-Extraktion → Bit/No Bit Entscheidung → Routing an Bereichsleiter → Erweiterte Auswertung → Team zusammenstellen → Team per E-Mail benachrichtigen

---

## EPIC-001: Smart Upload & AI-Extraktion

### Anforderungen

**Input-Formate:**
- PDF (Ausschreibungen, RFPs, RFIs)
- CRM-Export (HubSpot, Salesforce)
- Freie Textbeschreibung
- E-Mail-Weiterleitungen

**DSGVO Document Cleaning (Optional):**
- User kann vor Verarbeitung "Dokument bereinigen" aktivieren
- AI identifiziert und entfernt/anonymisiert PII (Namen, E-Mails, Telefon, Adressen)
- User reviewed Vorschläge und kann einzelne Items behalten
- Audit Trail: Nur bereinigtes Dokument + Cleaning-Log gespeichert (kein Original)

**AI-Extraktion:**
- Strukturierte Extraktion: customerName, projectDescription, technologies, budget, timeline, scope, keyRequirements
- Confidence Score (0-100) für Qualitätsbewertung
- User kann extrahierte Daten bestätigen/korrigieren
- Source-Tracking (pdf/crm/freetext/email)

**User Stories:**
- Als BD Manager möchte ich Anforderungen in beliebigem Format hochladen
- Als BD Manager möchte ich die extrahierten Daten prüfen und korrigieren können
- Als BD Manager möchte ich optional PII vor der Verarbeitung entfernen

---

## EPIC-002: Bit/No Bit Entscheidung

### Anforderungen

**Multi-Agent Evaluation System:**
- **Tech Agent**: Tech-Anforderungen vs. adesso-Kompetenzen, Komplexität, Skills
- **Legal Agent**: Vertragsrisiken, Haftung, Compliance (BD-Level: Quick Check)
- **Commercial Agent**: Budget, Marge, Wirtschaftlichkeit, Timeline
- **Organizational Agent**: Kapazität, Team, Timeline-Realisierbarkeit
- **Competition Agent**: Bekannte Mitbieter, Win-Wahrscheinlichkeit
- **Coordinator Agent**: Synthese aller Ergebnisse, finale Empfehlung

**Vertragstyp-Erkennung & Risikobewertung:**
- Automatische Erkennung: EVB-IT, Werkvertrag, Dienstvertrag, Rahmenvertrag, SLA
- Risk Level: low/medium/high
- Risk Factors identifizieren (Haftung, Pönalen, IP-Klauseln)
- Recommendations für Risikominimierung

**Zuschlagskriterien Analysis:**
- Preis-/Qualitätsgewichtung extrahieren
- adesso Strengths gegen Kriterien matchen
- Overall Fit Assessment (excellent/good/moderate/poor)

**Red Flag Detection:**
- Budget Red Flags (50% unter Marktdurchschnitt)
- Timeline Red Flags (unrealistische Deadlines)
- Legal Red Flags (unbegrenzte Haftung)
- Technical Red Flags (Legacy-Integration ohne API)
- Severity: critical/warning/info

**Multi-Dimensionales Risk Assessment:**
- Technical, Legal, Commercial, Organizational, Timeline Risks
- Overall Severity pro Dimension
- Mitigation Vorschläge

**Entscheidungsbaum-Visualisierung:**
- Interaktiver Baum mit allen Faktoren
- Klickbare Nodes mit Details
- Pro/Contra-Argumente visuell aufbereitet
- Farbcodierung (grün=positiv, rot=negativ, gelb=neutral)

**Output:**
- Decision: 'bit' | 'no_bit'
- Confidence Score (0-100)
- Reasoning (ausführliche Begründung)
- Decision Tree
- Risk Assessment
- Award Criteria Fit
- Contract Analysis
- Red Flags
- Alternative Recommendation (bei No Bit)

**Low Confidence Handling:**
- Warning bei Confidence < 70%
- User-Bestätigung erforderlich
- Audit Trail für Override

**User Stories:**
- Als BD Manager möchte ich eine fundierte Bit/No Bit Empfehlung erhalten
- Als BD Manager möchte ich alle Risiken und Red Flags sehen
- Als BD Manager möchte ich bei No Bit eine Alternative Empfehlung erhalten
- Als BD Manager möchte ich bei unsicheren Entscheidungen gewarnt werden

---

## EPIC-003: Company Analysis (Two-Phase)

### Phase 1: Quick Scan (für BD, während Bit/No Bit)

**Anforderungen:**
- **Tech Stack Detection**: CMS, Frameworks, Hosting, Libraries identifizieren
- **Content Volume**: Sitemap analysieren, Seitenanzahl, URL-Patterns
- **Features & Integrations**: Formulare, Suche, APIs, E-Commerce, User Accounts
- **BL Recommendation**: AI-basiert, mit Confidence Score und Reasoning

**Output:**
- Tech Stack (CMS, Framework, Hosting)
- Content Volume (Total Pages, Pages by Type)
- Features (Forms, Integrations, E-Commerce, User Accounts)
- BL Recommendation (recommended BL, confidence, reasoning, matched technologies)

**Performance:** 2-5 Minuten

### Phase 2: Deep Migration Analysis (für BL, nach Assignment)

**Anforderungen:**
- **Content Architecture Mapping**: Page Types → Content Types, Components → Paragraphs
- **Migration Complexity**: Export-Capability, Datenqualität, Cleanup-Aufwand
- **Accessibility Audit**: WCAG 2.1 Level AA Prüfung, Remediation Effort
- **PT-Schätzung**: Basierend auf Entity-Counts und CMS-Baseline (adessoCMS: 693h)

**Output:**
- Content Architecture (Page Types, Components, Taxonomies, Media Types)
- Migration Complexity (Export Capability, Data Quality, Estimated Nodes, Complexity Score)
- Accessibility (WCAG Level, Issue Count by Severity, Remediation Effort)
- Estimation (Total Hours, Breakdown, Confidence Level, Assumptions, Risks)

**Trigger:** Automatisch nach Bit + BL-Assignment (Background Job)
**Performance:** 10-30 Minuten
**Notification:** BL wird benachrichtigt bei Completion

**BL-Spezifisch:**
- CMS-Auswahl basierend auf BL (PHP → Drupal/Sulu, WEM → Ibexa/Magnolia)
- BL kann Ziel-CMS ändern und Re-Analysis triggern

**User Stories:**
- Als BD Manager möchte ich Quick Scan Ergebnisse für Bit-Entscheidung nutzen
- Als BL möchte ich detaillierte Migration Analysis für PT-Schätzung
- Als BL möchte ich das Ziel-CMS wählen können

---

## EPIC-004: BL-Routing & Team Assignment

### BL-Routing

**Anforderungen:**
- **AI-basierte BL-Empfehlung**: Basierend auf Quick Scan Tech Stack
- **BD Override**: BD kann anderen BL wählen mit Begründung (Audit Trail)
- **BL Notification**: E-Mail an BL Leader bei Assignment

**Routing-Logik:**
1. AI analysiert Quick Scan Ergebnisse
2. NLP-Match zu Business Lines (Keywords, Technologies)
3. Confidence Score und Matched Technologies
4. BD kann Empfehlung akzeptieren oder überschreiben

### Erweiterte Auswertung (für BL)

**Anforderungen:**
- **Szenario-basierte Kalkulation**: Best/Expected/Worst Case
- **Skill Gaps**: Required Skills vs. Available Employees
- **PT-Estimation**: Aus Deep Migration Analysis
- **Interaktive Exploration**: Drill-Down in Details, Filter nach Skills/Verfügbarkeit

**Financial Projections:**
- Revenue, Costs, Margin, Margin % pro Szenario
- Risk Factors pro Szenario

### Team Assignment

**Anforderungen:**
- **AI-Vorschlag**: Optimales Team basierend auf Skills, Verfügbarkeit, Erfahrung
- **Feste Rollen**: Project Manager, Architect, Lead Developer, Developer, Consultant, Analyst, QA Engineer
- **Team-Größe**: 2-15+ Personen (variabel)
- **BL Override**: BL kann Team modifizieren
- **Skill Gap Handling**: Warnung bei fehlenden Skills, Best Available Alternatives

**User Stories:**
- Als BL möchte ich automatisch über neue Opportunities informiert werden
- Als BL möchte ich Szenario-basierte Kalkulationen sehen
- Als BL möchte ich AI-Vorschlag für optimales Team erhalten
- Als BL möchte ich das Team bei Bedarf anpassen können

---

## EPIC-005: Benachrichtigungs-System

### Anforderungen

**Team-Benachrichtigung per E-Mail:**
- E-Mail an jedes Team-Mitglied
- Subject: [Dealhunter] Angebotsteam für {CustomerName}
- Body: Rolle, BL-Signature, Link zu Details
- PDF-Attachment mit Projekt-Infos

**PDF-Content:**
- Kundenname & Kontakt
- Projekt-Beschreibung
- Scope & Requirements
- Timeline
- Team-Zusammensetzung
- Nächste Schritte

**BL-Benachrichtigung:**
- E-Mail bei Deep Analysis Completion
- In-App Notification Badge

**Tracking:**
- `teamNotifiedAt` Timestamp
- `assignedBLNotifiedAt` Timestamp
- Status: 'notified' nach Benachrichtigung
- Final Status: 'handed_off' nach vollständiger Übergabe

**User Stories:**
- Als BL möchte ich das Team per Knopfdruck benachrichtigen
- Als Team-Mitglied möchte ich alle Projekt-Infos per E-Mail + PDF erhalten
- Als BL möchte ich benachrichtigt werden, wenn Deep Analysis fertig ist

---

## EPIC-006: Master Data Management

### Anforderungen

**Referenzen (Zentrale Datenbank):**
- Vergangene Projekte dokumentieren (Name, Customer, Industry, Technologies, Scope, Team Size, Budget, Outcome)
- Highlights und Contact Person
- Jeder BD kann hinzufügen, Admin validiert
- Auto-Matching zu neuen Opportunities (Match Score, Matched Criteria)

**Kompetenzen (Zentrale Datenbank):**
- Technologies, Methodologies, Industries, Soft Skills
- Level: basic/advanced/expert
- Experts zuordnen (Employee IDs)
- Certifications tracken
- Jeder BD kann hinzufügen, Admin validiert
- Auto-Matching zu Requirements (Available/Gap)

**Wettbewerber (Zentrale Datenbank):**
- Strengths/Weaknesses dokumentieren
- Technologies und Industries
- Price Level (low/medium/high)
- Recent Encounters tracken (won_against/lost_to)
- Jeder BD kann hinzufügen, Admin validiert
- Auto-Matching zu Opportunities (Likelihood, Counter-Strategy)

**Validation Workflow:**
- BD erstellt Entry (createdBy, validatedBy=null)
- Admin reviewed und validiert (validatedBy, validatedAt)
- Nur validierte Entries für Auto-Matching

**User Stories:**
- Als BD möchte ich Referenzen, Kompetenzen, Wettbewerber dokumentieren
- Als Admin möchte ich Einträge validieren
- Als System möchte ich automatisch passende Referenzen/Kompetenzen/Wettbewerber finden

---

## EPIC-007: Legal Agent & Compliance

### Anforderungen

**Two-Level Approach:**
- **BD-Level (Quick Check)**: Kritische Red Flags (Haftung, Pönalen, IP)
- **BL-Level (Comprehensive)**: Vollständige Vertragsprüfung nach Assignment

**BD-Level (während Bit Evaluation):**
- Critical Flags identifizieren (liability, penalty, ip, warranty, termination, jurisdiction)
- Severity: critical/warning
- Compliance Hints geben
- Requires Detailed Review Flag setzen

**BL-Level (nach Assignment):**
- **Procurement Law**: VoB, VgV, UVgO, EU Threshold Detection
- **Requirements & Deadlines**: Extrahieren und listen
- **Framework Agreements**: Detect, Identify existing, Extract call-off rules
- **Subcontractor Rules**: Allowed/Restricted, Reporting Requirements

**Contract Analysis:**
- Contract Type Detection (EVB-IT, Werkvertrag, Dienstvertrag, Rahmenvertrag, SLA)
- Risk Level Assessment
- Risk Factors identifizieren
- Recommendations für Risikominimierung

**Red Flags als informativ (nicht blockierend):**
- Red Flags prominent anzeigen
- BD kann trotzdem mit Bit fortfahren
- Red Flags in Coordinator Synthesis einbeziehen

**User Stories:**
- Als BD möchte ich kritische Legal Red Flags sehen
- Als BL möchte ich umfassende Legal Review nach Assignment
- Als BL möchte ich Compliance-Anforderungen (Vergaberecht, Rahmenverträge) verstehen

---

## EPIC-008: Agent Native Transparency

### Anforderungen

**Full Chain-of-Thought Display:**
- Jeder Agent-Schritt sichtbar für User
- Thoughts, Tool Calls, Tool Results, Decisions

**Real-time Agent Activity Stream:**
- Live-Updates während AI-Operationen
- Timestamp, Agent Name, Activity Type
- Thought Bubbles (expandable für Details)

**Confidence Indicators:**
- Color-coded: Green (80-100%), Yellow (60-79%), Red (<60%)
- Tooltip mit Explanation
- Warning bei Medium/Low Confidence

**Abort-Mechanismus:**
- "Abbrechen" Button während Agent Operations
- Graceful Shutdown (laufende Tool Calls beenden)
- Partial Results erhalten
- Re-Start möglich

**Multi-Agent Progress:**
- 2x2 Grid für parallel laufende Agents
- Status Indicators pro Agent
- Overall Progress Bar

**No Live-Steering:**
- User kann nicht während Execution umlenken
- Stattdessen: Abbrechen → Anpassen → Neu starten

**User Stories:**
- Als User möchte ich sehen, was die AI gerade tut
- Als User möchte ich die Reasoning nachvollziehen können
- Als User möchte ich bei Bedarf eine Operation abbrechen

---

## EPIC-009: Dashboard & Analytics

### Dashboard

**BD Manager View:**
- **Pipeline Overview**: Alle Bids mit Status
- **Quick Stats**: Bit Rate, Offene Evaluierungen, Zugewiesene Teams
- **Deadline Tracking**: Anstehende Deadlines sichtbar
- **Filters**: Status, Datum, BL, Source, Account
- **Account-basierte Ansicht**: Opportunities gruppiert nach Customer/Account

**BL View:**
- **Inbox**: Assigned Opportunities mit Status
- **Status Indicators**: "Deep Analysis läuft...", "Bereit zur Prüfung"
- **Newest First**: Sortierung nach Datum

### Analytics

**Anforderungen:**
- **Bit/No Bit Rate**: Pie Chart mit Percentages
- **Distribution by BL**: Bar Chart mit Opportunity Count pro BL
- **Pipeline Funnel**: Draft → Bit → Assigned → Notified (Conversion Rates)
- **Time to Decision**: Average Time von Upload zu Bit Decision (Trend Line)
- **Source Distribution**: Reactive vs Proactive (Pie Chart)
- **Stage Distribution**: Cold/Warm/RFP (Pie Chart)
- **Date Range Selector**: Filtering für alle Charts

**User Stories:**
- Als BD Manager möchte ich den kompletten Pipeline-Status sehen
- Als BL möchte ich meine assigned Opportunities in einer Inbox sehen
- Als Admin möchte ich Analytics über Bit/No Bit Entscheidungen sehen

---

## EPIC-010: Admin Panel

### Anforderungen

**Business Lines CRUD:**
- Name, Leader Name, Leader Email
- Technologies zuordnen
- Keywords für NLP-Matching
- Active/Inactive Status

**Technologies CRUD:**
- Name (Drupal, Ibexa, Magnolia, etc.)
- Business Line Reference
- Baseline Hours (z.B. 693 für adessoCMS)
- Baseline Name
- Baseline Entity Counts (Content Types, Paragraphs, Views, Config Files)
- Default Flag (Standard-Ziel für BL)

**Employees CRUD:**
- Name, Email
- Business Line
- Skills (Array)
- Roles (Array of TeamRole)
- Availability Status (available/on_project/unavailable)
- Bulk Import via CSV

**Master Data Validation:**
- Referenzen, Kompetenzen, Wettbewerber validieren
- Pending List (validatedBy = null)
- Validate Button → validatedBy, validatedAt setzen

**Audit Trail Viewer:**
- Liste aller AuditTrailEntry Records
- Filter nach Action Type (bl_override, bit_override, team_change, status_change)
- User, Timestamp, Previous/New Value, Reason anzeigen

**User Management:**
- User einladen mit E-Mail und Rolle
- Invitation E-Mail senden
- Registration mit preset Role

**User Stories:**
- Als Admin möchte ich Business Lines und Technologies verwalten
- Als Admin möchte ich Employees mit Skills anlegen
- Als Admin möchte ich Master Data validieren
- Als Admin möchte ich Audit Trail für Overrides einsehen

---

## Account Management (EPIC-011)

### Anforderungen

**Account CRUD:**
- Name, Industry, Website, Notes
- Opportunities Array (BidOpportunity IDs)

**Account Assignment:**
- Bei Upload: Opportunity einem Account zuordnen (neu oder bestehend)
- Account Selector mit Search

**Account-basierte Dashboard-Ansicht:**
- Opportunities gruppiert nach Account
- Account Summary (Opportunity Count)
- Expand/Collapse per Account

**Account Detail Page:**
- Account Info anzeigen
- Alle linked Opportunities listen
- Opportunity Statuses
- Historical Data
- Link zu "New Opportunity for Account"

**User Stories:**
- Als BD Manager möchte ich Opportunities Kunden zuordnen
- Als BD Manager möchte ich alle Opportunities eines Kunden sehen
- Als BD Manager möchte ich Dashboard nach Accounts gruppieren

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Smart Upload Processing | < 30 sec |
| AI Extraction | < 60 sec |
| Quick Scan (Phase 1) | 2-5 min |
| Bit/No Bit Decision | 5-15 min |
| Deep Migration Analysis (Phase 2) | 10-30 min (Background) |
| Extended Evaluation | < 2 min |
| Team Notification | < 30 sec |

---

## Success Criteria (MVP)

- ✅ BD kann Anforderungen in beliebigem Format hochladen
- ✅ Bit/No Bit Entscheidung in 10-30 Minuten
- ✅ Automatisches Routing an korrekten Bereichsleiter
- ✅ BL erhält Szenario-basierte Wirtschaftlichkeitsanalyse
- ✅ AI schlägt optimales Team vor
- ✅ Team wird automatisch per E-Mail benachrichtigt
- ✅ BD hat volle Transparenz über Pipeline-Status
- ✅ Analytics Dashboard für Management

---

## Non-Goals (MVP)

- ❌ Learning/Feedback-Loop (System lernt nicht aus Outcomes)
- ❌ Mobile-Optimierung (Desktop Only)
- ❌ Multi-BL Deals (Joint Bids)
- ❌ Post-Handoff Tracking (Won/Lost Details)
- ❌ Slide Deck Generation (nur PDF)
- ❌ Ablehnung durch Team-Mitglieder
- ❌ Granularer Agent Re-Run (einzelne Agents wiederholen)

---

**Last Updated**: 2026-01-16
**Version**: 1.2.0-mvp
