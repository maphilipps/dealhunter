# Dealhunter Workflow

> Vollständiger End-to-End Prozess von der Kundenanfrage bis zur Team-Benachrichtigung

---

## Workflow-Übersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEALHUNTER WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ UPLOAD  │───▶│  QUICK  │───▶│ BIT/NO  │───▶│   BL    │───▶│  FULL   │
  │    &    │    │  SCAN   │    │   BIT   │    │ ROUTING │    │ WEBSITE │
  │EXTRAKT. │    │         │    │         │    │         │    │  SCAN   │
  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
       │              │              │              │              │
       ▼              ▼              ▼              ▼              ▼
   Dokumente     Tech Stack     Bewertung      Zuweisung     Vollständige
   analysieren   erkennen       erstellen      an BL         Analyse
                 BL empfehlen

                                                              │
                                                              ▼
  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────────────────┐
  │ NOTIFY  │◀───│  TEAM   │◀───│ PROJEKT │◀───│      BASELINE           │
  │  TEAM   │    │ ASSIGN  │    │ PLANUNG │    │      VERGLEICH          │
  └─────────┘    └─────────┘    └─────────┘    └─────────────────────────┘
       │              │              │                    │
       ▼              ▼              ▼                    ▼
   E-Mail +       Optimales     Timeline &          Was haben wir?
   PDF senden     Team          Disziplinen         Was fehlt?
```

---

## Phase 1: Upload & Extraktion

### Beschreibung
BD Manager lädt Kundenanfrage hoch. Das System extrahiert automatisch alle relevanten Informationen.

### Input-Formate
- PDF (Ausschreibungen, RFPs, RFIs)
- E-Mail-Weiterleitungen
- CRM-Export (HubSpot, Salesforce)
- Freitext-Beschreibung

### AI-Extraktion
| Feld | Beschreibung |
|------|--------------|
| Kundenname | Name des anfragenden Unternehmens |
| Projektbeschreibung | Zusammenfassung des Vorhabens |
| Technologien | Genannte oder erkannte Technologien |
| Budget | Budgetrahmen (falls angegeben) |
| Timeline | Gewünschter Zeitrahmen |
| Scope | Umfang und Anforderungen |
| Deadline | Abgabefrist für Angebot |

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **BD Manager** | Lädt Dokument hoch, prüft Extraktion |

### Dauer
< 60 Sekunden

---

## Phase 2: Quick Scan

### Beschreibung
Automatische Analyse der Kunden-Website zur Erkennung des Tech Stacks und Empfehlung der zuständigen Business Line.

### Analyse-Umfang

| Bereich | Details |
|---------|---------|
| **CMS-Erkennung** | WordPress, Drupal, Typo3, Magnolia, Ibexa, Sulu, Firstspirit, Custom |
| **Frontend Frameworks** | React, Vue, Angular, jQuery, Vanilla JS |
| **Hosting** | AWS, Azure, Google Cloud, On-Premise |
| **Content Volume** | Seitenanzahl, URL-Patterns |
| **Features** | Formulare, Suche, E-Commerce, User Accounts |
| **Integrationen** | Analytics, CRM, Payment, Marketing Tools |

### BL-Empfehlung

```
┌─────────────────────────────────────────────────────────────┐
│ Quick Scan Result                                           │
├─────────────────────────────────────────────────────────────┤
│ Detected CMS: Drupal 10                                     │
│ Frontend: React + Tailwind                                  │
│ Hosting: AWS                                                │
├─────────────────────────────────────────────────────────────┤
│ 🎯 Empfehlung: PHP (Francesco Raaphorst)                    │
│ Confidence: 94%                                             │
│ Matched: Drupal, React                                      │
└─────────────────────────────────────────────────────────────┘
```

### Business Line Zuordnung

| Business Line | Bereichsleiter | Technologien |
|---------------|----------------|--------------|
| **PHP** | Francesco Raaphorst | Drupal, Ibexa, Sulu |
| **WEM** | Michael Rittinghaus | Magnolia, Firstspirit |

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **BD Manager** | Prüft Ergebnis, kann BL-Empfehlung überschreiben |

### Dauer
2-5 Minuten

---

## Phase 3: Bit/No Bit Bewertung

### Beschreibung
Multi-Agent System bewertet die Opportunity aus verschiedenen Perspektiven und erstellt eine fundierte Empfehlung.

### Bewertungs-Agents (Parallel)

| Agent | Fokus | Gewichtung |
|-------|-------|------------|
| **Tech Agent** | Technische Anforderungen, Komplexität, adesso-Kompetenzen | Hoch |
| **Legal Agent** | Vertragsrisiken, Haftung, Compliance, Vergaberecht | Hoch |
| **Commercial Agent** | Budget, Marge, Wirtschaftlichkeit | Hoch |
| **Competition Agent** | Bekannte Mitbieter, Win-Wahrscheinlichkeit | Mittel |
| **Reference Agent** | Passende Referenzprojekte | Mittel |
| **Capability Agent** | Verfügbare Skills und Kapazitäten | Hoch |

### Coordinator Agent (Sequenziell)
Führt alle Teil-Analysen zusammen und erstellt:
- **Entscheidungsbaum** mit allen Faktoren
- **Pro/Contra** Argumente
- **Red Flags** (kritische Warnsignale)
- **Finale Empfehlung** (Bit / No Bit)

### Red Flag Detection

| Kategorie | Beispiele |
|-----------|-----------|
| **Budget** | "50% unter Marktdurchschnitt" |
| **Timeline** | "Go-Live in 6 Wochen unrealistisch" |
| **Legal** | "Unbegrenzte Haftungsklausel" |
| **Technical** | "Legacy-System ohne API" |

### Output

```
┌─────────────────────────────────────────────────────────────┐
│ Bit/No Bit Empfehlung                                       │
├─────────────────────────────────────────────────────────────┤
│ 🟢 BIT - Empfehlung: Anbieten                               │
│ Confidence: 78%                                             │
├─────────────────────────────────────────────────────────────┤
│ ✅ Pro:                                                     │
│    • Drupal-Expertise vorhanden                             │
│    • Ähnliche Referenzprojekte                              │
│    • Realistisches Budget                                   │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Contra:                                                  │
│    • Enge Timeline (3 Monate)                               │
│    • Komplexe Legacy-Integration                            │
├─────────────────────────────────────────────────────────────┤
│ 🚩 Red Flags:                                               │
│    • Pönale bei Verzug: 2% pro Woche                        │
└─────────────────────────────────────────────────────────────┘
```

### Bei "No Bit"
- Alternative BL-Empfehlung (falls andere BL besser passt)
- Begründung im Entscheidungsbaum

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **BD Manager** | Prüft Bewertung, trifft finale Entscheidung |

### Dauer
5-15 Minuten

---

## Phase 4: BL-Routing

### Beschreibung
Nach positiver Bit-Entscheidung wird die Opportunity dem zuständigen Bereichsleiter zugewiesen.

### Routing-Logik

```
                    ┌─────────────────┐
                    │ Quick Scan      │
                    │ Tech Stack      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Drupal   │   │ Magnolia │   │ Unknown  │
        │ Ibexa    │   │ First-   │   │          │
        │ Sulu     │   │ spirit   │   │          │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │              │              │
             ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │   PHP    │   │   WEM    │   │ Manuelle │
        │(Francesco│   │(Michael) │   │ Zuweisung│
        └──────────┘   └──────────┘   └──────────┘
```

### BD kann überschreiben
- AI-Empfehlung ist Vorschlag
- BD kann anderen BL wählen
- Override wird mit Begründung im Audit Trail geloggt

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **BD Manager** | Bestätigt oder überschreibt BL-Zuweisung |
| **Bereichsleiter** | Wird benachrichtigt über neue Opportunity |

### Dauer
< 1 Minute (User-Aktion)

---

## Phase 5: Full Website Scan

### Beschreibung
Umfassende Analyse der Kunden-Website nach BL-Zuweisung. Sammelt ALLE relevanten Informationen für Angebotserstellung und Projektplanung.

### Trigger
- Automatisch nach `bitDecision: 'bit'` UND `assignedBusinessLineId` gesetzt
- Läuft als Background Job

### Analyse-Bereiche

#### 5.1 Content Architecture
| Element | Analyse |
|---------|---------|
| **Page Types** | Startseite, Produktseiten, Blog, Kontakt, etc. |
| **Content Types** | Strukturierte Inhaltstypen |
| **Taxonomien** | Kategorien, Tags, Hierarchien |
| **Media Types** | Bilder, Videos, Downloads, Dokumente |
| **Content Volume** | Anzahl Seiten pro Typ |

#### 5.2 Frontend Komponenten
| Komponente | Details |
|------------|---------|
| **Navigation** | Header, Footer, Mega-Menu, Mobile-Nav |
| **Hero Sections** | Slider, Video-Hero, Static Hero |
| **Content Blocks** | Teaser, Cards, Accordions, Tabs |
| **Forms** | Kontakt, Newsletter, Suche, Login |
| **Interactive** | Modals, Lightbox, Animationen |
| **Media** | Galerien, Video-Player, Audio |

#### 5.3 Design System
| Aspekt | Analyse |
|--------|---------|
| **Farben** | Primary, Secondary, Accent, Grays |
| **Typografie** | Fonts, Größen, Hierarchie |
| **Spacing** | Grid, Abstände, Breakpoints |
| **Icons** | Icon-Set, Custom Icons |
| **Animationen** | Transitions, Hover-States |

#### 5.4 Integrationen
| Typ | Beispiele |
|-----|-----------|
| **Analytics** | Google Analytics, Matomo, Hotjar |
| **Marketing** | HubSpot, Mailchimp, ActiveCampaign |
| **CRM** | Salesforce, Dynamics, Custom |
| **Payment** | Stripe, PayPal, Klarna |
| **Search** | Algolia, Elasticsearch, Native |
| **CDN** | Cloudflare, Fastly, AWS CloudFront |

#### 5.5 Accessibility
| Prüfung | Details |
|---------|---------|
| **WCAG Level** | A, AA, AAA, Non-Compliant |
| **Issues** | Critical, Serious, Moderate, Minor |
| **Bereiche** | Kontrast, Alt-Texte, Keyboard-Nav, ARIA |

#### 5.6 Performance
| Metrik | Messung |
|--------|---------|
| **Core Web Vitals** | LCP, FID, CLS |
| **Ladezeit** | First Paint, TTI |
| **Assets** | Bildgrößen, JS-Bundle, CSS |

#### 5.7 SEO-Status
| Aspekt | Analyse |
|--------|---------|
| **Meta Tags** | Title, Description, OG Tags |
| **Struktur** | Headings, Schema.org, Sitemap |
| **Technical** | Robots.txt, Canonical, Hreflang |

#### 5.8 Migration Complexity
| Faktor | Bewertung |
|--------|-----------|
| **Export-Möglichkeit** | API, Database, Scraping |
| **Datenqualität** | Clean, Moderate Cleanup, Heavy Cleanup |
| **Komplexität** | Simple, Medium, Complex |

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **System** | Führt Scan automatisch durch |
| **Bereichsleiter** | Wird benachrichtigt wenn fertig |

### Dauer
10-30 Minuten (Background)

---

## Phase 6: Baseline-Vergleich

### Beschreibung
Vergleich der analysierten Website mit der adesso-Baseline (z.B. adessoCMS). Zeigt was bereits vorhanden ist und was neu gebaut werden muss.

### Baseline-Definition

Eine Baseline beschreibt **was wir bereits haben** - fertige Komponenten, Patterns und Funktionen die wiederverwendet werden können.

#### Beispiel: adessoCMS Baseline

| Kategorie | Vorhanden |
|-----------|-----------|
| **Content Types** | Page, Article, News, Event, Person, Location |
| **Paragraphs** | Hero, Teaser, Text, Image, Gallery, Accordion, Tabs, CTA, Quote, Video |
| **Navigation** | Mega-Menu, Footer, Breadcrumb, Mobile-Nav |
| **Features** | Search, Contact Form, Newsletter, Social Share |
| **Integrationen** | Google Analytics, Cookie Consent |

### Vergleichs-Output

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Baseline-Vergleich: Kunde XYZ → adessoCMS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ VORHANDEN (aus Baseline)        │  ❌ NEU ZU ENTWICKELN                 │
│  ─────────────────────────────────  │  ─────────────────────────────────    │
│                                     │                                       │
│  Content Types:                     │  Content Types:                       │
│  • Page                             │  • Product (E-Commerce)               │
│  • Article                          │  • Case Study                         │
│  • News                             │  • Whitepaper                         │
│  • Event                            │                                       │
│  • Person                           │                                       │
│                                     │                                       │
│  Komponenten:                       │  Komponenten:                         │
│  • Hero (Standard)                  │  • Produkt-Konfigurator               │
│  • Teaser Cards                     │  • Preisrechner                       │
│  • Accordion                        │  • 360° Produktansicht                │
│  • Tabs                             │  • Live-Chat Widget                   │
│  • Contact Form                     │  • Kundenportal                       │
│  • Image Gallery                    │  • Download-Center                    │
│                                     │                                       │
│  Features:                          │  Features:                            │
│  • Search                           │  • E-Commerce Integration             │
│  • Newsletter                       │  • Single Sign-On                     │
│  • Social Share                     │  • Multi-Language (5 Sprachen)        │
│                                     │                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 Baseline-Abdeckung: 62%                                                 │
│  🔧 Neuentwicklung: 38%                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **Bereichsleiter** | Prüft Vergleich, identifiziert Gaps |

---

## Phase 7: Projekt-Planung

### Beschreibung
Basierend auf dem Full Website Scan und Baseline-Vergleich wird eine Projekt-Timeline mit benötigten Disziplinen erstellt.

### Projekt-Phasen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROJEKT-TIMELINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Discovery & Konzeption                                            │
│  ══════════════════════════════                                             │
│  Woche 1-2                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ • Kick-off Workshop                                                │     │
│  │ • Anforderungsanalyse                                              │     │
│  │ • Technische Konzeption                                            │     │
│  │ • UX Research & Wireframes                                         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  Phase 2: Design                                                            │
│  ═══════════════                                                            │
│  Woche 3-5                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ • UI Design (Desktop + Mobile)                                     │     │
│  │ • Design System / Style Guide                                      │     │
│  │ • Prototyping                                                      │     │
│  │ • Design Review & Freigabe                                         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  Phase 3: Development                                                       │
│  ════════════════════                                                       │
│  Woche 6-14                                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ • Setup & Infrastruktur                                            │     │
│  │ • Backend Development (CMS, APIs)                                  │     │
│  │ • Frontend Development (Components)                                │     │
│  │ • Integrationen                                                    │     │
│  │ • Content Migration                                                │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  Phase 4: Quality Assurance                                                 │
│  ══════════════════════════                                                 │
│  Woche 15-16                                                                │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ • Testing (Funktional, Performance, Security)                      │     │
│  │ • Accessibility Audit                                              │     │
│  │ • SEO Check                                                        │     │
│  │ • Bug Fixing                                                       │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  Phase 5: Go-Live & Hypercare                                               │
│  ════════════════════════════                                               │
│  Woche 17-18                                                                │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ • Deployment                                                       │     │
│  │ • DNS Switch                                                       │     │
│  │ • Monitoring                                                       │     │
│  │ • Hypercare Support                                                │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Disziplinen

| Kürzel | Disziplin | Beschreibung |
|--------|-----------|--------------|
| **PL** | Projektleitung | Projektsteuerung, Kommunikation, Risikomanagement |
| **CON** | Consulting | Anforderungsanalyse, Konzeption, Workshops |
| **UI/UX** | Design | User Research, Wireframes, UI Design, Prototyping |
| **DEV** | Development | Frontend, Backend, CMS, Integrationen |
| **SEO** | Search Engine Optimization | Technical SEO, Content SEO, Analytics |
| **QA** | Quality Assurance | Testing, Accessibility, Performance |

### Disziplinen pro Phase

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DISZIPLINEN PRO PHASE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│             │ Discovery │ Design │ Development │   QA    │ Go-Live │        │
│             │  Wk 1-2   │ Wk 3-5 │   Wk 6-14   │ Wk 15-16│ Wk 17-18│        │
│  ───────────┼───────────┼────────┼─────────────┼─────────┼─────────┤        │
│  PL         │    ██     │   ██   │     ██      │   ██    │   ██    │        │
│  CON        │    ██     │   █    │     █       │         │         │        │
│  UI/UX      │    █      │   ██   │     █       │         │         │        │
│  DEV        │           │   █    │     ██      │   █     │   ██    │        │
│  SEO        │    █      │        │     █       │   ██    │   █     │        │
│  QA         │           │        │     █       │   ██    │   █     │        │
│                                                                             │
│  Legende: ██ = Hauptfokus, █ = Support                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rollen-Matrix

| Rolle | Discovery | Design | Development | QA | Go-Live |
|-------|:---------:|:------:|:-----------:|:--:|:-------:|
| **Projektleiter (PL)** | ●● | ●● | ●● | ●● | ●● |
| **Consultant (CON)** | ●● | ● | ○ | - | - |
| **UX Designer** | ● | ●● | ○ | - | - |
| **UI Designer** | - | ●● | ○ | - | - |
| **Technical Architect** | ●● | ● | ● | ○ | ● |
| **Backend Developer** | - | ○ | ●● | ● | ●● |
| **Frontend Developer** | - | ○ | ●● | ● | ● |
| **SEO Specialist** | ● | - | ● | ●● | ● |
| **QA Engineer** | - | - | ● | ●● | ● |

**Legende:** ●● = Vollzeit, ● = Teilzeit, ○ = Punktuell, - = Nicht beteiligt

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **Bereichsleiter** | Prüft Timeline, passt Phasen an |
| **System** | Generiert initiale Timeline basierend auf Scan |

---

## Phase 8: Team Assignment

### Beschreibung
Basierend auf Projekt-Anforderungen und benötigten Disziplinen wird das optimale Team zusammengestellt.

### AI-Vorschlag

Das System schlägt ein Team vor basierend auf:
- **Required Skills** - Aus Full Website Scan abgeleitet
- **Verfügbarkeit** - Kapazität der Mitarbeiter
- **Erfahrung** - Ähnliche Projekte, Technologie-Expertise
- **Rollen-Match** - Passt Mitarbeiter zu benötigter Rolle

### Team-Rollen

| Rolle | Beschreibung | Anzahl |
|-------|--------------|--------|
| **Projektleiter** | Gesamtverantwortung, Kundenmanagement | 1 |
| **Technical Architect** | Technische Konzeption, Code Reviews | 1 |
| **Lead Developer** | Technische Umsetzungsleitung | 1 |
| **Backend Developer** | CMS, APIs, Integrationen | 1-3 |
| **Frontend Developer** | Components, Styling, Interaktionen | 1-3 |
| **UX/UI Designer** | Research, Wireframes, Visual Design | 1-2 |
| **Consultant** | Anforderungen, Workshops, Konzeption | 1 |
| **SEO Specialist** | Technical SEO, Analytics | 0-1 |
| **QA Engineer** | Testing, Qualitätssicherung | 0-1 |

### Team-Übersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Team-Vorschlag für: Kunde XYZ - Website Relaunch                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Projektleitung                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 👤 Max Mustermann (PL)                                               │   │
│  │    Skills: Drupal, Agile, Kundenmanagement                           │   │
│  │    Verfügbar: Ab KW 12                                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Konzeption & Design                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 👤 Anna Schmidt (CON)          👤 Lisa Weber (UI/UX)                 │   │
│  │    Skills: Requirements,           Skills: Figma, Design Systems,    │   │
│  │    Workshops                       Accessibility                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Development                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 👤 Tom Bauer (Architect)       👤 Jan Müller (Lead Dev)              │   │
│  │    Skills: Drupal, AWS,            Skills: Drupal, PHP,              │   │
│  │    Architecture                    React                             │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │ 👤 Sarah Klein (Frontend)      👤 Mike Braun (Backend)               │   │
│  │    Skills: React, CSS,             Skills: Drupal, PHP,              │   │
│  │    Accessibility                   APIs                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Quality & SEO                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 👤 Nina Schulz (SEO)           👤 Chris Lang (QA)                    │   │
│  │    Skills: Technical SEO,          Skills: Testing, Playwright,      │   │
│  │    Analytics                       Performance                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Team-Größe: 9 Personen | Skill-Match: 94% | Verfügbarkeit: ✅              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **Bereichsleiter** | Prüft AI-Vorschlag, passt Team an, gibt frei |

---

## Phase 9: Team-Benachrichtigung

### Beschreibung
Das zugewiesene Team wird per E-Mail über die neue Opportunity informiert.

### E-Mail-Template

```
Betreff: [Dealhunter] Angebotsteam für {CustomerName}

Hallo {Name},

du wurdest von {BL-Name} in das Angebotsteam für {CustomerName} aufgenommen.

Deine Rolle: {Role}

Projekt-Übersicht:
━━━━━━━━━━━━━━━━━━
Kunde: {CustomerName}
Branche: {Industry}
Technologie: {Technology}
Timeline: {Timeline}
Kick-off: {KickoffDate}

Im Anhang findest du alle wichtigen Informationen zum Projekt.

Beste Grüße,
{BL-Name}

---
Automatisch generiert von Dealhunter
```

### PDF-Attachment

Das PDF enthält:
- Kundenname & Kontakt
- Projekt-Beschreibung
- Scope & Anforderungen
- Full Website Scan Zusammenfassung
- Baseline-Vergleich
- Timeline mit Phasen
- Team-Zusammensetzung mit Rollen
- Nächste Schritte

### Beteiligte Rollen
| Rolle | Aktion |
|-------|--------|
| **Bereichsleiter** | Löst Benachrichtigung aus |
| **Team-Mitglieder** | Erhalten E-Mail + PDF |

### Dauer
< 30 Sekunden

---

## Rollen-Übersicht

### System-Benutzer (mit Login)

| Rolle | Beschreibung | Phasen |
|-------|--------------|--------|
| **BD Manager** | Lädt Anfragen hoch, prüft Extraktion, trifft Bit/No Bit Entscheidung | 1, 2, 3, 4 |
| **Bereichsleiter** | Prüft Analysen, plant Projekt, stellt Team zusammen, benachrichtigt | 5, 6, 7, 8, 9 |
| **Admin** | Pflegt Stammdaten (BLs, Technologien, Mitarbeiter, Baselines) | Übergreifend |

### Keine System-User

| Rolle | Beschreibung |
|-------|--------------|
| **Team-Mitglieder** | Erhalten nur E-Mail + PDF, kein System-Zugang |

---

## Status-Übersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BID STATUS FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  draft ──▶ extracting ──▶ quick_scanning ──▶ evaluating ──▶ bit_decided
                                                                  │
                                                    ┌─────────────┴─────────────┐
                                                    ▼                           ▼
                                               [NO BIT]                    [BIT]
                                                    │                           │
                                                    ▼                           ▼
                                               archived                    routing
                                                                               │
                                                                               ▼
                                                                       full_scanning
                                                                               │
                                                                               ▼
                                                                        bl_reviewing
                                                                               │
                                                                               ▼
                                                                       team_assigned
                                                                               │
                                                                               ▼
                                                                          notified
                                                                               │
                                                                               ▼
                                                                         handed_off
```

---

## Zeitlicher Ablauf (Gesamt)

| Phase | Dauer | Kumuliert |
|-------|-------|-----------|
| Upload & Extraktion | < 1 min | 1 min |
| Quick Scan | 2-5 min | 6 min |
| Bit/No Bit Bewertung | 5-15 min | 21 min |
| BL-Routing | < 1 min | 22 min |
| Full Website Scan | 10-30 min | 52 min |
| Baseline-Vergleich | < 1 min | 53 min |
| Projekt-Planung | 5-10 min (User) | 63 min |
| Team Assignment | 5-10 min (User) | 73 min |
| Team-Benachrichtigung | < 1 min | 74 min |

**Gesamtdauer:** ~75 Minuten (davon ~45 min automatisch, ~30 min User-Interaktion)

---

## Glossar

| Begriff | Definition |
|---------|------------|
| **Bit** | Entscheidung, ein Angebot abzugeben |
| **No Bit** | Entscheidung, kein Angebot abzugeben |
| **BL** | Business Line (Geschäftsbereich) |
| **BD** | Business Development |
| **Baseline** | Referenz-Implementierung mit vorhandenen Komponenten |
| **Quick Scan** | Schnelle Tech-Stack-Erkennung für BL-Routing |
| **Full Website Scan** | Umfassende Analyse aller Website-Aspekte |
| **Red Flag** | Kritisches Warnsignal bei der Bewertung |

---

**Status**: Workflow Definition Complete
**Last Updated**: 2025-01-18
**Author**: Marc Philipps + Claude
