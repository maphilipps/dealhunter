# Gegenüberstellung: Ausschreibung vs. adesso-Angebot
## VHS Frankfurt Webinfrastruktur

**Projekt:** Neuentwicklung der Webinfrastruktur der VHS Frankfurt
**Auftraggeber:** Stadt Frankfurt am Main
**Abgabefrist:** 03.02.2026
**Datum:** 2026-01-08
**Version:** 1.0 (Diskussionsgrundlage)

---

## Executive Summary

### Budgetvergleich auf einen Blick

| Metrik | Ausschreibung | adesso-Angebot | Differenz | % |
|--------|---------------|----------------|-----------|---|
| **Entwicklung (Gruppe 1)** | 445,8 PT | 240 PT | -205,8 PT | **-46%** |
| **Wartung Jahr 1** | 35 PT | 35 PT | ±0 PT | 0% |
| **Wartung Jahr 2** | 44 PT | 44 PT | ±0 PT | 0% |
| **Wartung Jahr 3** | 41 PT | 41 PT | ±0 PT | 0% |
| **GESAMT (3 Jahre)** | **565,8 PT** | **360 PT** | **-205,8 PT** | **-36%** |

### Preiskalkulation

| Position | adesso-Kalkulation |
|----------|-------------------|
| Entwicklung | 240 PT × €1.200 = **€288.000** |
| Wartung (3 Jahre) | 120 PT × €1.000 = **€120.000** |
| **Gesamtpreis (3 Jahre)** | **€408.000** |

**Ausschreibungsbudget bei €850/Tag:** ~€481.000
**Unsere Einsparung für Auftraggeber:** ~€73.000 (15%)

---

## Warum können wir 46% günstiger sein?

### 1. adessoCMS-Baseline (26% Einsparung = 117 PT)

Wir starten NICHT bei Null, sondern mit einer fertigen Enterprise-CMS-Plattform:

| Komponente | Status | Einsparung |
|------------|--------|------------|
| **CMS-Setup** | Drupal 11 + Tailwind v4 produktionsreif | 15 PT |
| **SDC-Komponenten** | 55 UI-Komponenten wiederverwendbar | 30 PT |
| **DevOps** | CI/CD-Pipeline, DDEV, Testing-Setup fertig | 23 PT |
| **Commerce** | Cart, Checkout, Payment-Gateways integriert | 20 PT |
| **Search** | Search API + Solr vorkonfiguriert | 8 PT |
| **API-Layer** | Guzzle, OAuth 2.0, Error-Handling etabliert | 10 PT |
| **SEO** | Metatag, Pathauto, Sitemap, Structured Data | 4 PT |
| **Auth** | Social Login (Google, Facebook) fertig | 4 PT |
| **Analytics** | GA4, Matomo, GTM konfiguriert | 3 PT |
| **GESAMT** | **Produktionsreife Baseline** | **117 PT** |

### 2. KI-Tooling (31% Einsparung = 136 PT)

Wir nutzen KI-gestützte Entwicklung für repetitive Aufgaben:

| Bereich | KI-Automatisierung | Einsparung |
|---------|-------------------|------------|
| **Content-Modeling** | KI generiert Field-Konfigurationen | 12 PT |
| **Templates** | Twig-Templates aus Designs | 18 PT |
| **Styling** | Tailwind CSS-Klassen-Generierung | 15 PT |
| **API-Integration** | DTOs, Mappings, Clients automatisch | 20 PT |
| **Testing** | Unit- & E2E-Test-Generierung | 25 PT |
| **Views** | Komplexe Drupal-Views-Konfiguration | 10 PT |
| **Forms** | Form-Builder & Validierungen | 12 PT |
| **Dokumentation** | Technische Doku aus Code | 15 PT |
| **Übersetzungen** | DE/EN/weitere Sprachen | 5 PT |
| **SEO** | Structured Data (JSON-LD) | 4 PT |
| **GESAMT** | **KI-beschleunigte Entwicklung** | **136 PT** |

---

## Detaillierte Gegenüberstellung (Gruppe 1: Entwicklung)

### Übersichtstabelle

| Nr. | Position | Ausschreibung | adesso | Differenz | % | Begründung (Kurzform) |
|-----|----------|---------------|--------|-----------|---|-----------------------|
| 1.1 | Kick-off | 6,0 PT | 4,0 PT | -2,0 PT | -33% | Standardisierte Prozesse + KI-Doku |
| 1.2 | Layout | 16,8 PT | 8,0 PT | -8,8 PT | -52% | Design-System + KI Design-to-Code |
| 1.3 | Setup & PM | 109,0 PT | 56,0 PT | -53,0 PT | -49% | DevOps fertig + KI-Testing + PM-Tools |
| 1.4 | API/SDK | 53,4 PT | 26,0 PT | -27,4 PT | -51% | API-Layer + KI-Client-Generierung |
| 1.5 | CMS | 61,6 PT | 16,5 PT | -45,1 PT | -73% | **Größte Einsparung: CMS-Setup + SDC-Bibliothek** |
| 1.6 | Kurssuche | 24,0 PT | 9,0 PT | -15,0 PT | -63% | Search API + KI-Views-Konfiguration |
| 1.7 | Account | 16,8 PT | 6,0 PT | -10,8 PT | -64% | Drupal User-System + Social Auth |
| 1.8 | Buchung | 30,0 PT | 12,0 PT | -18,0 PT | -60% | Webform Multi-Step + KI-Logik |
| 1.9 | Payment | 16,2 PT | 7,0 PT | -9,2 PT | -57% | Commerce Payment-Gateways |
| 1.10 | Gutscheine | 14,4 PT | 6,0 PT | -8,4 PT | -58% | Commerce Promotions-System |
| 1.11 | Merkliste | 5,4 PT | 2,0 PT | -3,4 PT | -63% | Flag-Modul (Favoriten) |
| 1.12 | Warenkorb | 5,4 PT | 2,0 PT | -3,4 PT | -63% | Commerce Cart |
| 1.13 | Reservierung | 5,4 PT | 2,5 PT | -2,9 PT | -54% | Custom Entity + Cron |
| 1.14 | Meine Kurse | 9,6 PT | 4,0 PT | -5,6 PT | -58% | Views mit User-Context |
| 1.15 | Kursalarm | 5,4 PT | 2,0 PT | -3,4 PT | -63% | Flag + Rules + E-Mail-Templates |
| 1.16 | Newsletter | 2,4 PT | 0,8 PT | -1,6 PT | -67% | Simplenews-Modul |
| 1.17 | Kursleiterportal | 24,0 PT | 10,0 PT | -14,0 PT | -58% | Dashboard-Architektur + KI-Views |
| 1.18 | Export | 3,0 PT | 1,0 PT | -2,0 PT | -67% | Views Data Export |
| 1.19 | Notification | 7,8 PT | 3,5 PT | -4,3 PT | -55% | Message-System + PWA |
| 1.20 | Chatbot | 13,8 PT | 6,2 PT | -7,6 PT | -55% | Webform + KI-Chatbot-Integration |
| 1.21 | Analytics | 12,0 PT | 4,0 PT | -8,0 PT | -67% | GA4/Matomo + GTM fertig |
| 1.22 | Logging | 2,4 PT | 0,8 PT | -1,6 PT | -67% | Sentry-Integration |
| | **SUMME** | **445,8 PT** | **189,3 PT** | **-256,5 PT** | **-58%** | **Rohaufwand ohne Puffer** |
| | **+ Risiko-Puffer (20%)** | - | **37,9 PT** | - | - | Unbekannte API-Komplexität |
| | **+ PM-Puffer (10%)** | - | **12,8 PT** | - | - | Abstimmungen, Changes |
| | **ANGEBOT GESAMT** | **445,8 PT** | **240 PT** | **-205,8 PT** | **-46%** | **Mit Puffern** |

---

## Top 5 Einsparungen im Detail

### 1. Position 1.5: CMS (Einsparung: 45,1 PT = 73%)

**Ausschreibung fordert:** 61,6 PT
- Grundsetup
- Basis-Theme (Header, Footer, Navigation)
- Inhaltstypen
- Inhaltselemente (Paragraphs)
- Dynamische Elemente (Kursliste, Kursteaser)
- SEO
- Consent Management
- KI (Übersetzungen)

**adesso liefert aus der Baseline:**
- ✅ Drupal 11 + Tailwind v4 komplett konfiguriert
- ✅ **55 SDC-Komponenten** (Header, Footer, Navigation, Cards, Forms, etc.)
- ✅ Paragraph-Architektur etabliert
- ✅ SEO-Module (Metatag, Pathauto, Simple Sitemap) produktionsreif
- ✅ Cookie-Consent-Banner fertig
- ✅ Übersetzungs-Workflows konfiguriert

**KI automatisiert:**
- Content-Type-Definitionen aus Lastenheft
- Twig-Templates aus Designs
- Tailwind CSS-Klassen
- Paragraph-Komponenten
- Views-Konfigurationen

**Verbleibender Aufwand:** 16,5 PT
- Anpassung SDC-Komponenten an VHS-Design
- Spezifische Content-Types (Kurs, Person, etc.)
- Business-spezifische Validierungen

---

### 2. Position 1.3: Setup & Projektmanagement (Einsparung: 53 PT = 49%)

**Ausschreibung fordert:** 109 PT
- Projektsetup (Repos, CI/CD)
- Konzeption & Dokumentation
- QA & Testing (Unit-Tests, E2E-Tests)
- Projektleitung (22 Monate)
- Schulung & Dokumentation

**adesso liefert aus der Baseline:**
- ✅ **GitLab/GitHub CI/CD-Pipeline** (Build, Test, Deploy)
- ✅ **DDEV-Umgebung** vorkonfiguriert
- ✅ **Testing-Setup** (PHPUnit, Playwright, Vitest) produktionsreif
- ✅ **Coding Standards** (PHPCS, ESLint) aktiviert
- ✅ **Deployment-Automation** (Ansible/Docker)
- ✅ PM-Tools (Jira, Confluence) konfiguriert

**KI automatisiert:**
- Test-Case-Generierung (Unit + E2E)
- Technische Dokumentation aus Code
- Schulungsmaterial-Erstellung
- Feature-Konzepte aus Anforderungen

**Verbleibender Aufwand:** 56 PT
- Projektleitung (30 PT) - bleibt manuell
- Feature-Konzeption (10 PT) - KI-unterstützt
- Testing (10 PT) - KI generiert, manuell reviewt
- Schulung (3 PT) - KI-Material, manuelles Training
- Setup-Anpassung (3 PT)

---

### 3. Position 1.4: API/SDK (Einsparung: 27,4 PT = 51%)

**Ausschreibung fordert:** 53,4 PT
- Anbindung Information-Manager-API
- 20+ Endpunkte (Auth, Buchung, Payment, Kurssuche, etc.)

**adesso liefert aus der Baseline:**
- ✅ **Guzzle HTTP Client** konfiguriert
- ✅ **OAuth 2.0 Service** implementiert
- ✅ **JSON-Schema-Validation** aktiv
- ✅ **Error-Handling-Patterns** etabliert
- ✅ **API-Caching-Layer** (Redis) vorbereitet
- ✅ **Retry-Logic & Circuit-Breaker** implementiert

**KI automatisiert:**
- API-Client-Code aus OpenAPI-Spec
- DTO-Klassen (Data Transfer Objects)
- Request/Response-Mappings
- Test-Mocks
- Error-Handling-Code

**Verbleibender Aufwand:** 26 PT
- Business-Logic-Mapping (10 PT)
- API-spezifische Anpassungen (8 PT)
- Integration-Testing (5 PT)
- Fehlerbehandlung Custom (3 PT)

---

### 4. Position 1.8: Buchung (Einsparung: 18 PT = 60%)

**Ausschreibung fordert:** 30 PT
- Multi-Step-Buchungsprozess
- Wartelisten-Buchungen
- Validierungen
- State-Management

**adesso liefert aus der Baseline:**
- ✅ **Webform Multi-Step** fertig
- ✅ **Custom-Entity-Architektur** etabliert
- ✅ **Workflow-Modul** (State-Machine) konfiguriert
- ✅ **Queue-System** für Buchungen vorbereitet

**KI automatisiert:**
- Booking-Entity-Definition
- Multi-Step-Form-Logic
- Validierungsregeln
- State-Transitions
- E-Mail-Templates

**Verbleibender Aufwand:** 12 PT
- Business-Rules (Verfügbarkeit, Preis, etc.) - 5 PT
- Wartelisten-Logik - 2,5 PT
- Stornierungen - 2 PT
- Edge-Cases - 2,5 PT

---

### 5. Position 1.6: Kurssuche (Einsparung: 15 PT = 63%)

**Ausschreibung fordert:** 24 PT
- Kurssuche mit Filter & Sortierung
- Kursdetails
- XML-Sitemap
- Structured Data
- Kursfragen

**adesso liefert aus der Baseline:**
- ✅ **Search API + Solr** vorkonfiguriert
- ✅ **Faceted Search** (Facets-Modul) aktiv
- ✅ **Simple Sitemap** installiert
- ✅ **Schema.org Metatag** konfiguriert
- ✅ **Views-Templates** für Suchergebnisse

**KI automatisiert:**
- Search-View-Konfiguration
- Facet-Filter-UI
- Structured Data (JSON-LD)
- Kursdetail-Templates
- XML-Sitemap-Anpassungen

**Verbleibender Aufwand:** 9 PT
- Kurssuche (Basis) - 3 PT
- Filter & Facets - 2 PT
- Kursdetails - 2 PT
- Structured Data - 1 PT
- Kursfragen - 0,5 PT
- XML-Sitemap - 0,5 PT

---

## Puffer-Kalkulation

### Warum 26% Puffer auf Rohaufwand?

| Puffer-Typ | Aufschlag | Begründung |
|------------|-----------|------------|
| **Risiko-Puffer (20%)** | +37,9 PT | Unbekannte Information-Manager-API-Komplexität, Scope-Creep, Edge-Cases |
| **PM-Puffer (10%)** | +12,8 PT | Zusätzliche Abstimmungen, Change-Requests, Dokumentations-Nachbesserungen |
| **GESAMT** | **+50,7 PT** | **Von 189,3 PT auf 240 PT** |

### Was ist im Puffer NICHT enthalten:

❌ **Nicht im Scope:**
- Migration von Legacy-Daten (wird separat kalkuliert)
- Major-Customizations außerhalb Lastenheft
- Hosting & Infrastruktur
- Lizenzen (Solr-Hosting, etc.)
- Content-Erstellung/Redaktion

✅ **Im Scope enthalten:**
- Normale Change-Requests während Entwicklung
- Bug-Fixes während Entwicklung
- Dokumentations-Updates
- Zusätzliche Abstimmungstermine

---

## Risiko-Assessment

### Hohe Risiken (können Aufwand erhöhen)

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| **Information-Manager-API hat Quirks** | Hoch | +15-30 PT | Frühzeitiger API-Test, enger Austausch mit API-Anbieter |
| **Scope-Creep (neue Anforderungen)** | Mittel | +20-40 PT | Striktes Change-Management, Abnahme-Prozess |
| **Legacy-Daten-Migration erforderlich** | Mittel | +30-50 PT | Separat kalkulieren, nicht im Angebot |
| **Performance-Probleme bei großen Datenmengen** | Niedrig | +10-20 PT | Frühzeitiges Load-Testing, Solr-Optimierung |

### Niedrige Risiken (durch adessoCMS abgedeckt)

| Risiko | Status | Schutz durch |
|--------|--------|--------------|
| **CMS-Setup schlägt fehl** | ✅ Abgedeckt | adessoCMS produktionsreif |
| **Testing-Infrastruktur fehlt** | ✅ Abgedeckt | PHPUnit, Playwright, Vitest fertig |
| **CI/CD-Pipeline-Probleme** | ✅ Abgedeckt | GitLab/GitHub Actions produktionsreif |
| **Drupal-Sicherheitslücken** | ✅ Abgedeckt | Automatische Security-Updates |
| **Browser-Kompatibilitätsprobleme** | ✅ Abgedeckt | Tailwind CSS + Testing |

---

## Preisstrategie & Alternativen

### Option 1: EMPFOHLEN (Konservativ mit Puffer)

```
Entwicklung:    240 PT × €1.200 = €288.000
Wartung (3J):   120 PT × €1.000 = €120.000
────────────────────────────────────────────
GESAMT:         360 PT           €408.000
```

**Vorteile:**
- ✅ 36% unter Ausschreibungsbudget (~€73.000 Einsparung)
- ✅ Konservative Puffer decken Risiken ab
- ✅ €1.200/Tag = marktüblich für Senior Drupal + KI
- ✅ Seriös & glaubwürdig

**Nachteile:**
- ⚠️ Nicht das günstigste Angebot (falls reine Preiskonkurrenz)

---

### Option 2: Aggressiv (Minimaler Puffer)

```
Entwicklung:    220 PT × €1.150 = €253.000
Wartung (3J):   120 PT × €1.000 = €120.000
────────────────────────────────────────────
GESAMT:         340 PT           €373.000
```

**Vorteile:**
- ✅ 40% unter Budget (~€108.000 Einsparung)
- ✅ Sehr kompetitiv
- ✅ Schwer zu unterbieten

**Nachteile:**
- ⚠️ Nur 15% Risiko-Puffer
- ⚠️ Kann verdächtig billig wirken
- ⚠️ Wenig Spielraum bei Problemen

---

### Option 3: Premium (Qualitätsfokus)

```
Entwicklung:    260 PT × €1.300 = €338.000
Wartung (3J):   120 PT × €1.100 = €132.000
────────────────────────────────────────────
GESAMT:         380 PT           €470.000
```

**Vorteile:**
- ✅ 33% unter Budget
- ✅ Höherer Tagessatz = Premium-Positionierung
- ✅ Mehr Puffer für Qualität & Innovation
- ✅ Raum für Design-Iterationen

**Nachteile:**
- ⚠️ Teurer als Option 1 & 2
- ⚠️ Erklärungsbedürftig bei Preiswettbewerb

---

## Wettbewerbsvergleich

### Was traditionelle Anbieter kalkulieren werden:

| Anbieter-Typ | Erwartete Kalkulation | Tagessatz | Gesamtpreis |
|--------------|----------------------|-----------|-------------|
| **Traditionelle Agentur** | 380-420 PT | €900-1.100 | €342.000-€462.000 |
| **Freelancer-Kollektiv** | 350-400 PT | €750-900 | €262.500-€360.000 |
| **Offshore (Osteuropa)** | 500-600 PT | €400-600 | €200.000-€360.000 |
| **adesso (Option 1)** | **240 PT + 120 PT Wartung** | **€1.200 / €1.000** | **€408.000** |

### Unser Wettbewerbsvorteil:

| Vorteil | Wert für Auftraggeber |
|---------|----------------------|
| **36% unter Budget** | €73.000 Einsparung |
| **Produktionsreife Baseline** | Schnellerer Go-Live, weniger Risiko |
| **Enterprise-Support** | adesso-Backing, kein Vendor-Lock-in |
| **KI-Tooling** | Modernste Entwicklungsmethoden |
| **Drupal-Expertise** | Triple-Certified Drupal 10 Expert im Team |

---

## Nächste Schritte

### Für die Diskussion:

1. **Preisstrategie festlegen:** Option 1 (konservativ), 2 (aggressiv) oder 3 (premium)?
2. **Risiken bewerten:** Sind 26% Puffer ausreichend oder zu knapp?
3. **Wartungskosten:** 120 PT @ €1.000/Tag akzeptabel?
4. **Tagessatz:** €1.200 vs. €1.150 vs. €1.300?
5. **Zusatzleistungen:** Migration, Content-Import, Schulungen extra kalkulieren?

### Offene Fragen an Auftraggeber:

1. Gibt es Legacy-Daten, die migriert werden müssen?
2. Wie komplex ist die Information-Manager-API wirklich?
3. Gibt es eine OpenAPI-Spec oder API-Dokumentation?
4. Wer hosted die Solr-Instanz?
5. Gibt es bereits ein Design oder erwarten sie komplettes UX/UI-Design?

---

## Anhang: Kalkulationsgrundlagen

### adessoCMS-Baseline (Stand: 2026-01-08)

- **Drupal Core:** 11.0.x (aktuelle Version)
- **PHP:** 8.3
- **Tailwind CSS:** v4.0
- **Testing:** PHPUnit 10, Playwright 1.40, Vitest 1.0
- **SDC-Komponenten:** 55 produktionsreife Komponenten
- **CI/CD:** GitLab CI / GitHub Actions
- **Deployment:** DDEV + Ansible + Docker
- **Module:** 80+ vorkonfigurierte Contrib-Module

### KI-Tooling-Stack

- **Code-Generierung:** Claude Sonnet 4.5, GPT-4 Turbo
- **Testing:** KI-generierte Test-Cases (Copilot, Claude)
- **Dokumentation:** KI-gestützte Doku-Generierung
- **Übersetzungen:** DeepL API + KI-Kontext-Anpassung
- **Design-to-Code:** Figma → Tailwind (Claude)

### Annahmen

- **Team-Setup:** 2-3 Senior Drupal-Entwickler + 1 Frontend + 1 PM
- **Projektlaufzeit:** 22 Monate (bis 31.10.2027)
- **Arbeitsweise:** Agile/Scrum, 2-Wochen-Sprints
- **Kommunikation:** Wöchentliche Jour-Fixes, Confluence-Dokumentation
- **Testing:** Automatisiert (90%), manuell (10%)

---

**Erstellt:** 2026-01-08
**Autor:** Marc Philipps (Solutions Lead Drupal, adesso SE)
**Version:** 1.0 (Diskussionsgrundlage)
**Status:** Confidential - Nur für interne Diskussion

---

## Quick-Reference: Entscheidungsmatrix

| Kriterium | Option 1 (Konservativ) | Option 2 (Aggressiv) | Option 3 (Premium) |
|-----------|----------------------|---------------------|-------------------|
| **Gesamtpreis** | €408.000 | €373.000 | €470.000 |
| **Unter Budget** | -36% | -40% | -33% |
| **Risiko-Puffer** | Hoch (26%) | Niedrig (15%) | Sehr hoch (37%) |
| **Wettbewerbsfähigkeit** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Glaubwürdigkeit** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Gewinnmarge** | Mittel | Niedrig | Hoch |
| **Empfehlung** | ✅ **JA** | ⚠️ Nur bei Preiskampf | ⚠️ Nur bei Qualitätsfokus |

**Finale Empfehlung: Option 1 (€408.000 / 360 PT)**
