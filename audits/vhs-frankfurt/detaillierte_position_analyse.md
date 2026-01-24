# Detaillierte Position-für-Position Analyse
## VHS Frankfurt Webinfrastruktur - Ausschreibung vs. adesso

**Projekt:** Neuentwicklung der Webinfrastruktur der VHS Frankfurt
**Auftraggeber:** Stadt Frankfurt am Main
**Ausschreibungs-Nummer:** 43-2025-00015
**Abgabefrist:** 03.02.2026
**Datum:** 2026-01-08

---

## Berechnungsmethodik

### Formel für optimierten Tagessatz:

```
Optimierter_TS = (Realistischer_Aufwand_PT × gewählter_TS) / Ausschreibung_PT
```

**Beispiel:**
- Ausschreibung: 6 PT
- Realistischer Aufwand (adessoCMS + KI): 4 PT
- Gewählter Tagessatz: €850

```
Optimierter_TS = (4 × 850) / 6 = €566,67
```

**Interpretation:** Wir können zum effektiven Preis von €566,67/Tag arbeiten und trotzdem das Budget erfüllen.

---

## Tagessatz-Szenarien im Überblick

Für jede Position berechnen wir 4 Szenarien basierend auf dem **gewünschten effektiven Tagessatz** (was wir verdienen wollen):

| Szenario | Effektiver Tagessatz | Zielgruppe |
|----------|-----------|------------|
| **A** | **€850** | Konservativ (Marktüblich Drupal) |
| **B** | **€900** | Standard (Senior Drupal Developer) |
| **C** | **€950** | Gehoben (Spezialist + adessoCMS-Plattform) |
| **D** | **€1.000** | Premium (Expert + Innovation) |

**Angebots-Tagessatz** wird berechnet als: `(Realer Aufwand × Effektiver TS) / Ausschreibungs-PT`

Dadurch können wir **niedriger anbieten** und trotzdem den **gewünschten Tagessatz verdienen**.

---

## Position 1.1: Kick-off

### Ausschreibungs-Vorgabe

**Umfang:** 6 Arbeitstage á 8 Stunden = **48 Stunden**
**Beschreibung (Originaltext):**
- Kick-off Workshop mit allen Projektbeteiligten inkl. Vor- und Nachbereitung
- Der Initialworkshop hat innerhalb von zwei Wochen nach Zuschlagserteilung durchgeführt werden
- Geschätzter Arbeitsumfang: ca. 6 Arbeitstage á 8 Stunden

### adessoCMS-Baseline: Was bringen wir mit?

✅ **Projekt-Management-Infrastruktur fertig konfiguriert:**
- **WARUM SPART DAS ZEIT:** Keine Projektsetup-Phase nötig, alle Tools sind pre-configured
- **WAS IST FERTIG:**
  - Jira-Board-Templates (Scrum + Kanban) mit Workflows für Drupal-Projekte
  - Confluence-Space mit ADR-Templates, Meeting-Protokollen, Dokumentationsstruktur
  - GitLab/GitHub-Repository-Templates (Branch-Protection, MR-Templates, Issue-Templates)
  - Slack/Teams-Channel-Struktur (Dev, PM, Client, Alerts)
- **OHNE ADESSOCMS:** Projektmanager müsste 0.5 PT Jira konfigurieren + 0.2 PT Confluence aufsetzen + 0.2 PT Git-Workflows definieren
- **EINSPARUNG: ~1 PT**
- **⚠️ WICHTIG:** Jira und Confluence müssen vom Client separat lizenziert und aufgesetzt werden (nicht in dieser Einsparung enthalten). Templates beschleunigen nur die Konfiguration!

✅ **Workshop-Templates & Best Practices:**
- **WARUM SPART DAS ZEIT:** Bewährte Kick-off-Struktur aus 50+ Drupal-Projekten
- **WAS IST FERTIG:**
  - Kick-off-Agenda-Template (Confluence) mit Zeitplan, Themenblöcken, Moderationshinweisen
  - Stakeholder-Analyse-Matrix (Power/Interest-Grid)
  - Technical-Setup-Checkliste (DDEV, CI/CD, Environments)
  - Onboarding-Dokumentation für neue Entwickler (README, Setup-Guide, Code-Standards)
- **OHNE ADESSOCMS:** PM erstellt Templates von Grund auf (~0.8 PT) + recherchiert Best Practices (~0.2 PT)
- **EINSPARUNG: ~1 PT** (Vorbereitung)

### KI-Einsparung: Was automatisiert KI?

✅ **Claude Code analysiert Lastenheft und generiert:**
- **Projekt-Roadmap:** Erste Version aus allen 22 Positionen + Dependencies + Meilensteine (0.2 PT gespart)
- **User-Story-Mapping:** Automatische Gruppierung nach Epics aus Ausschreibungstext (0.2 PT gespart)
- **Feature-Priorisierung:** MoSCoW-Analyse basierend auf Abhängigkeiten (0.1 PT gespart)
- **Risiko-Assessment:** Technische Risiken aus API-Integration, Payment, etc. identifizieren (0.2 PT gespart)
- **KONKRET:** `claude analyze requirements.pdf` → Strukturierte Roadmap in Mermaid-Format + Jira-Import-CSV
- **EINSPARUNG: ~0.8 PT** (Vorbereitungsphase)

✅ **KI erstellt Workshop-Material automatisch:**
- **Präsentations-Slides:** Projekt-Overview aus Lastenheft → PowerPoint (erste Version in 10 Min statt 0.4 PT)
- **Agenda-Struktur:** Optimaler Ablauf basierend auf Stakeholder-Count und Themen-Komplexität (30 Min statt 0.2 PT)
- **KONKRET:** `claude generate kickoff-presentation from requirements.pdf` → 25 Slides mit Projekt-Overview, Technologie-Stack, Timeline, Risikenmatlab
- **EINSPARUNG: ~0.6 PT**

✅ **KI dokumentiert Workshop automatisch:**
- **Meeting-Protokoll:** Transkript aus Audio/Video → Strukturiertes Protokoll mit Sections (Decisions, Action Items, Parking Lot)
- **Action-Items-Liste:** Automatische Extraktion mit Owner, Deadline, Priority
- **Entscheidungs-Dokumentation:** ADRs aus Meeting-Diskussionen generieren
- **KONKRET:** Upload Audio → `claude transcribe and summarize meeting.mp4` → Confluence-Ready-Markdown in 5 Min (statt 0.4 PT manuell)
- **EINSPARUNG: ~0.4 PT** (Nachbereitung)

**GESAMT KI-EINSPARUNG: ~1.7 PT** (aufgerundet auf 1 PT konservativ kalkuliert)

### Realistischer Aufwand (adessoCMS + KI)

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Vorbereitung** | 1.5 PT | 0.8 PT | Templates + KI-Agenda |
| **Workshop-Durchführung** | 2 PT | 2 PT | Bleibt manuell (Kommunikation) |
| **Nachbereitung** | 1.5 PT | 0.8 PT | KI-Protokoll + Templates |
| **Setup-Arbeiten** | 1 PT | 0.5 PT | Tooling bereits konfiguriert |
| **GESAMT** | **6 PT** | **4 PT** | **-33% (2 PT Einsparung)** |

**Realistischer Aufwand:** 4 PT = **4 PT**

### Tagessatz-Berechnung

| Szenario | Effektiver TS | Realer Aufwand | Effektive Kosten | Ausschreibung | Angebots-TS |
|----------|---------------|----------------|------------------|---------------|-------------|
| **A** | €850 | 4 PT | €3.400 | 6 PT | **€567** |
| **B** | €900 | 4 PT | €3.600 | 6 PT | **€600** |
| **C** | €950 | 4 PT | €3.800 | 6 PT | **€633** |
| **D** | €1.000 | 4 PT | €4.000 | 6 PT | **€667** |

**Beispiel Szenario C:** Wir bieten **€633/Tag** an, arbeiten aber nur 4 PT (statt 6 PT) und verdienen effektiv **€950/Tag**

**Empfehlung:** Szenario C (€950 effektiv) - Angebot €633/Tag ist wettbewerbsfähig

---

## Position 1.2: Layout

### Ausschreibungs-Vorgabe

**Umfang:** 16,8 Arbeitstage á 8 Stunden = **134,4 Stunden**
**Beschreibung (Originaltext):**
- Abstimmung und Erstellung des Designs der Website
- Erstellung eines Style-Guides
- Geschätzter Arbeitsumfang: ca. 16,8 Arbeitstage á 8 Stunden

### adessoCMS-Baseline: Was bringen wir mit?

✅ **[Tailwind CSS v4](https://tailwindcss.com/) Design System komplett fertig:**
- **WARUM SPART DAS ZEIT:** Design-System existiert bereits, muss nur an Corporate Design angepasst werden statt von Grund auf aufgebaut
- **WAS IST FERTIG:**
  - **Schrift-System:** Vordefinierte Größen und Gewichte für alle Überschriften, Body-Text und Labels - automatisch responsive
  - **Abstands-System:** Konsistente Standard-Abstände (z.B. für Padding, Margin) - sichert einheitliches Layout
  - **Farb-Palette:** Komplette Farbpalette mit Variationen für Primary, Secondary, Neutral und Status-Farben (Erfolg/Warnung/Fehler)
  - **Multi-Screen-Optimierung:** Automatische Anpassung für Handy, Tablet und Desktop
  - **Grid-Layout:** Flexibles Layout-System für flexible Content-Anordnung
  - **Einheitliche Effekte:** Konsistente Eckenradien und Schatteneffekte
- **OHNE ADESSOCMS:** Designer + Frontend-Dev erstellen Design-System von Grund auf (~5 PT Design + 2.5 PT Implementation)
- **EINSPARUNG: ~7.5 PT**

✅ **55 fertige [UI-Komponenten](https://www.drupal.org/docs/develop/theming-drupal/using-single-directory-components) (Drupal Single Directory Components):**
- **WARUM SPART DAS ZEIT:** Komponenten sind bereits gebaut, getestet und mit Dokumentation vorhanden
- **WAS IST FERTIG:**
  - **Header-Varianten:** 3 verschiedene Header-Designs (Standard, Transparent, Sticky) - komplett funktionstüchtig
  - **Footer-Komponenten:** 2 Footer-Designs für verschiedene Content-Strukturen
  - **Navigation:** 3 Navigations-Layouts (Standard, Mobil, Erweiterte Mega-Menu)
  - **Buttons:** 8 verschiedene Button-Stile für unterschiedliche Situationen (Normal, Highlight, Transparent, Danger, etc.)
  - **Cards:** 10 verschiedene Card-Layouts für flexibel strukturierte Inhalte
  - **Form-Elemente:** 15 verschiedene Formular-Komponenten (Text-Felder, Checkboxes, Radio-Buttons, Datumsauswahl, File-Upload, etc.)
  - Alle Komponenten vollständig dokumentiert und einsatzbereit
- **OHNE ADESSOCMS:** Frontend-Dev baut 55 Komponenten von Grund auf (~10 PT Implementation + 2.5 PT Dokumentation + 2.5 PT Testing)
- **EINSPARUNG: ~15 PT**

✅ **Einheitliche Design-Tokens (Schriften, Farben, Abstände, Effekte):**
- **WARUM SPART DAS ZEIT:** Alle Design-Entscheidungen sind bereits dokumentiert und wiederverwendbar statt dass jede Komponente einzeln gestaltet wird
- **WAS IST FERTIG:**
  - Konsistente Schrift-Größen und -Gewichte für alle Text-Elemente
  - Standardisierte Abstände (Padding, Margin) für einheitliches Layout
  - Vordefinierte Eckenradien und Schatteneffekte
  - Komplette Farb-Palette mit allen Variationen
- **OHNE ADESSOCMS:** Designer und Entwickler müssten diese Tokens von Hand dokumentieren und konfigurieren (~2 PT)
- **EINSPARUNG: ~2 PT**

**GESAMT BASELINE-EINSPARUNG: ~24.5 PT** (konservativ auf 7.5 PT heruntergerechnet für Custom-Anpassungen)

### KI-Einsparung: Was automatisiert KI?

✅ **KI konvertiert Designer-Layouts automatisch zu Code:**
- **Design-Export:** Automatische Extraktion von Farben, Schriften und Abstände aus Designer-Layouts (Figma)
- **Design-Tokens konfigurieren:** Automatische Erstellung von wiederverwendbaren Design-Einstellungen
- **Responsive-Optimierung:** Automatische Anpassung für Handy, Tablet und Desktop
- **Farb-Palette:** Automatische Generierung aller Farb-Variationen aus den Corporate Design Farben
- **KONKRET:** Designer erstellt Layout → KI konvertiert in 30 Min zu funktionsfähigem Code (statt 1 PT manuell)
- **EINSPARUNG: ~0.9 PT** (Design-to-Code)

✅ **KI generiert kompletten Style-Guide automatisch:**
- **Design-Dokumentation:** Automatische Erstellung einer umfassenden Dokumentation aller Design-Einstellungen
- **Komponenten-Katalog:** Automatische Visualisierung aller 55 UI-Komponenten mit Beispielen
- **Accessibility-Richtlinien:** Automatische Generierung von Barrierefreiheits-Checklisten für jede Komponente
- **Anwendungs-Beispiele:** Automatische Erstellung von Beispiel-Code für jeden Komponenten-Typ
- **KONKRET:** KI erstellt fertig formatierte Dokumentations-Website mit allen Komponenten in 30 Min (statt 1.5 PT manuell)
- **EINSPARUNG: ~1.4 PT** (Dokumentation)

✅ **KI beschleunigt Design-Iterationen massiv:**
- **Farb-Varianten:** Automatische Erstellung aller Farb-Variationen einer Farbe mit optimalen Kontrasten
- **Abstands-Vorschläge:** KI analysiert Design und schlägt konsistente, gut aussehende Abstände vor
- **Typografie-Anpassung:** Automatische Berechnung harmonischer Schrift-Größen-Staffelungen
- **neue Komponenten-Varianten:** "Erstelle roten Button für Warnung" → KI erstellt funktionstüchtige Komponente
- **KONKRET:** Neue Komponenten-Variante in 2 Min erstellen (statt 0.2 PT manuell)
- **EINSPARUNG: ~1.5 PT** (Iterationen)

**GESAMT KI-EINSPARUNG: ~3.8 PT** (Design-to-Code + Dokumentation + schnellere Iterationen)

### Realistischer Aufwand (adessoCMS + KI)

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Design-Konzept erstellen** | 3 PT | 2 PT | Basis vorhanden, nur Anpassung |
| **Design-System aufbauen** | 5 PT | 1 PT | Tailwind v4 fertig, nur customizing |
| **Komponenten designen** | 4 PT | 2 PT | 55 Komponenten vorhanden, nur Styling |
| **Style-Guide erstellen** | 3 PT | 1 PT | KI generiert aus Code |
| **Abstimmungen** | 1.8 PT | 2 PT | Bleibt manuell (mehr Feedback-Loops) |
| **GESAMT** | **16.8 PT** | **8 PT** | **-52% (8.8 PT Einsparung)** |

**Realistischer Aufwand:** 8 PT = **8 PT**

### Tagessatz-Berechnung

| Szenario | Effektiver TS | Realer Aufwand | Effektive Kosten | Ausschreibung | Angebots-TS |
|----------|---------------|----------------|------------------|---------------|-------------|
| **A** | €850 | 8 PT | €6.800 | 16,8 PT | **€405** |
| **B** | €900 | 8 PT | €7.200 | 16,8 PT | **€429** |
| **C** | €950 | 8 PT | €7.600 | 16,8 PT | **€452** |
| **D** | €1.000 | 8 PT | €8.000 | 16,8 PT | **€476** |

**Beispiel Szenario C:** Wir bieten **€452/Tag** an, arbeiten aber nur 8 PT (statt 16,8 PT) und verdienen effektiv **€950/Tag**

**Empfehlung:** Szenario C (€950 effektiv) - Angebot €452/Tag ist sehr wettbewerbsfähig für Design-Arbeit

---

## Position 1.3: Setup, Konzeption und Projektleitung

### Ausschreibungs-Vorgabe

**Umfang:** 109 Arbeitstage á 8 Stunden = **872 Stunden**
**Beschreibung (Originaltext):**

**Projektsetup:**
- Erstellung der Projektstruktur
- Einrichtung der genutzten Projekttools
- Anlegen von Repositories in Versionsverwaltungssystem
- Konfiguration von CI/CD-Pipelines
- Automatisierte Tests, Builds und Deployments

**Konzeption & Dokumentation:**
- Konzeption und Dokumentation der einzelnen Features im Rahmen der Entwicklungsphasen

**QA & Testing:**
- Funktionale Tests
- Automatisierte Tests (Unit-Tests, End-to-end Tests)

**Projektleitung:**
- Bereitstellung eines Projektleiters während der gesamten Projektlaufzeit

**Benutzerschulung:**
- Schulung der System-Nutzer
- Erstellung von Schulungsmaterial
- Benutzerdokumentation

**Geschätzter Arbeitsumfang:** ca. 109 Arbeitstage á 8 Stunden

### Breakdown der 109 PT:

| Bereich | Geschätzte PT | Stunden |
|---------|---------------|---------|
| Projektsetup | 10 PT | 10 PT |
| Konzeption & Dokumentation | 20 PT | 20 PT |
| QA & Testing | 30 PT | 30 PT |
| Projektleitung (22 Monate) | 40 PT | 40 PT |
| Benutzerschulung | 9 PT | 9 PT |
| **GESAMT** | **109 PT** | **109 PT** |

---

### Bereich 1: Projektsetup (Ausschreibung: 10 PT = 10 PT)

#### adessoCMS-Baseline: Was bringen wir mit?

✅ **Automatisierte Build- und Deployment-Pipeline komplett vorkonfiguriert:**
- **WARUM SPART DAS ZEIT:** Automatisiertes System zur Code-Qualitätsprüfung ist ready-to-use, nur Zugangsdaten anpassen
- **WAS IST FERTIG:**
  - **Automatischer Build-Prozess:** Abhängigkeiten installieren, Assets optimieren (vollautomatisch)
  - **Automatische Code-Qualitätsprüfung:** Prüfung auf Programmierfehler, Code-Stil, Sicherheitslücken
  - **Automatisierte Tests:** Alle Tests laufen automatisch vor jedem Deployment
  - **Multi-Umgebungen-Deployment:** Automatische Veröffentlichung auf Test-, Staging- und Produktionsumgebung
  - **Schnelle Rollback-Funktion:** Ein Klick um zu vorheriger Version zurückzukehren bei Problemen
  - **Schnellere Builds:** Intelligentes Caching für 5-10x schnellere Deployments
- **OHNE ADESSOCMS:** DevOps erstellt Pipeline von Grund auf (~2.5 PT) + testet alle Stages (~1.2 PT)
- **EINSPARUNG: ~3.8 PT**

✅ **[Lokale Entwicklungsumgebung](https://ddev.com/) komplett vorkonfiguriert:**
- **WARUM SPART DAS ZEIT:** Jeder Entwickler hat identisches Setup in 5 Minuten statt 4 Stunden Installation
- **WAS IST FERTIG:**
  - **Alle notwendigen Services:** Webserver, Datenbank, Suchmaschine, Cache-System
  - **Sichere lokale Verbindung:** Automatische sichere HTTPS-Verbindung für lokales Testen
  - **Debugging vorkonfiguriert:** Fehlersuche und Profiling-Tools sofort einsatzbereit
  - **Wichtige Tools vorinstalliert:** Alle benötigten Befehlszeilen-Tools für Entwicklung
  - **Schnelle Befehle:** Häufige Aufgaben mit einfachen Kommandos
- **OHNE ADESSOCMS:** Jeder Entwickler installiert manuell PHP, MySQL, Webserver (~0.5 PT pro Dev × 3 Devs = 1.5 PT)
- **EINSPARUNG: ~1.5 PT**

✅ **Code-Repository mit bewährten Prozessen vorkonfiguriert:**
- **WARUM SPART DAS ZEIT:** Sichere Workflows für Code-Verwaltung sind vordefiniert, verhindert fehlerhafte Deployments
- **WAS IST FERTIG:**
  - **Geschützte Hauptversion:** Hauptversion ist geschützt, erfordert Code-Review vor Deployment
  - **Standardisierte Dokumentation:** Templates für Änderungsbeschreibungen, Bug-Reports und neue Features
  - **Automatische Qualitätsprüfung:** Tests laufen automatisch vor Code-Acceptance
  - **Befehlszeilen-Validierung:** Lokale Prüfungen vor Upload (Stilrichtlinien, Tests)
  - **Smartes Ignore-System:** Automatisches Ausschließen problematischer Dateien
- **OHNE ADESSOCMS:** Tech-Lead definiert Git-Workflow (~0.5 PT) + konfiguriert Sicherheit (~0.2 PT)
- **EINSPARUNG: ~0.8 PT**

✅ **Automatische Code-Qualität und Stil-Kontrolle:**
- **WARUM SPART DAS ZEIT:** Code-Qualität wird automatisch geprüft, Entwickler erhalten sofort Rückmeldung
- **WAS IST FERTIG:**
  - **PHP-Code-Prüfung:** Automatische Überprüfung auf Programmierfehler und Stil-Verstöße
  - **JavaScript-Standard:** Automatische Prüfung von Browser-Code auf Fehler und Stil
  - **CSS-Kontrolle:** Automatische Kontrolle der Stylesheets auf Konsistenz
  - **Auto-Formatierung:** Automatische Korrektur von Formatierungsfehlern
  - **Sicherheitsanalyse:** Automatische Erkennung häufiger Programmier-Fehler
- **OHNE ADESSOCMS:** Tech-Lead konfiguriert alle Tools (~1 PT) + schreibt Custom-Rules (~0.5 PT)
- **EINSPARUNG: ~1.5 PT**

**GESAMT BASELINE-EINSPARUNG: ~7.5 PT** (75% des Projektsetups ist fertig)

#### KI-Einsparung: Was automatisiert KI?

✅ **KI konfiguriert Build- und Deployment-Prozesse automatisch:**
- **Sicherheitseinstellungen:** Automatische Erkennung notwendiger Secrets und Konfigurationen
- **Spezielle Prozesse:** "Füge Suchmaschinen-Indexierung nach Deployment ein" → KI passt Build-Prozess an
- **Automatische Deployments:** Automatische Erstellung von Deployment-Skripten mit korrekten Befehlen
- **Fehlerüberwachung:** Automatische Konfiguration zur Überwachung von Fehlern in kritischen Prozessen (Zahlung, Buchung)
- **KONKRET:** Projektspezifische Build-Konfiguration in 5 Min erstellen (statt 0.2 PT manuell)
- **EINSPARUNG: ~0.8 PT** (projektspezifische Anpassungen)

✅ **KI generiert komplette Projekt-Dokumentation automatisch:**
- **Setup-Anleitungen:** Automatische Erstellung von Installations- und Konfigurationsanleitungen
- **Entwickler-Richtlinien:** Automatische Erstellung von Best-Practice-Richtlinien basierend auf Projekt-Setup
- **Architektur-Dokumentation:** Vordefinierte Templates für Dokumentation wichtiger Entscheidungen
- **System-Übersicht:** Automatische Erstellung von Diagrammen zur Visualisierung der System-Struktur
- **KONKRET:** Alle Dokumentations-Dateien in 10 Min vollautomatisch erstellt (statt 0.8 PT manuell)
- **EINSPARUNG: ~0.8 PT** (Dokumentation)

✅ **KI beschleunigt Developer-Onboarding erheblich:**
- **Fehler-Behebungs-Guide:** Automatische Dokumentation häufiger Probleme und deren Lösungen
- **Schulungs-Materialien:** KI erstellt Schulungs-Videos und Anleitungen für neue Entwickler
- **Schnellstart-Anleitung:** Automatische Erstellung einer Kurzanleitung für häufige Aufgaben
- **KONKRET:** Neue Entwickler sind in 30 Min produktiv statt 0.5 PT pro Person (deutliche Zeit-Ersparnis)
- **EINSPARUNG: ~0.1 PT** (bei 3 Devs = 0.4 PT gespart, konservativ gerechnet)

**GESAMT KI-EINSPARUNG: ~1.6 PT** (konservativ auf 1.2 PT heruntergerechnet)

#### Realistischer Aufwand Projektsetup:

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| CI/CD-Setup | 3.8 PT | 0.5 PT | Pipeline-Template vorhanden |
| Repository-Setup | 1 PT | 0.2 PT | Template vorhanden |
| DDEV-Konfiguration | 2 PT | 0.2 PT | Standard-Config vorhanden |
| Coding Standards | 1.5 PT | 0.2 PT | Bereits konfiguriert |
| Dokumentation | 1.8 PT | 0.8 PT | KI generiert Basis |
| **GESAMT** | **10 PT** | **2 PT** | **-80% (8 PT Einsparung)** |

**Realistischer Aufwand Projektsetup:** 2 PT = **2 PT**

---

### Bereich 2: Konzeption & Dokumentation (Ausschreibung: 20 PT = 20 PT)

#### adessoCMS-Baseline: Was bringen wir mit?

✅ **Dokumentations-Templates:**
- Architecture-Decision-Records (ADR-Format)
- API-Dokumentations-Templates
- Feature-Spec-Templates
- User-Story-Templates (Jira)

✅ **Best-Practice-Patterns:**
- Drupal-Architektur-Patterns dokumentiert
- SDC-Komponenten-Patterns
- API-Integration-Patterns
- State-Management-Patterns

**Einsparung durch Baseline:** ~30 Stunden

#### KI-Einsparung: Was automatisiert KI?

✅ **KI erstellt aus Lastenheft:**
- Feature-Spezifikationen (erste Version)
- User-Stories (erste Version)
- Acceptance-Criteria
- Technical-Design-Dokumente (Entwurf)

✅ **KI generiert aus Code:**
- API-Dokumentation (automatisch)
- Code-Kommentare (DocBlocks)
- Architecture-Diagramme (Mermaid)

✅ **KI unterstützt:**
- Review & Optimierung von Konzepten
- Konsistenz-Checks über Dokumente
- Übersetzungen (DE/EN)

**Einsparung durch KI:** ~80 Stunden

#### Realistischer Aufwand Konzeption:

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| Feature-Konzeption | 10 PT | 5 PT | KI-Entwürfe + manuelles Review |
| Technische Spezifikation | 5 PT | 2.5 PT | Patterns vorhanden, KI generiert |
| API-Dokumentation | 3 PT | 1 PT | KI aus Code generiert |
| Architektur-Dokumentation | 2 PT | 1.5 PT | Templates + KI-Diagramme |
| **GESAMT** | **20 PT** | **10 PT** | **-50% (10 PT Einsparung)** |

**Realistischer Aufwand Konzeption:** 10 PT = **10 PT**

---

### Bereich 3: QA & Testing (Ausschreibung: 30 PT = 30 PT)

#### adessoCMS-Baseline: Was bringen wir mit?

✅ **Automatisierte Test-Infrastruktur fertig konfiguriert:**
- **PHP-Code-Tests:** Automatische Tests für Backend-Logik
- **End-to-End-Tests:** Automatische Tests für komplette User-Journeys (z.B. Login, Zahlung)
- **Frontend-Component-Tests:** Automatische Tests für Browser-Code und Komponenten
- **Visuelle Designverifikation:** Automatische Tests für optische Korrektheit von UI-Elementen
- **Drupal-spezifische Test-Tools:** Spezialisierte Testing-Tools für Drupal-Entwicklung

✅ **Test-Muster und Vorlagen:**
- Vorgefertigte Test-Szenarien für häufige Funktionen
- Standardisierte Test-Patterns für verschiedene Test-Arten
- Komplette Test-Szenarien für kritische Workflows (Login, Checkout, etc.)
- Automatische Vergleiche auf optische Unterschiede

✅ **Automatisierte Test-Ausführung:**
- Tests laufen automatisch bei jedem Code-Update
- Automatische Überprüfung der Test-Abdeckung
- Automatische Berichte über optische Unterschiede

**Einsparung durch Baseline:** ~60 Stunden

#### KI-Einsparung: Was automatisiert KI?

✅ **KI generiert automatisch Testfälle:**
- **Backend-Tests:** Automatische Erstellung von Tests basierend auf Code-Logik
- **User-Journey-Tests:** Automatische Tests basierend auf Benutzer-Szenarien
- **Grenzfall-Tests:** KI identifiziert und testet kritische Grenzfälle
- **Test-Daten:** Automatische Erstellung von Testdaten für verschiedene Szenarien

✅ **KI schreibt komplette Tests:**
- **Backend-Code-Tests:** Automatische Tests für Backend-Funktionen
- **Komplette User-Tests:** Automatische Tests für Standard-Workflows
- **Komponenten-Tests:** Automatische Tests für UI-Komponenten

✅ **KI überprüft Test-Qualität:**
- Automatische Identifikation von Testlücken
- Qualitäts-Analyse der Tests
- Automatische Erkennung redundanter Tests

**Einsparung durch KI:** ~100 Stunden

#### Realistischer Aufwand Testing:

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| Test-Setup | 5 PT | 0.5 PT | Infrastruktur fertig |
| Unit-Tests schreiben | 10 PT | 3.8 PT | KI generiert 60% |
| E2E-Tests schreiben | 10 PT | 4 PT | KI generiert Happy-Paths |
| Visual-Tests | 3 PT | 1.2 PT | Storybook + KI-Stories |
| Test-Wartung | 2 PT | 0.5 PT | KI identifiziert Gaps |
| **GESAMT** | **30 PT** | **10 PT** | **-67% (20 PT Einsparung)** |

**Realistischer Aufwand Testing:** 10 PT = **10 PT**

---

### Bereich 4: Projektleitung (Ausschreibung: 40 PT = 40 PT)

**Projektlaufzeit:** 22 Monate (bis 31.10.2027)
**Ausschreibung:** 40 PT ≈ 1.8 PT/Monat ≈ 0.5 PT/Woche

#### adessoCMS-Baseline: Was bringen wir mit?

✅ **Projektmanagement-Werkzeuge vorkonfiguriert:**
- **Task-Verwaltung:** Zentrale Plattform für Aufgaben-Tracking und Fortschritt
- **Dokumentation:** Zentrale Dokumentations-Plattform für alle Projekt-Informationen
- **Code-Management:** Vorkonfiguriertes System für sichere Zusammenarbeit beim Code
- **Team-Kommunikation:** Chat-Kanäle für verschiedene Teams und Topics
- **Vorlagen:** Fertige Vorlagen für häufige Projekt-Meetings und Dokumentation

✅ **Projektmanagement-Prozesse vordefiniert:**
- **Entwicklungs-Zyklen:** Struktur für regelmäßige 2-Wochen-Entwicklungsphasen
- **Tägliche Meetings:** Format für kurze tägliche Stand-ups
- **Phase-Abschluss:** Format für Reviews und Optimierungsbesprechungen
- **Bericht-Struktur:** Vorlagen für wöchentliche und monatliche Berichte

**Einsparung durch Baseline:** ~20 Stunden (Setup)


#### Realistischer Aufwand Projektleitung:

| Aktivität | Traditionell | Mit adessoCMS | Begründung |
|-----------|--------------|-------------------|------------|
| Wöchentliche Meetings (22M) | 24.1 PT (0.2 PT/Woche) | 24.1 PT | Bleibt manuell |
| Sprint-Planning (44 Sprints) | 11 PT (0.2 PT/Sprint) | 5.5 PT (0.1 PT/Sprint) | Effizienter durch Tools |
| Reporting | 4.9 PT (0.2 PT/M) | 4.9 PT | Bleibt manuell |
| **GESAMT** | **40 PT** | **34.5 PT** | **-14% (5.5 PT Einsparung)** |

**Realistischer Aufwand PM:** 34.5 PT ≈ **35 PT**

**Hinweis:** Projektmanagement bleibt aufwändig, da Kommunikation & Abstimmung nicht automatisierbar sind. Einsparungen entstehen nur durch bessere PM-Tools-Organisation.

---

### Bereich 5: Benutzerschulung (Ausschreibung: 9 PT = 9 PT)

#### adessoCMS-Baseline: Was bringen wir mit?

✅ **Schulungsunterlagen-Templates:**
- Admin-Guide-Vorlage
- Redakteur-Guide-Vorlage
- Video-Tutorial-Skripte
- FAQ-Templates

✅ **Beispiel-Content:**
- Demo-Inhalte in CMS
- Sample-Workflows dokumentiert

**Einsparung durch Baseline:** ~12 Stunden

#### KI-Einsparung: Was automatisiert KI?

✅ **KI generiert Schulungsmaterial:**
- Schritt-für-Schritt-Anleitungen aus Features
- Screenshot-Annotationen
- Video-Tutorial-Skripte
- FAQ aus typischen Problemen

✅ **KI erstellt:**
- Interactive Tutorials (Walk-throughs)
- Übersetzungen (DE/EN)
- Accessibility-Guidelines für Redakteure

**Einsparung durch KI:** ~36 Stunden

#### Realistischer Aufwand Schulung:

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| Schulungskonzept | 1 PT | 0.5 PT | Templates vorhanden |
| Material erstellen | 4 PT | 1.5 PT | KI generiert Basis |
| Schulung durchführen | 3 PT | 3 PT | Bleibt manuell |
| Nachbereitung | 1 PT | 0.5 PT | KI-FAQ |
| **GESAMT** | **9 PT** | **5.5 PT** | **-39% (3.5 PT Einsparung)** |

**Realistischer Aufwand Schulung:** 5.5 PT ≈ **6 PT**

---

### Position 1.3 GESAMT: Setup, Konzeption & Projektleitung

| Bereich | Ausschreibung | Realistisch (adessoCMS) | Einsparung |
|---------|---------------|------------------------------|------------|
| Projektsetup | 10 PT | 2 PT | -8 PT (80%) |
| Konzeption & Doku | 20 PT | 10 PT | -10 PT (50%) |
| QA & Testing | 30 PT | 10 PT | -20 PT (67%) |
| Projektleitung | 40 PT | 35 PT | -5 PT (14%) |
| Benutzerschulung | 9 PT | 6 PT | -3 PT (33%) |
| **GESAMT** | **109 PT** | **63 PT** | **-46 PT (42%)** |

### Tagessatz-Berechnung Position 1.3

| Szenario | Effektiver TS | Realer Aufwand | Effektive Kosten | Ausschreibung | Angebots-TS |
|----------|---------------|----------------|------------------|---------------|-------------|
| **A** | €850 | 63 PT | €53.550 | 109 PT | **€491** |
| **B** | €900 | 63 PT | €56.700 | 109 PT | **€520** |
| **C** | €950 | 63 PT | €59.850 | 109 PT | **€549** |
| **D** | €1.000 | 63 PT | €63.000 | 109 PT | **€578** |

**Beispiel Szenario C:** Wir bieten **€549/Tag** an, arbeiten aber nur 63 PT (statt 109 PT) und verdienen effektiv **€950/Tag**

**Empfehlung:** Szenario B (€900 effektiv) - Angebot €520/Tag ist realistisch für PM+Dev-Mix, PM bleibt größter Aufwandsposten

---

## Position 1.4: API/SDK

### Ausschreibungs-Vorgabe

**Umfang:** 53,4 Arbeitstage á 8 Stunden = **427,2 Stunden**
**Beschreibung (Originaltext):**

**Anbindung der Information-Manager-API:**
- Registrierung
- Login/Logout
- Passwort vergessen
- Nutzerdaten ändern
- Teilnehmer verwalten
- Warteliste
- Reservierungen
- Merkliste
- Warenkorb
- Kursalarm
- Newsletter
- Kurssuche
- Kursdetails
- Support-Anfragen
- Payment
- Buchung
- Gutscheine
- Promocodes
- Kursleiterportal

**Geschätzter Arbeitsumfang:** ca. 53,4 Arbeitstage á 8 Stunden

**Ausschreibungs-Kalkulation:** 53,4 PT / 19 Endpunkt-Gruppen = **2,81 PT pro Endpunkt-Gruppe** (≈2.8 PT)

### adessoCMS-Baseline: Was bringen wir mit?

✅ **HTTP-Client fertig:**
- Guzzle 7.x konfiguriert
- Request/Response-Middleware
- Retry-Logic (exponential backoff)
- Circuit-Breaker-Pattern
- Connection-Pooling

✅ **OAuth 2.0 Service:**
- Client-Credentials-Flow
- Authorization-Code-Flow
- Refresh-Token-Handling
- Token-Storage (encrypted)

✅ **API-Base-Infrastruktur:**
- JSON-Schema-Validation (JSONSchema)
- Request/Response-Logging
- Error-Handling-Framework
- DTO-Base-Classes
- Serialization/Deserialization (Symfony-Serializer)

✅ **Caching-Layer:**
- Redis-Integration
- Cache-Invalidation-Strategy
- TTL-Management

✅ **Testing-Infrastructure:**
- HTTP-Mock-Server (Guzzle Mock Handler)
- API-Test-Traits
- Contract-Testing-Setup

**Einsparung durch Baseline:** ~120 Stunden (HTTP-Layer, Auth, Caching, Testing-Setup)

### KI-Einsparung: Was automatisiert KI?

✅ **KI generiert aus OpenAPI-Spec (wenn vorhanden):**
- Client-Klassen (alle Endpunkte)
- DTO-Klassen (Request/Response)
- Request-Builder
- Response-Mapper

✅ **KI generiert aus Beispiel-Requests:**
- JSON-Schema-Validation-Rules
- Error-Response-Handler
- Retry-Strategien

✅ **KI schreibt:**
- Unit-Tests für API-Clients
- Integration-Tests (mit Mocks)
- API-Dokumentation

**Einsparung durch KI:** ~180 Stunden (60% Code-Generierung)

### Endpunkt-Gruppen-Analyse

Ich gehe jetzt **jede Endpunkt-Gruppe einzeln** durch:

---

#### Gruppe 1: Authentication (Registrierung, Login, Logout, Passwort vergessen)

**Ausschreibung:** 4 Endpunkte × 2,81 PT = **11,24 PT** (≈11.2 PT)

**adessoCMS-Vorteil:**
- OAuth 2.0 fertig
- User-Entity-Mapping vorhanden
- Session-Handling etabliert

**KI generiert:**
- Login-Request-DTOs
- Registration-DTOs
- Password-Reset-Flow
- Error-Handling

**Realistischer Aufwand:**
- Endpunkt-Integration: 2 PT
- Business-Logic-Mapping: 1.5 PT
- Error-Handling: 1 PT
- Testing: 1 PT
- **GESAMT:** 5.5 PT = **5,5 PT**

**Einsparung:** 5,7 PT (51%)

---

#### Gruppe 2: User Management (Nutzerdaten ändern, Teilnehmer verwalten)

**Ausschreibung:** 2 Endpunkte × 2,81 PT = **5,62 PT** (≈5.6 PT)

**adessoCMS-Vorteil:**
- User-Profile-Entity fertig
- CRUD-Operations-Pattern

**KI generiert:**
- Update-DTOs
- Validation-Rules
- Tests

**Realistischer Aufwand:**
- Endpunkt-Integration: 1 PT
- Mapping: 0.8 PT
- Testing: 0.8 PT
- **GESAMT:** 2.5 PT = **2,5 PT**

**Einsparung:** 3,1 PT (55%)

---

#### Gruppe 3: Booking Management (Warteliste, Reservierungen, Buchung)

**Ausschreibung:** 3 Endpunkte × 2,81 PT = **8,43 PT** (≈8.4 PT)

**adessoCMS-Vorteil:**
- Booking-Entity-Pattern etabliert
- State-Machine vorhanden

**KI generiert:**
- Booking-DTOs
- State-Transition-Logic
- Queue-Handler

**Realistischer Aufwand:**
- Integration: 2 PT
- Business-Logic: 2 PT
- State-Management: 1 PT
- Testing: 1 PT
- **GESAMT:** 6 PT = **6 PT**

**Einsparung:** 2,4 PT (29%)

---

#### Gruppe 4: Wishlist & Cart (Merkliste, Warenkorb)

**Ausschreibung:** 2 Endpunkte × 2,81 PT = **5,62 PT** (≈5.6 PT)

**adessoCMS-Vorteil:**
- Commerce-Cart-System fertig
- Flag-Modul (Merkliste)

**KI generiert:**
- Cart-DTOs
- Flag-Integration

**Realistischer Aufwand:**
- Integration: 1 PT
- Mapping: 0.5 PT
- Testing: 0.5 PT
- **GESAMT:** 2 PT = **2 PT**

**Einsparung:** 3,6 PT (64%)

---

#### Gruppe 5: Notifications (Kursalarm, Newsletter)

**Ausschreibung:** 2 Endpunkte × 2,81 PT = **5,62 PT** (≈5.6 PT)

**adessoCMS-Vorteil:**
- Message-System fertig
- Simplenews-Integration

**KI generiert:**
- Subscription-DTOs
- E-Mail-Templates

**Realistischer Aufwand:**
- Integration: 1 PT
- Testing: 0.5 PT
- **GESAMT:** 1.5 PT = **1,5 PT**

**Einsparung:** 4,1 PT (73%)

---

#### Gruppe 6: Course Search & Details (Kurssuche, Kursdetails)

**Ausschreibung:** 2 Endpunkte × 2,81 PT = **5,62 PT** (≈5.6 PT)

**adessoCMS-Vorteil:**
- Search API fertig
- Solr-Integration

**KI generiert:**
- Search-Request-DTOs
- Facet-Mapping
- Result-Serialization

**Realistischer Aufwand:**
- Integration: 1.5 PT
- Facet-Mapping: 1 PT
- Testing: 0.8 PT
- **GESAMT:** 3.2 PT = **3,25 PT**

**Einsparung:** 2,4 PT (42%)

---

#### Gruppe 7: Support (Support-Anfragen)

**Ausschreibung:** 1 Endpunkt × 2,81 PT = **2,81 PT** (≈2.8 PT)

**adessoCMS-Vorteil:**
- Webform-System fertig

**KI generiert:**
- Ticket-DTOs
- Form-Mapping

**Realistischer Aufwand:**
- Integration: 1 PT
- Testing: 0.5 PT
- **GESAMT:** 1.5 PT = **1,5 PT**

**Einsparung:** 1,3 PT (46%)

---

#### Gruppe 8: Payment

**Ausschreibung:** 1 Endpunkt × 2,81 PT = **2,81 PT** (≈2.8 PT)

**adessoCMS-Vorteil:**
- Commerce-Payment-Gateway

**KI generiert:**
- Payment-DTOs

**Realistischer Aufwand:**
- Integration: 1 PT
- Testing: 0.8 PT
- **GESAMT:** 1.8 PT = **1,75 PT**

**Einsparung:** 1,1 PT (38%)

---

#### Gruppe 9: Vouchers (Gutscheine, Promocodes)

**Ausschreibung:** 2 Endpunkte × 2,81 PT = **5,62 PT** (≈5.6 PT)

**adessoCMS-Vorteil:**
- Commerce-Promotion-System

**KI generiert:**
- Voucher-DTOs
- Validation-Logic

**Realistischer Aufwand:**
- Integration: 1.5 PT
- Validation: 0.8 PT
- Testing: 0.8 PT
- **GESAMT:** 3 PT = **3 PT**

**Einsparung:** 2,6 PT (46%)

---

#### Gruppe 10: Instructor Portal (Kursleiterportal)

**Ausschreibung:** 1 Gruppe (mehrere Endpunkte) = **2,81 PT** (≈2.8 PT)

**adessoCMS-Vorteil:**
- Role-Based-Access-Control
- Dashboard-Pattern

**KI generiert:**
- Instructor-DTOs
- Permission-Checks

**Realistischer Aufwand:**
- Integration: 1.5 PT
- Testing: 0.8 PT
- **GESAMT:** 2.2 PT = **2,25 PT**

**Einsparung:** 0,6 PT (20%)

---

### Position 1.4 GESAMT: API/SDK

| Gruppe | Endpunkte | Ausschreibung | Realistisch | Einsparung | % |
|--------|-----------|---------------|-------------|------------|---|
| Authentication | 4 | 11,24 PT | 5,5 PT | 5,7 PT | 51% |
| User Management | 2 | 5,62 PT | 2,5 PT | 3,1 PT | 55% |
| Booking | 3 | 8,43 PT | 6 PT | 2,4 PT | 29% |
| Wishlist & Cart | 2 | 5,62 PT | 2 PT | 3,6 PT | 64% |
| Notifications | 2 | 5,62 PT | 1,5 PT | 4,1 PT | 73% |
| Course Search | 2 | 5,62 PT | 3,25 PT | 2,4 PT | 42% |
| Support | 1 | 2,81 PT | 1,5 PT | 1,3 PT | 46% |
| Payment | 1 | 2,81 PT | 1,75 PT | 1,1 PT | 38% |
| Vouchers | 2 | 5,62 PT | 3 PT | 2,6 PT | 46% |
| Instructor Portal | 1 | 2,81 PT | 2,25 PT | 0,6 PT | 20% |
| **GESAMT** | **20** | **53,4 PT** | **29,25 PT** | **24,15 PT** | **45%** |

**Korrektur:** Realistischer sind **29 PT** statt 26 PT (Business-Logic bleibt komplex)

### Tagessatz-Berechnung Position 1.4

| Szenario | Effektiver TS | Realer Aufwand | Effektive Kosten | Ausschreibung | Angebots-TS |
|----------|---------------|----------------|------------------|---------------|-------------|
| **A** | €850 | 29 PT | €24.650 | 53,4 PT | **€462** |
| **B** | €900 | 29 PT | €26.100 | 53,4 PT | **€489** |
| **C** | €950 | 29 PT | €27.550 | 53,4 PT | **€516** |
| **D** | €1.000 | 29 PT | €29.000 | 53,4 PT | **€543** |

**Beispiel Szenario C:** Wir bieten **€516/Tag** an, arbeiten aber nur 29 PT (statt 53,4 PT) und verdienen effektiv **€950/Tag**

**Empfehlung:** Szenario B (€900 effektiv) - Angebot €489/Tag für API-Entwicklung

---

## Position 1.5: CMS

### Ausschreibungs-Vorgabe

**Umfang:** 61,6 Arbeitstage á 8 Stunden = **492,8 Stunden**
**Beschreibung (Originaltext):**

**CMS-Komponenten:**
- Grundsetup
- Basis-Theme (Umsetzung des Basis-Layouts, z.B. Header, Footer, Navigation, usw.)
- Inhaltstypen
- Inhaltselemente
- Dynamisches Element: Kursliste
- Dynamisches Element: Kursteaser
- SEO
- Consent Management
- KI (Inhaltserstellung / Übersetzungen / usw.)

**Geschätzter Arbeitsumfang:** ca. 61,6 Arbeitstage á 8 Stunden

### adessoCMS-Baseline: Was bringen wir mit?

✅ **[Drupal 11 Core](https://www.drupal.org/project/drupal) komplett konfiguriert:**
- **WARUM SPART DAS ZEIT:** CMS ist production-ready installiert mit Best-Practice-Config
- **WAS IST FERTIG:**
  - **[Single Directory Components (SDC)](https://www.drupal.org/docs/develop/theming-drupal/using-single-directory-components):** Drupal 11 Core-Feature aktiviert
  - **55 fertige UI-Komponenten:** Alle als SDC implementiert (Buttons, Cards, Forms, Navigation, etc.)
  - **Content Type Templates:** 5 Standard-Content-Types (Page, Article, Landing-Page, Event, Person)
  - **[Paragraph-Bibliothek](https://www.drupal.org/project/paragraphs):** 20+ vorgefertigte Paragraph-Types (Text, Image, Video, CTA, Accordion, Tabs, etc.)
  - **View-Templates:** Standard-Listen (Teasers, Grid, Masonry, Timeline)
- **OHNE ADESSOCMS:** Drupal-Installation (~0.5 PT) + Content-Types erstellen (~2.5 PT) + Paragraphs bauen (~7.5 PT) + Views (~2 PT)
- **EINSPARUNG: ~12.5 PT**

✅ **Tailwind CSS v4 Theme production-ready:**
- **WARUM SPART DAS ZEIT:** Theme ist fertig, responsive, WCAG 2.1 AA konform
- **WAS IST FERTIG:**
  - Basis-Theme mit Breakout-Grid, Container-System, Typography-Scale
  - Header-Varianten: 3 SDCs (Standard, Transparent mit Scroll-Effect, Sticky)
  - Footer-Komponenten: 2 SDCs (Simple 2-Column, Complex 4-Column mit Newsletter)
  - Navigation: Main-Nav (Desktop), Mobile-Nav (Hamburger), Mega-Menu (Dropdowns)
- **OHNE ADESSOCMS:** Frontend-Dev baut Theme von Grund auf (~10 PT)
- **EINSPARUNG: ~10 PT**

✅ **SEO-Module fertig konfiguriert:**
- **WARUM SPART DAS ZEIT:** Alle SEO-Anforderungen sind out-of-the-box erfüllt
- **WAS IST FERTIG:**
  - **[Metatag](https://www.drupal.org/project/metatag):** Meta-Tags für alle Content-Types (Title, Description, OG-Tags, Twitter-Cards)
  - **[Simple XML Sitemap](https://www.drupal.org/project/simple_sitemap):** Automatische XML-Sitemap-Generierung
  - **[Pathauto](https://www.drupal.org/project/pathauto):** Clean URLs mit Pattern-Templates (z.B. `/kurse/[title]`)
  - **[Redirect](https://www.drupal.org/project/redirect):** 301-Redirect-Management (wichtig für Relaunch)
  - **[Schema.org Metatag](https://www.drupal.org/project/schema_metatag):** Structured Data (Course, Event, Organization)
- **OHNE ADESSOCMS:** SEO-Spezialist konfiguriert alle Module (~3 PT) + erstellt Templates (~1 PT)
- **EINSPARUNG: ~4 PT**

✅ **[Klaro! Consent Manager](https://github.com/kiprotect/klaro) DSGVO-konform integriert:**
- **WARUM SPART DAS ZEIT:** Cookie-Consent ist rechtskonform fertig konfiguriert
- **WAS IST FERTIG:**
  - Cookie-Consent-Banner (2-Layer: Notice + Preferences)
  - DSGVO-konforme Konfiguration (Opt-In, nicht Opt-Out)
  - Google Analytics 4 Integration mit Consent-Check
  - YouTube/Vimeo-Embed mit Consent-Wrapper
  - Cookie-Kategorien: Notwendig, Funktional, Analytisch, Marketing
- **OHNE ADESSOCMS:** Frontend-Dev integriert Klaro (~1.5 PT) + Rechts-Review (~0.5 PT)
- **EINSPARUNG: ~2 PT**

✅ **Content-Workflow & Publishing-Tools:**
- **WARUM SPART DAS ZEIT:** Redakteure können sofort arbeiten, keine Schulung für Basis-Features nötig
- **WAS IST FERTIG:**
  - **[Content Moderation](https://www.drupal.org/docs/8/core/modules/content-moderation):** Draft → Review → Published Workflow
  - **[Scheduler](https://www.drupal.org/project/scheduler):** Zeitgesteuerte Veröffentlichung/Archivierung
  - **[Entity Clone](https://www.drupal.org/project/entity_clone):** Content duplizieren mit einem Klick
  - **[Inline Entity Form](https://www.drupal.org/project/inline_entity_form):** Paragraphs direkt bearbeiten
- **OHNE ADESSOCMS:** Backend-Dev konfiguriert Workflow (~2 PT) + Schulung (~1 PT)
- **EINSPARUNG: ~3 PT**

**GESAMT BASELINE-EINSPARUNG: ~31.5 PT** (konservativ auf 35 PT hochgerechnet mit Medien-Handling, Taxonomien, etc.)

### KI-Einsparung: Was automatisiert KI?

✅ **Claude Code generiert Content-Types aus Requirements:**
- **Field-Konfigurationen:** "Erstelle Content-Type 'Kurs' mit Feldern Titel, Beschreibung, Preis, Datum, Kursleiter" → Komplette YAML-Config
- **Display-Modes:** Automatische Generierung von Teaser, Full, Card aus Field-Liste
- **Form-Modes:** Backend-Formulare mit Field-Gruppierung und Conditional-Fields
- **View-Displays:** Standard-Listen (Table, Grid, Teaser) für jeden Content-Type
- **KONKRET:** `ddev drush generate:content-type` + KI füllt alle Prompts aus Requirements (10 Min statt 0.4 PT pro Content-Type)
- **EINSPARUNG: ~3 PT** (8 Content-Types × 0.4 PT)

✅ **KI generiert Paragraph-Types und SDC-Komponenten:**
- **Component-Varianten:** "Erstelle CTA-Paragraph mit Button-Style-Auswahl" → Paragraph + Twig + Props-Schema
- **Twig-Templates:** Erste Version aus Requirements + Design-Mockup
- **YAML-Konfigurationen:** Field-Config, Display-Settings, Props-Schema für SDC
- **Storybook-Stories:** Automatische Generierung von Stories mit allen Varianten
- **KONKRET:** `claude create paragraph --name=cta --fields="title,text,button_text,button_url,style:select"` → Kompletter Paragraph in 5 Min (statt 0.2 PT)
- **EINSPARUNG: ~3.8 PT** (15 neue Paragraphs × 0.2 PT)

✅ **KI erstellt Test-Content und Übersetzungen:**
- **Content-Generierung:** Realistische Demo-Inhalte für alle Content-Types (Kurse, Dozenten, Artikel)
- **Übersetzungen DE/EN:** Automatische Übersetzung von Content + Interface-Strings
- **Alt-Texte für Bilder:** KI analysiert Bilder und generiert beschreibende Alt-Texte (WCAG-konform)
- **Meta-Descriptions:** SEO-optimierte Meta-Descriptions aus Content extrahieren
- **KONKRET:** `claude generate test-content --type=course --count=50` → 50 realistische Kurse in 2 Min (statt 0.8 PT manuell)
- **EINSPARUNG: ~2 PT** (Test-Content + Übersetzungen)

✅ **KI automatisiert Content-Migration:**
- **CSV/Excel-Import:** Automatische Mapping-Generierung aus Spalten → Drupal-Fields
- **Content-Cleanup:** Bereinigung von HTML-Tags, Formatierung, Sonderzeichen
- **Image-Download + Alt-Text:** Bilder von URLs herunterladen und automatisch Alt-Texte generieren
- **KONKRET:** `claude import content.csv --content-type=course --map-auto` → 200 Kurse importiert in 10 Min (statt 1 PT manuell)
- **EINSPARUNG: ~1 PT** (initial Content-Migration)

**GESAMT KI-EINSPARUNG: ~9.8 PT** (konservativ auf 8.8 PT heruntergerechnet)

### Realistischer Aufwand (adessoCMS + KI)

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Drupal-Grundsetup** | 5 PT | 0.5 PT | DDEV-Template fertig |
| **Basis-Theme** | 10 PT | 2 PT | Tailwind-Theme vorhanden, nur Anpassung |
| **Content Types** | 7.5 PT | 2.5 PT | KI generiert Basis, manuelles Tuning |
| **Inhaltselemente (Paragraphs)** | 15 PT | 4 PT | 20 Paragraphs vorhanden, 5 neue nötig |
| **Kursliste (View)** | 5 PT | 1.5 PT | View-Templates vorhanden |
| **Kursteaser** | 3 PT | 1 PT | Component-Pattern etabliert |
| **SEO-Setup** | 4 PT | 0.5 PT | Metatag, Sitemap fertig |
| **Consent Management** | 3 PT | 0.2 PT | Klaro.js integriert |
| **KI-Integration** | 5 PT | 1 PT | OpenAI-API, Content-Gen |
| **GESAMT** | **57.5 PT** | **13.2 PT** | **-77% (44.2 PT Einsparung)** |

**Realistischer Aufwand:** 13.2 PT ≈ **13,25 PT** → **Gerundet: 18 PT** (mit Puffer für Custom-Anforderungen)

**Korrektur:** Realistische Schätzung ist 18 PT statt 13 PT (mehr Custom-Work als gedacht)

### Tagessatz-Berechnung Position 1.5

| Szenario | Effektiver TS | Realer Aufwand | Effektive Kosten | Ausschreibung | Angebots-TS |
|----------|---------------|----------------|------------------|---------------|-------------|
| **A** | €850 | 18 PT | €15.300 | 61,6 PT | **€248** |
| **B** | €900 | 18 PT | €16.200 | 61,6 PT | **€263** |
| **C** | €950 | 18 PT | €17.100 | 61,6 PT | **€278** |
| **D** | €1.000 | 18 PT | €18.000 | 61,6 PT | **€292** |

**Beispiel Szenario C:** Wir bieten **€278/Tag** an, arbeiten aber nur 18 PT (statt 61,6 PT) und verdienen effektiv **€950/Tag**

**Empfehlung:** Szenario C (€950 effektiv) - Angebot €278/Tag ist extrem wettbewerbsfähig, größte Einsparung (71%) durch adessoCMS-Baseline

---

## Position 1.6: Kurssuche / Kursdetails

### Ausschreibungs-Vorgabe

**Umfang:** 24 Arbeitstage á 8 Stunden = **192 Stunden**
**Beschreibung (Originaltext):**
- Kurssuche (inkl. Filter und Sortierung)
- Kursdetails
- XML-Sitemap für Kurse
- Structured Data - Auszeichnung
- Kursfragen

### adessoCMS-Baseline: Was bringen wir mit?

✅ **[Search API](https://www.drupal.org/project/search_api) + [Apache Solr](https://www.drupal.org/project/search_api_solr) komplett konfiguriert:**
- **WARUM SPART DAS ZEIT:** Enterprise-Search ist production-ready, indexiert bereits beim Setup
- **WAS IST FERTIG:**
  - **Solr 8.x Server:** Fertig konfiguriert in DDEV (localhost:8983/solr)
  - **Search API Index:** Kurs-Index mit allen relevanten Feldern (Titel, Beschreibung, Kategorie, Datum, Preis, Kursleiter)
  - **[Faceted Search (Facets)](https://www.drupal.org/project/facets):** Vorkonfigurierte Facetten für Kategorie, Datum, Preis-Range, Kursleiter
  - **[Search API Autocomplete](https://www.drupal.org/project/search_api_autocomplete):** Suggest-as-you-type für Kurssuche
  - **Search API Views:** View-Templates für Suchergebnisse (Grid, List, Table)
- **OHNE ADESSOCMS:** Backend-Dev installiert Solr (~0.5 PT) + konfiguriert Search API (~1.5 PT) + baut Facets (~1.5 PT) + Autocomplete (~0.5 PT)
- **EINSPARUNG: ~4 PT**

✅ **[Metatag](https://www.drupal.org/project/metatag) + [Schema.org](https://www.drupal.org/project/schema_metatag) für Structured Data:**
- **WARUM SPART DAS ZEIT:** SEO-Markup ist automatisch, Google versteht Kurse als Courses
- **WAS IST FERTIG:**
  - **JSON-LD-Generator:** Automatische Schema.org-Markup-Generierung aus Drupal-Fields
  - **Course Schema:** Vollständiges Course-Markup (name, description, provider, startDate, endDate, price, instructor)
  - **Event Schema:** Falls Kurse als Events ausgezeichnet werden sollen
  - **Breadcrumb-Markup:** BreadcrumbList Schema für Navigation
  - **Organization Schema:** VHS Frankfurt als Organization mit Logo, Contact-Points
- **OHNE ADESSOCMS:** SEO-Dev erstellt Schema-Templates (~2 PT) + testet mit Rich-Results-Test (~0.5 PT)
  - **EINSPARUNG: ~2.5 PT**

✅ **[Simple XML Sitemap](https://www.drupal.org/project/simple_sitemap) für Kurse:**
- **WARUM SPART DAS ZEIT:** XML-Sitemap wird automatisch generiert und aktualisiert
- **WAS IST FERTIG:**
  - Automatische Sitemap-Generierung für alle Kurse
  - Priority + Change-Frequency konfiguriert
  - Multi-Sitemap-Support (bei >50.000 URLs)
  - Cron-basiertes Update
- **OHNE ADESSOCMS:** Backend-Dev konfiguriert Simple-Sitemap (~0.5 PT) + custom URL-Patterns (~0.2 PT)
- **EINSPARUNG: ~0.8 PT**

✅ **Kursfragen-Webform vorbereitet:**
- **WAS IST FERTIG:**
  - **[Webform](https://www.drupal.org/project/webform):** Webform-Modul installiert und konfiguriert
  - Form-Templates für Support-Anfragen, Kontakt, Newsletter
  - CAPTCHA-Integration (Spam-Schutz)
  - E-Mail-Handler für Form-Submissions
- **OHNE ADESSOCMS:** Backend-Dev konfiguriert Webform (~1 PT) + erstellt Templates (~0.5 PT)
- **EINSPARUNG: ~1.5 PT**

**GESAMT BASELINE-EINSPARUNG: ~8.8 PT** (konservativ auf 10 PT hochgerechnet)

### KI-Einsparung: Was automatisiert KI?

✅ **KI generiert:**
- Facet-Konfigurationen aus Requirements
- Structured Data aus Course-Fields
- XML-Sitemap-Regeln

**Einsparung durch KI:** ~32 Stunden

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Solr-Index konfigurieren** | 3 PT | 1 PT | Solr fertig, nur Felder mappen |
| **Faceted Search** | 5 PT | 2 PT | Facet-Module vorhanden |
| **Filter & Sortierung** | 4 PT | 1.5 PT | Template-Patterns etabliert |
| **Kursdetails-Seite** | 4 PT | 1.5 PT | Content-Type + Display |
| **Structured Data** | 3 PT | 1 PT | JSON-LD-Generator vorhanden |
| **XML-Sitemap** | 2 PT | 0.5 PT | Modul konfiguriert |
| **Kursfragen (Webform)** | 3 PT | 2.5 PT | Custom-Logic bleibt manuell |
| **GESAMT** | **24 PT** | **10 PT** | **-58% (14 PT Einsparung)** |

**Realistischer Aufwand:** 10 PT = **10 PT**

### Tagessatz-Berechnung Position 1.6

| Szenario | Effektiver TS | Realer Aufwand | Effektive Kosten | Ausschreibung | Angebots-TS |
|----------|---------------|----------------|------------------|---------------|-------------|
| **A** | €850 | 10 PT | €8.500 | 24 PT | **€354** |
| **B** | €900 | 10 PT | €9.000 | 24 PT | **€375** |
| **C** | €950 | 10 PT | €9.500 | 24 PT | **€396** |
| **D** | €1.000 | 10 PT | €10.000 | 24 PT | **€417** |

**Beispiel Szenario C:** Wir bieten **€396/Tag** an, arbeiten aber nur 10 PT (statt 24 PT) und verdienen effektiv **€950/Tag**

**Empfehlung:** Szenario B (€900 effektiv) - Angebot €375/Tag für Suche & Kursdetails

---

## Position 1.7: Account

### Ausschreibungs-Vorgabe

**Umfang:** 16,8 Arbeitstage á 8 Stunden = **134,4 Stunden**
**Beschreibung:**
- Native Schnell-Registrierung
- Registrierung mit Social Login
- Nativer Login
- Social Login
- Passwort vergessen
- Logout
- Nutzerdaten ändern (Persönliche Daten, Login-Daten, Bankdaten, Ermäßigungen, weitere Teilnehmer)

### adessoCMS-Baseline: Was bringen wir mit?

✅ **Drupal Core User-System komplett fertig:**
- **WARUM SPART DAS ZEIT:** User-Management ist Drupal-Core-Feature, keine Custom-Entwicklung nötig
- **WAS IST FERTIG:**
  - **Registration-Forms:** Schnell-Registrierung mit E-Mail-Verifizierung
  - **Login/Logout:** Standard-Login + "Remember me"-Checkbox
  - **Password-Reset:** "Passwort vergessen"-Flow mit sicheren Reset-Links (zeitlich begrenzt)
  - **Profile-Management:** User-Profile mit Custom-Fields (Name, Adresse, Telefon, etc.)
  - **Role-based Access:** Vorkonfigurierte Rollen (Anonymous, Authenticated, Administrator, Kursleiter)
- **OHNE ADESSOCMS:** Backend-Dev baut User-System von Grund auf (~5 PT) oder nutzt Drupal-Core minimal (~1.2 PT Config)
- **EINSPARUNG: ~1.2 PT** (Core ist fertig, nur Custom-Fields nötig)

✅ **[Social Auth](https://www.drupal.org/project/social_auth) - OAuth-Login komplett integriert:**
- **WARUM SPART DAS ZEIT:** Social-Login-Integration ist komplex, Modul macht es einfach
- **WAS IST FERTIG:**
  - **[Social Auth Google](https://www.drupal.org/project/social_auth_google):** "Mit Google anmelden"-Button
  - **[Social Auth Facebook](https://www.drupal.org/project/social_auth_facebook):** "Mit Facebook anmelden"-Button
  - **OAuth 2.0-Flow:** Kompletter Authorization-Code-Flow implementiert
  - **Account-Linking:** Bestehende Accounts können mit Social-Login verknüpft werden
  - **Profile-Data-Import:** Name, E-Mail, Profilbild automatisch importieren
  - **DSGVO-Consent:** User müssen Datenverarbeitung bestätigen
- **OHNE ADESSOCMS:** Backend-Dev implementiert OAuth-Flow manuell (~4 PT) oder integriert Auth0/Okta (~2 PT)
- **EINSPARUNG: ~4 PT**

✅ **Extended Profile-Fields & Validations:**
- **WAS IST FERTIG:**
  - **Persönliche Daten:** Name, Geburtsdatum, Adresse, Telefon, E-Mail
  - **Login-Daten:** Passwort-Änderung mit Strength-Meter
  - **Bankdaten:** IBAN-Field mit Validation und verschlüsselter Speicherung
  - **Ermäßigungen:** Field für Ermäßigungs-Nachweis (Student, Arbeitslos, etc.)
  - **Weitere Teilnehmer:** Entity-Reference für Familienmitglieder/Freunde
- **OHNE ADESSOCMS:** Backend-Dev erstellt Custom-Fields (~1.5 PT) + Validation-Logic (~1 PT) + Encryption (~0.5 PT)
- **EINSPARUNG: ~3 PT**

**GESAMT BASELINE-EINSPARUNG: ~8.2 PT** (konservativ auf 7.5 PT heruntergerechnet)

### KI-Einsparung

✅ **KI generiert:**
- Form-Validations
- Custom-Fields-Konfiguration
- User-Profile-Templates

**Einsparung durch KI:** ~20 Stunden

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Schnell-Registrierung** | 2 PT | 1 PT | Form-API vorhanden |
| **Social Login-Integration** | 3 PT | 1.5 PT | Module vorhanden, nur Config |
| **Login/Logout** | 1 PT | 0.2 PT | Core-Funktionalität |
| **Passwort vergessen** | 1 PT | 0.2 PT | Core-Funktionalität |
| **Profil-Verwaltung** | 5 PT | 2.5 PT | Custom-Fields + Multi-User |
| **Bankdaten-Handling** | 3 PT | 1.5 PT | Sensible Daten, Verschlüsselung |
| **GESAMT** | **15 PT** | **7 PT** | **-53% (8 PT Einsparung)** |

**Realistischer Aufwand:** 7 PT = **7 PT**

---

## Position 1.8: Buchung

### Ausschreibungs-Vorgabe

**Umfang:** 30 Arbeitstage á 8 Stunden = **240 Stunden**
**Beschreibung:**
- Buchung als Multi-Step-Prozess inkl. Buchungen auf Warteliste

### adessoCMS-Baseline: Was bringen wir mit?

✅ **[Drupal Commerce 2.x](https://www.drupal.org/project/commerce) - E-Commerce-Framework komplett integriert:**
- **WARUM SPART DAS ZEIT:** Commerce ist production-ready E-Commerce-System, keine Custom-Entwicklung nötig
- **WAS IST FERTIG:**
  - **Multi-Step-Checkout:** Konfigurierbare Checkout-Flow (Login → Teilnehmer → Zahlung → Review → Complete)
  - **Order-Entity:** Bestellungen mit State-Machine (Draft → Pending → Processing → Completed)
  - **Product-Entity:** Kurse als Commerce-Products modelliert
  - **Cart-System:** Session-basierter Warenkorb (Anonymous + Authenticated)
  - **Price-System:** Flexible Preisgestaltung (Basis-Preis, Ermäßigungen, Promocodes)
  - **Tax-System:** MwSt.-Berechnung (19% Standard, 0% für Bildung falls freigestellt)
- **OHNE ADESSOCMS:** Backend-Dev baut E-Commerce-System von Grund auf (~25 PT) oder nutzt WooCommerce/Shopify-API (~10 PT)
- **EINSPARUNG: ~10 PT**

✅ **State-Machine für Buchungs-Workflow:**
- **WARUM SPART DAS ZEIT:** State-Transitions sind bereits implementiert und validiert
- **WAS IST FERTIG:**
  - **Order States:** Draft → Pending-Payment → Payment-Received → Confirmed → Completed → Cancelled
  - **State-Transitions:** Validierung bei jedem State-Change (z.B. nur mit Payment zu Confirmed)
  - **Event-System:** Hooks bei State-Changes (z.B. E-Mail bei Bestätigung)
  - **Refund-Flow:** Stornierung mit automatischem Refund-Request
- **OHNE ADESSOCMS:** Backend-Dev implementiert State-Machine manuell (~3 PT) + Validations (~1 PT)
- **EINSPARUNG: ~4 PT**

✅ **Wartelisten-Pattern mit [Commerce Waitlist](https://www.drupal.org/project/commerce_waitlist) (oder Custom):**
- **WARUM SPART DAS ZEIT:** Wartelisten-Logic ist komplex (Benachrichtigungen bei freiem Platz)
- **WAS IST FERTIG:**
  - **Waitlist-Entity:** Wartelisten-Einträge mit Priority-Queue
  - **Auto-Notification:** E-Mail bei freiem Platz (Cron-basiert)
  - **Conversion-Flow:** "Von Warteliste buchen"-Button (wenn Platz frei)
  - **Waitlist-Expiry:** Automatisches Entfernen nach X Tagen ohne Buchung
- **OHNE ADESSOCMS:** Backend-Dev baut Wartelisten-System (~5 PT) + Notification-Logic (~1.5 PT)
- **EINSPARUNG: ~6.5 PT**

**GESAMT BASELINE-EINSPARUNG: ~20.5 PT** (konservativ auf 12.5 PT heruntergerechnet)

### KI-Einsparung

✅ **KI generiert:**
- Checkout-Steps
- State-Transitions
- Validation-Rules

**Einsparung durch KI:** ~36 Stunden

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Multi-Step-Checkout** | 10 PT | 5 PT | Commerce-Module vorhanden |
| **Wartelisten-Logik** | 7.5 PT | 4 PT | Custom-State-Machine |
| **Teilnehmer-Handling** | 5 PT | 2.5 PT | Multi-User-Buchungen |
| **API-Sync (Buchung → IM)** | 5 PT | 1.5 PT | HTTP-Client fertig |
| **GESAMT** | **27.5 PT** | **13 PT** | **-53% (14.5 PT Einsparung)** |

**Realistischer Aufwand:** 13 PT = **13 PT**

---

## Position 1.9: Payment

### Ausschreibungs-Vorgabe

**Umfang:** 16,2 Arbeitstage á 8 Stunden = **129,6 Stunden**
**Beschreibung:**
- SEPA-Lastschrift
- Kreditkarte
- PayPal
- Rechnung

### adessoCMS-Baseline: Was bringen wir mit?

✅ **[Commerce Payment](https://www.drupal.org/project/commerce) - Payment-Gateway-Architecture (Teil von Drupal Commerce):**
- **WARUM SPART DAS ZEIT:** Payment-Integration ist extrem komplex, Commerce macht es einfach
- **WAS IST FERTIG:**
  - **Payment-Gateway-Plugin-System:** Drupal-Plugin-System für Payment-Provider
  - **Order-Payment-Integration:** Payment-Entities verknüpft mit Orders
  - **Transaction-Logging:** Alle Transaktionen werden geloggt (für Accounting/Debugging)
  - **Payment-State-Machine:** Pending → Authorized → Captured → Refunded
  - **Multi-Payment-Support:** Ein Order kann mehrere Payments haben (z.B. Teilzahlung + Gutschein)
  - **PCI-DSS-Compliance:** Keine Kreditkarten-Daten auf Server (nur Tokens)
- **OHNE ADESSOCMS:** Backend-Dev baut Payment-System von Grund auf (~10 PT) oder integriert Stripe-API manuell (~4 PT)
- **EINSPARUNG: ~4 PT**

✅ **Payment-Provider-Module fertig integriert:**
- **WARUM SPART DAS ZEIT:** Module sind production-ready, nur API-Keys nötig
- **WAS IST FERTIG:**
  - **[Commerce Stripe](https://www.drupal.org/project/commerce_stripe):** Kreditkarten-Payment via Stripe (Visa, Mastercard, Amex)
  - **[Commerce PayPal](https://www.drupal.org/project/commerce_paypal):** PayPal-Express-Checkout + PayPal-Standard
  - **[Commerce Invoice/Manual](https://www.drupal.org/docs/contributed-modules/commerce-2x/payment-gateways/manual):** Rechnung/Überweisung (manuell freischalten)
  - Alle Module mit **Sandbox-Mode** für Testing
- **OHNE ADESSOCMS:** Backend-Dev integriert jeden Provider einzeln (~1.5 PT pro Provider × 3 = 4.5 PT)
- **EINSPARUNG: ~4.5 PT**

✅ **SEPA-Lastschrift-Integration (Custom oder [Commerce SEPA](https://www.drupal.org/project/commerce_sepa)):**
- **WARUM SPART DAS ZEIT:** SEPA-Mandate-Handling ist komplex (DSGVO, Fristen, Widerruf)
- **WAS MUSS GEBAUT WERDEN:**
  - **SEPA-Mandate-Entity:** Speicherung von IBAN, BIC, Mandate-Reference
  - **Mandate-PDF-Generation:** PDF mit Mandatstext zum Download
  - **Pre-Notification:** E-Mail X Tage vor Abbuchung (SEPA-Vorschrift)
  - **Batch-Export:** XML-Datei für Bank (SEPA-PAIN-Format)
- **BASELINE-VORTEIL:** Commerce-Payment-Architecture ist bereits fertig, nur SEPA-Gateway muss gebaut werden
- **OHNE ADESSOCMS:** Komplett Custom-Development (~5 PT)
- **MIT adessoCMS:** Custom-Gateway auf Commerce-Basis (~2 PT)
- **EINSPARUNG: ~3 PT**

**GESAMT BASELINE-EINSPARUNG: ~11.5 PT** (konservativ auf 7.5 PT heruntergerechnet)

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **SEPA-Lastschrift** | 4 PT | 2 PT | Custom-Gateway nötig |
| **Kreditkarte (Stripe)** | 3 PT | 1 PT | Stripe-Modul vorhanden |
| **PayPal** | 2.5 PT | 1 PT | PayPal-Modul vorhanden |
| **Rechnung** | 2 PT | 1 PT | Invoice-Workflow |
| **Testing & Security** | 3 PT | 2.5 PT | Security-Review manuell |
| **GESAMT** | **14.5 PT** | **7.5 PT** | **-48% (7 PT Einsparung)** |

**Realistischer Aufwand:** 7.5 PT = **7,5 PT**

### Tagessatz-Berechnung Position 1.9

| Szenario | Effektiver TS | Realer Aufwand | Effektive Kosten | Ausschreibung | Angebots-TS |
|----------|---------------|----------------|------------------|---------------|-------------|
| **A** | €850 | 7,5 PT | €6.375 | 16,2 PT | **€394** |
| **B** | €900 | 7,5 PT | €6.750 | 16,2 PT | **€417** |
| **C** | €950 | 7,5 PT | €7.125 | 16,2 PT | **€440** |
| **D** | €1.000 | 7,5 PT | €7.500 | 16,2 PT | **€463** |

**Beispiel Szenario C:** Wir bieten **€440/Tag** an, arbeiten aber nur 7,5 PT (statt 16,2 PT) und verdienen effektiv **€950/Tag**

**Empfehlung:** Szenario C (€950 effektiv) - Angebot €440/Tag für Payment-Integration (Security-kritisch)

---

## Position 1.10: Gutscheine

### Ausschreibungs-Vorgabe

**Umfang:** 14,4 Arbeitstage á 8 Stunden = **115,2 Stunden**
**Beschreibung:**
- Gutscheine (Inkl. Verwaltung im Profil)
- Promocodes

### adessoCMS-Baseline: Was bringen wir mit?

✅ **[Commerce Promotion](https://www.drupal.org/docs/commerce/commerce-2x/product-merchandising/promotions) - Gutschein-System (Teil von Drupal Commerce):**
- **WARUM SPART DAS ZEIT:** Promotion-Engine ist extrem flexibel und production-ready
- **WAS IST FERTIG:**
  - **Promotion-Entity:** Gutscheine, Promocodes, automatische Rabatte
  - **Coupon-Entity:** Individuelle Codes (SUMMER2024, STUDENT10, etc.)
  - **Discount-Rules-Engine:** Flexible Rabatt-Regeln (%, €, Buy-X-Get-Y, etc.)
  - **Promotion-Types:**
    - **Order-Promotion:** Rabatt auf Gesamtbestellung (z.B. "10% ab 100€")
    - **Product-Promotion:** Rabatt auf bestimmte Kurse/Kategorien
    - **Shipping-Promotion:** Versandkosten-Rabatt (hier nicht relevant)
  - **Conditions:** Zeitraum, Min-Bestellwert, Kategorien, User-Rollen, Custom-Conditions
  - **Usage-Limits:** Max-Anzahl Verwendungen pro Code, pro User
- **OHNE ADESSOCMS:** Backend-Dev baut Gutschein-System von Grund auf (~7.5 PT)
- **EINSPARUNG: ~7.5 PT**

✅ **Gutschein-Verwaltung im User-Profil:**
- **WAS IST FERTIG:**
  - **Promotion-History:** User sehen verwendete Gutscheine in Bestellhistorie
  - **Available-Promotions:** Anzeige verfügbarer Gutscheine (z.B. "Student-Rabatt verfügbar")
  - **Coupon-Redemption:** Gutschein-Code-Eingabe im Checkout
  - **Coupon-Validation:** Echtzeit-Prüfung ob Code gültig ist (AJAX)
- **OHNE ADESSOCMS:** Backend-Dev baut UI für Gutschein-Verwaltung (~2 PT) + AJAX-Validation (~1 PT)
- **EINSPARUNG: ~3 PT**

✅ **Gutschein-Generierung & Bulk-Import:**
- **WAS IST FERTIG:**
  - **Coupon-Generator:** Automatische Generierung von X unique Codes
  - **CSV-Import:** Bulk-Import von Gutschein-Codes
  - **Expiry-Management:** Automatisches Deaktivieren abgelaufener Gutscheine (Cron)
  - **Usage-Reporting:** View mit Gutschein-Statistiken (Anzahl Verwendungen, Umsatz, etc.)
- **OHNE ADESSOCMS:** Backend-Dev baut Gutschein-Generator (~1.5 PT) + Reporting (~1 PT)
- **EINSPARUNG: ~2.5 PT**

**GESAMT BASELINE-EINSPARUNG: ~13 PT** (konservativ auf 7.5 PT heruntergerechnet)

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Gutschein-System** | 5 PT | 2 PT | Promotion-Module vorhanden |
| **Promocode-Logik** | 4 PT | 1.5 PT | Rules-Engine fertig |
| **Profil-Verwaltung** | 3 PT | 2 PT | UI-Integration |
| **Validation** | 2 PT | 1 PT | KI-generierte Rules |
| **GESAMT** | **14 PT** | **6.5 PT** | **-54% (7.5 PT Einsparung)** |

**Realistischer Aufwand:** 6.5 PT = **6,5 PT**

---

## Positionen 1.11-1.12: Merkliste & Warenkorb

### Ausschreibungs-Vorgabe (jeweils)

**Umfang pro Position:** 5,4 Arbeitstage á 8 Stunden = **43,2 Stunden**

**Position 1.11 - Merkliste:**
- Listung der Merkliste
- Hinzufügen zur Merkliste
- Löschen von der Merkliste

**Position 1.12 - Warenkorb:**
- Listung des Warenkorbs
- Hinzufügen zum Warenkorb
- Löschen aus dem Warenkorb

### adessoCMS-Baseline: Was bringen wir mit?

✅ **[Flag](https://www.drupal.org/project/flag) - Wishlist/Merkliste-System komplett fertig:**
- **WARUM SPART DAS ZEIT:** Flag-Modul macht "Favoriten/Merkliste" trivial
- **WAS IST FERTIG:**
  - **Flag-Type "Wishlist":** User können Kurse als Favoriten markieren
  - **Flag-Link:** "Zur Merkliste hinzufügen/entfernen"-Button mit AJAX
  - **Wishlist-View:** "/meine-merkliste" mit Übersicht aller gemerkten Kurse
  - **Flag-Counter:** Zeigt Anzahl gemerkter Kurse (z.B. im Header "♥ 3")
  - **Anonymous-Support:** Session-basierte Merkliste für nicht-angemeldete User
- **OHNE ADESSOCMS:** Backend-Dev baut Custom-Entity für Merkliste (~2 PT) + AJAX-Forms (~1 PT) + Views (~0.5 PT)
- **EINSPARUNG: ~3.5 PT**

✅ **[Commerce Cart](https://www.drupal.org/project/commerce) - Warenkorb-System (Teil von Drupal Commerce):**
- **WARUM SPART DAS ZEIT:** Commerce-Cart ist production-ready mit Session-Handling
- **WAS IST FERTIG:**
  - **Cart-Entity:** Order-Entity mit "Draft"-State = Warenkorb
  - **Add-to-Cart-Forms:** AJAX-basiertes "In den Warenkorb"-Formular
  - **Cart-Block:** Warenkorb-Widget (z.B. im Header) mit Artikel-Count und Gesamt-Preis
  - **Cart-Page:** "/warenkorb" mit Liste aller Artikel, Mengen-Änderung, Entfernen-Button
  - **Mini-Cart:** Flyout-Cart mit Quick-Checkout-Button
  - **Cart-Validation:** Max-Teilnehmerzahl prüfen, Doppelbuchungen verhindern
- **OHNE ADESSOCMS:** Backend-Dev baut Cart-System (~2.5 PT) + AJAX-Integration (~1 PT) + Validation (~0.5 PT)
- **EINSPARUNG: ~4 PT**

**GESAMT BASELINE-EINSPARUNG pro Position: ~3.8 PT** (Merkliste 3.5 PT, Warenkorb 4 PT - Durchschnitt 3.8 PT)

### Realistischer Aufwand (jeweils)

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Entity-Setup** | 1.5 PT | 0.2 PT | Module vorhanden |
| **Liste anzeigen** | 1 PT | 0.5 PT | View-Template |
| **Hinzufügen/Löschen** | 1.5 PT | 0.8 PT | AJAX-Forms |
| **UI-Integration** | 1 PT | 0.5 PT | Block-Templates |
| **GESAMT** | **5 PT** | **2 PT** | **-60% (3 PT Einsparung)** |

**Realistischer Aufwand pro Position:** 2 PT = **2 PT**

---

## Position 1.13: Reservierung

### Ausschreibungs-Vorgabe

**Umfang:** 5,4 Arbeitstage á 8 Stunden = **43,2 Stunden**
**Beschreibung:**
- Listung der Reservierungen
- Hinzufügen zur Reservierung
- Löschen von der Reservierung

### Realistischer Aufwand

Ähnlich wie Merkliste, aber mit State-Machine (Reservierung hat Ablaufzeit):

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Reservierungs-Entity** | 2 PT | 0.8 PT | Custom-Entity + State |
| **Timeout-Handling** | 1.5 PT | 1 PT | Cron-Jobs |
| **UI-Integration** | 1.5 PT | 0.8 PT | Forms + Views |
| **GESAMT** | **5 PT** | **2.5 PT** | **-50% (2.5 PT Einsparung)** |

**Realistischer Aufwand:** 2.5 PT = **2,5 PT**

---

## Position 1.14: Meine Kurse

### Ausschreibungs-Vorgabe

**Umfang:** 9,6 Arbeitstage á 8 Stunden = **76,8 Stunden**
**Beschreibung:**
- Listung meiner Kurse (Gruppiert / sortiert nach Zeit, inkl. Filterung und Kursen auf Warteliste)
- Download von Dokumenten
- Stornierung

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Kurs-Übersicht (View)** | 3 PT | 1.5 PT | View-Templates vorhanden |
| **Filterung/Sortierung** | 2 PT | 1 PT | Exposed-Filters |
| **Dokument-Download** | 1.5 PT | 0.5 PT | File-Field-Integration |
| **Stornierung** | 2.5 PT | 1.5 PT | State-Transition + Refund |
| **GESAMT** | **9 PT** | **4.5 PT** | **-50% (4.5 PT Einsparung)** |

**Realistischer Aufwand:** 4.5 PT = **4,5 PT**

---

## Position 1.15: Kursalarm

### Ausschreibungs-Vorgabe

**Umfang:** 5,4 Arbeitstage á 8 Stunden = **43,2 Stunden**
**Beschreibung:**
- Listung der Kursalarme
- Hinzufügen der Kursalarme
- Löschen der Kursalarme

### Realistischer Aufwand

Ähnlich wie Merkliste + Notification-Trigger:

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Alarm-Entity** | 1.5 PT | 0.5 PT | Flag-Pattern |
| **E-Mail-Trigger** | 2 PT | 1 PT | Rules/Message-System |
| **UI-Integration** | 1.5 PT | 0.5 PT | Forms |
| **GESAMT** | **5 PT** | **2 PT** | **-60% (3 PT Einsparung)** |

**Realistischer Aufwand:** 2 PT = **2 PT**

---

## Position 1.16: Newsletter

### Ausschreibungs-Vorgabe

**Umfang:** 2,4 Arbeitstage á 8 Stunden = **19,2 Stunden**
**Beschreibung:**
- Anmeldung
- Abmeldung

### adessoCMS-Baseline: Was bringen wir mit?

✅ **[Simplenews](https://www.drupal.org/project/simplenews) - Enterprise Newsletter-System komplett fertig:**
- **WARUM SPART DAS ZEIT:** Komplettes Newsletter-Management out-of-the-box, DSGVO-konform
- **WAS IST FERTIG:**
  - **Newsletter-Kategorien:** Multi-Newsletter-Support (z.B. "Kurse", "Events", "News")
  - **Subscription-Management:** User können Newsletter selbst verwalten (An-/Abmeldung)
  - **Double-Opt-In:** Automatische Bestätigungs-E-Mail mit Aktivierungs-Link (DSGVO-konform)
  - **Unsubscribe-Links:** Automatische "Abmelden"-Links in jeder E-Mail
  - **Newsletter-Queue:** Batch-Processing für große Empfänger-Listen (verhindert Server-Timeout)
  - **Newsletter-Archiv:** Automatisches Web-Archiv aller versendeten Newsletter
  - **Subscriber-Import/Export:** CSV-Import/Export für Subscriber-Listen
  - **Tracking:** Opt-In für Öffnungsraten und Klick-Tracking
- **OHNE ADESSOCMS:** Backend-Dev baut Custom-Newsletter-System (~5 PT) oder integriert Mailchimp-API (~2.5 PT)
- **EINSPARUNG: ~2.5 PT** (konservativ, da Custom-Lösung viel aufwändiger wäre)

✅ **Newsletter-Templates & Design:**
- **WAS IST FERTIG:**
  - Responsive HTML-E-Mail-Templates (funktioniert in allen E-Mail-Clients)
  - Tailwind-CSS-basiertes Design (passt zu Website-Design)
  - Header mit Logo, Footer mit Social-Links und Abmelde-Link
  - Content-Blöcke für verschiedene Newsletter-Typen (Text, Image, CTA, Event-List)
- **OHNE ADESSOCMS:** Frontend-Dev erstellt E-Mail-Templates (~1.5 PT) + testet in allen Clients (~0.5 PT)
- **EINSPARUNG: ~2 PT**

✅ **Subscription-Forms integriert:**
- **WAS IST FERTIG:**
  - Subscription-Block (kann in Sidebar/Footer platziert werden)
  - Dedicated Subscription-Page (/newsletter/subscribe)
  - Inline-Subscription-Forms (als Paragraph für Landing-Pages)
  - User-Profile-Integration (Newsletter-Preferences im Profil)
- **OHNE ADESSOCMS:** Frontend-Dev baut Subscription-Forms (~1 PT) + Integration (~0.5 PT)
- **EINSPARUNG: ~1.5 PT**

**GESAMT BASELINE-EINSPARUNG: ~6 PT** (konservativ auf 1.5 PT heruntergerechnet, da Simplenews extrem mächtig ist)

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Newsletter-Integration** | 1.5 PT | 0.5 PT | Simplenews vorhanden |
| **An/Abmeldung** | 0.8 PT | 0.5 PT | Forms + Validation |
| **GESAMT** | **2.2 PT** | **1 PT** | **-56% (1.2 PT Einsparung)** |

**Realistischer Aufwand:** 1 PT = **1 PT**

---

## Position 1.17: Kursleiterportal

### Ausschreibungs-Vorgabe

**Umfang:** 24 Arbeitstage á 8 Stunden = **192 Stunden**
**Beschreibung:**
- Profil
- Listung meiner Kurse (Gruppiert / sortiert nach Zeit, inkl. Filterung)
- Dokumentenverwaltung
- Teilnehmer-Management
- Teilnehmer-Benachrichtigungen
- Terminplanung

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Kursleiter-Profil** | 3 PT | 1.5 PT | User-Profile-Extension |
| **Kurs-Übersicht** | 4 PT | 2 PT | View + Dashboard |
| **Dokumentenverwaltung** | 3 PT | 1.5 PT | File-Management |
| **Teilnehmer-Management** | 5 PT | 2.5 PT | Custom-Entity-Reference |
| **Benachrichtigungen** | 3 PT | 1.5 PT | Message-System |
| **Terminplanung** | 4 PT | 2 PT | Calendar-Integration |
| **GESAMT** | **22 PT** | **11 PT** | **-50% (11 PT Einsparung)** |

**Realistischer Aufwand:** 11 PT = **11 PT**

---

## Position 1.18: Export von Kursen

### Ausschreibungs-Vorgabe

**Umfang:** 3 Arbeitstage á 8 Stunden = **24 Stunden**
**Beschreibung:**
- Export der Kurse als PDF (Liste)

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **PDF-Library-Integration** | 1 PT | 0.2 PT | TCPDF/Dompdf |
| **Template erstellen** | 1.5 PT | 0.5 PT | KI generiert Basis |
| **View-Integration** | 0.5 PT | 0.2 PT | Export-Button |
| **GESAMT** | **3 PT** | **1 PT** | **-67% (2 PT Einsparung)** |

**Realistischer Aufwand:** 1 PT = **1 PT**

---

## Position 1.19: Notification Center

### Ausschreibungs-Vorgabe

**Umfang:** 7,8 Arbeitstage á 8 Stunden = **62,4 Stunden**
**Beschreibung:**
- Interface für Benachrichtigungen
- Ausgabe der Benachrichtigungen auf Seite
- Push-Benachrichtigungen (Inkl. Anbindung eines Notification-Providers)

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Notification-Entity** | 2 PT | 1 PT | Message-System erweitern |
| **UI-Interface** | 2 PT | 1 PT | Block + AJAX |
| **Push-Integration (Firebase)** | 3 PT | 1.5 PT | SDK-Integration |
| **GESAMT** | **7 PT** | **3.5 PT** | **-50% (3.5 PT Einsparung)** |

**Realistischer Aufwand:** 3.5 PT = **3,5 PT**

---

## Position 1.20: Chatbot / Support-Anfragen

### Ausschreibungs-Vorgabe

**Umfang:** 13,8 Arbeitstage á 8 Stunden = **110,4 Stunden**
**Beschreibung:**
- Einbindung des Chatbots
- Anlegen von Anfragen
- Listung meiner Anfragen
- Antworten auf Anfragen

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Chatbot-Widget-Integration** | 2 PT | 1 PT | JavaScript-SDK |
| **Support-Ticket-System** | 5 PT | 2.5 PT | Custom-Entity + Webform |
| **Ticket-Übersicht** | 2 PT | 1 PT | View |
| **Antwort-Handling** | 3 PT | 2 PT | Comment-System |
| **GESAMT** | **12 PT** | **6.5 PT** | **-46% (5.5 PT Einsparung)** |

**Realistischer Aufwand:** 6.5 PT = **6,5 PT**

---

## Position 1.21: Analytics

### Ausschreibungs-Vorgabe

**Umfang:** 12 Arbeitstage á 8 Stunden = **96 Stunden**
**Beschreibung:**
- Basisdaten
- eCommerce Reports (Warenkörbe, Merkzettel, Checkout, Newsletter, Suchen, Kursempfehlungen, Kursleiterprofile, CMS-Elemente)

### adessoCMS-Baseline

✅ **Google Analytics 4:**
- GA4-Modul
- E-Commerce-Tracking
- Custom-Events

**Einsparung durch Baseline:** ~40 Stunden

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **GA4-Setup** | 2 PT | 0.5 PT | Modul vorhanden |
| **eCommerce-Events** | 5 PT | 2 PT | Event-Tracking-Layer |
| **Custom-Dashboard** | 4 PT | 2 PT | Views + Charts |
| **GESAMT** | **11 PT** | **4.5 PT** | **-59% (6.5 PT Einsparung)** |

**Realistischer Aufwand:** 4.5 PT = **4,5 PT**

---

## Position 1.22: Logging

### Ausschreibungs-Vorgabe

**Umfang:** 2,4 Arbeitstage á 8 Stunden = **19,2 Stunden**
**Beschreibung:**
- Zentrale Fehlerüberwachung (Integration und Konfiguration eines Logging-Services)

### adessoCMS-Baseline

✅ **Sentry-Integration:**
- Error-Tracking fertig
- Drupal-Sentry-Modul

**Einsparung durch Baseline:** ~12 Stunden

### Realistischer Aufwand

| Aktivität | Traditionell | Mit adessoCMS + KI | Begründung |
|-----------|--------------|-------------------|------------|
| **Sentry-Integration** | 1.5 PT | 0.5 PT | Modul vorhanden |
| **Konfiguration** | 0.8 PT | 0.5 PT | Project-Setup |
| **GESAMT** | **2.2 PT** | **1 PT** | **-56% (1.2 PT Einsparung)** |

**Realistischer Aufwand:** 1 PT = **1 PT**

---

## GESAMT-ÜBERSICHT: Alle 22 Positionen

**Tabelle zeigt:** Was können wir anbieten, wenn wir effektiv €900/Tag verdienen wollen?

| Nr. | Position | Ausschreibung (PT) | Realistisch (PT) | Einsparung (PT) | % | Angebots-TS (@ €900 effektiv) |
|-----|----------|-------------------|------------------|-----------------|---|-------------------------------|
| 1.1 | Kick-off | 6,0 | 4,0 | 2,0 | 33% | €600 |
| 1.2 | Layout | 16,8 | 8,0 | 8,8 | 52% | €429 |
| 1.3 | Setup & PM | 109,0 | 63,0 | 46,0 | 42% | €520 |
| 1.4 | API/SDK | 53,4 | 29,0 | 24,4 | 46% | €489 |
| 1.5 | CMS | 61,6 | 18,0 | 43,6 | 71% | €263 |
| 1.6 | Kurssuche | 24,0 | 10,0 | 14,0 | 58% | €375 |
| 1.7 | Account | 16,8 | 7,0 | 9,8 | 58% | €375 |
| 1.8 | Buchung | 30,0 | 13,0 | 17,0 | 57% | €390 |
| 1.9 | Payment | 16,2 | 7,5 | 8,7 | 54% | €417 |
| 1.10 | Gutscheine | 14,4 | 6,5 | 7,9 | 55% | €406 |
| 1.11 | Merkliste | 5,4 | 2,0 | 3,4 | 63% | €333 |
| 1.12 | Warenkorb | 5,4 | 2,0 | 3,4 | 63% | €333 |
| 1.13 | Reservierung | 5,4 | 2,5 | 2,9 | 54% | €417 |
| 1.14 | Meine Kurse | 9,6 | 4,5 | 5,1 | 53% | €422 |
| 1.15 | Kursalarm | 5,4 | 2,0 | 3,4 | 63% | €333 |
| 1.16 | Newsletter | 2,4 | 1,0 | 1,4 | 58% | €375 |
| 1.17 | Kursleiterportal | 24,0 | 11,0 | 13,0 | 54% | €413 |
| 1.18 | Export | 3,0 | 1,0 | 2,0 | 67% | €300 |
| 1.19 | Notification | 7,8 | 3,5 | 4,3 | 55% | €404 |
| 1.20 | Chatbot | 13,8 | 6,5 | 7,3 | 53% | €424 |
| 1.21 | Analytics | 12,0 | 4,5 | 7,5 | 63% | €338 |
| 1.22 | Logging | 2,4 | 1,0 | 1,4 | 58% | €375 |
| **SUMME** | **Gruppe 1** | **445,8** | **208,0** | **237,8** | **53%** | **€420** |

---

## Zusammenfassung der Einsparungen

### Nach Kategorie:

| Kategorie | Ausschreibung | Realistisch | Einsparung | % |
|-----------|---------------|-------------|------------|---|
| **Infrastruktur (1.1-1.3, 1.5)** | 193,4 PT | 93,0 PT | 100,4 PT | 52% |
| **API & Integration (1.4)** | 53,4 PT | 29,0 PT | 24,4 PT | 46% |
| **Search & Content (1.6)** | 24,0 PT | 10,0 PT | 14,0 PT | 58% |
| **User & Account (1.7)** | 16,8 PT | 7,0 PT | 9,8 PT | 58% |
| **Booking & Payment (1.8-1.10)** | 60,6 PT | 27,0 PT | 33,6 PT | 55% |
| **User Features (1.11-1.16)** | 35,4 PT | 16,0 PT | 19,4 PT | 55% |
| **Portal & Tools (1.17-1.22)** | 62,2 PT | 26,0 PT | 36,2 PT | 58% |
| **GESAMT** | **445,8 PT** | **208,0 PT** | **237,8 PT** | **53%** |

### Top 5 Einsparungen (absolut):

1. **Position 1.3 (Setup & PM):** 46,0 PT gespart (42%)
2. **Position 1.5 (CMS):** 43,6 PT gespart (71%) ⭐ **Größte %**
3. **Position 1.4 (API/SDK):** 24,4 PT gespart (46%)
4. **Position 1.8 (Buchung):** 17,0 PT gespart (57%)
5. **Position 1.6 (Kurssuche):** 14,0 PT gespart (58%)

### Geringste Einsparungen:

1. **Position 1.1 (Kick-off):** 2,0 PT (33%) - Meetings bleiben manuell
2. **Position 1.18 (Export):** 2,0 PT (67%) - Kleine Position
3. **Position 1.16 (Newsletter):** 1,4 PT (58%) - Kleine Position

---

## Finaler Angebotsvorschlag

**Basierend auf Szenario B (€900/Tag):**

```
ENTWICKLUNG (Gruppe 1):
  Rohaufwand:           205 PT × €900 = €184.500
  + Risiko-Puffer (20%): 41 PT × €900 =  €36.900
  + PM-Puffer (10%):     21 PT × €900 =  €18.900
  ────────────────────────────────────────────────
  Subtotal Entwicklung: 267 PT × €900 = €240.300

WARTUNG (3 Jahre):      120 PT × €900 = €108.000
────────────────────────────────────────────────
GESAMTANGEBOT:          387 PT       = €348.300
```

**Vergleich mit Ausschreibungs-Budget:**
- Ausschreibung: 565,8 PT × €850 = €480.930
- Unser Angebot: €348.300
- **Einsparung: €132.630 (28%)**

**Durchschnittlicher optimierter Tagessatz: €414**
(Wir arbeiten zum effektiven Preis von €414/Tag und bieten zu €900/Tag an)

---

**DOKUMENT KOMPLETT**
**Stand:** 2026-01-08
**Alle 22 Positionen analysiert**
