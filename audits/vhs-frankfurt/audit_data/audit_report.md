# Audit-Report: VHS Frankfurt Webinfrastruktur Ausschreibung

**Erstellt:** 2026-01-08
**Projekt:** Neuentwicklung der Webinfrastruktur der VHS Frankfurt
**Ausschreibung:** Stadt Frankfurt am Main
**Abgabefrist:** 03.02.2026
**Ausgeschriebenes Volumen:** 444,8 PT

---

## Executive Summary

Die Volkshochschule Frankfurt am Main schreibt die Neuentwicklung ihrer gesamten Webinfrastruktur aus. Die aktuelle Website läuft auf **Kentico CMS** (proprietär, .NET) und muss vollständig neu entwickelt werden.

### Kernerkenntnisse

| Metrik | Wert |
|--------|------|
| **Projektgröße** | GROSS (>150% adessoCMS-Baseline) |
| **Entwicklungsaufwand (Traditionell)** | 4.034h (504 PT) |
| **Entwicklungsaufwand (KI-Unterstützt)** | 945h (118 PT) |
| **KI-Ersparnis** | 77% (3.089h) |
| **Budget-Passung** | ✅ Mit KI + Nearshore machbar |
| **Empfehlung** | ✅ **BID** (unter Bedingungen) |

### Kritische Erfolgsfaktoren

✅ **Nearshore-Kalkulation PFLICHT** (Sales-Vorgabe)
✅ **KI-unterstützte Entwicklung** (Claude Code)
✅ **Klärung API-Verfügbarkeit** (Information Manager)
✅ **Payment-Provider** definieren (PCI-DSS)
✅ **KI-Services auf deutschen Servern** (DSGVO)

---

## 1. Projekt-Kontext

### 1.1 Auftraggeber

**Volkshochschule Frankfurt am Main**
- Über 125 Jahre Tradition
- ~5.800 Veranstaltungen jährlich
- 8 Programmbereiche
- Öffentlicher Träger (Stadt Frankfurt)

### 1.2 Ausschreibung

| Detail | Wert |
|--------|------|
| **Volumen** | 444,8 PT |
| **Abgabefrist** | 03.02.2026 |
| **Umsetzungsfrist** | Bis 31.10.2027 |
| **Wartung** | 3 Jahre (31.10.2027 - 31.10.2030) |
| **Vergabeart** | Öffentliche Ausschreibung |
| **Preiswertung** | 100% (kein Qualitätskriterium!) |
| **Aktueller Dienstleister** | Advellence Solutions AG |

**⚠️ KRITISCH:** 100% Preiswertung bedeutet: **Günstigstes Angebot gewinnt** (bei Erfüllung aller Anforderungen).

### 1.3 Sales-Hinweise

> **Hans Scharinger (Sales):**
> - "100% Preis"
> - "Sollte mit Near-Shore kalkuliert werden, sonst kein WIN"
> - "Aktueller DL: Advellence Solutions AG"

**Interpretation:** Onshore-Kalkulation wird zu teuer sein. Nearshore ist Voraussetzung für Wettbewerbsfähigkeit.

---

## 2. Technologie-Analyse

### 2.1 IST-Zustand (Kentico CMS)

**Website:** vhs.frankfurt.de

| Komponente | Technologie | Version |
|------------|-------------|---------|
| **CMS** | Kentico CMS | Proprietär |
| **Framework** | Microsoft ASP.NET | 4.0.30319 |
| **Webserver** | IIS | 10.0 |
| **Betriebssystem** | Windows Server | - |
| **Frontend** | Bootstrap, jQuery | - |
| **CDN** | Cloudflare | - |
| **Auth** | Facebook Login, Google Sign-in | OAuth 2.0 |
| **Security** | HSTS | - |

### 2.2 Barrierefreiheits-Mängel (IST)

**Gefundene WCAG-Verstöße:**

| Verstoß | Details | Schweregrad |
|---------|---------|-------------|
| **Color Contrast** | Suchbutton: 1.91:1 (erforderlich: 4.5:1) | SERIOUS |
| | Vordergrund: #ffffff | |
| | Hintergrund: #b1c609 | |

**Status:** Aktuelle Website erfüllt **NICHT** BITV 2.0 / WCAG 2.2 Level AA.

### 2.3 SOLL-Zustand (Drupal 11)

| Komponente | Technologie |
|------------|-------------|
| **CMS** | Drupal 11.x |
| **Framework** | Symfony 7.x (PHP) |
| **Webserver** | Apache / Nginx |
| **Betriebssystem** | Linux |
| **Frontend** | Tailwind CSS 4 / Alpine.js |
| **CDN** | Cloudflare (beibehalten) |
| **Auth** | OAuth 2.0 (Social Login) |
| **Security** | HTTPS, HSTS, PCI-DSS |

**Besonderheit:** Keine Drupal-Migration möglich → **Komplette Neuentwicklung**.

---

## 3. Funktionale Anforderungen

### 3.1 Hauptfunktionen (Lastenheft)

**Benutzergruppen:**
1. **Teilnehmende** (Endnutzer) - Hauptzielgruppe
2. **Kursleitende** - Eigenes Portal
3. **VHS-Mitarbeitende** - CMS-Backend

### 3.2 Kernfunktionalitäten

| Bereich | Status IST | Status SOLL |
|---------|-----------|-------------|
| **Registrierung & Login** | | |
| Native Registrierung (Privat) | ✅ | ✅ |
| Native Registrierung (Firmen) | ❓ | ✅ |
| Social Login (Google, Facebook) | ✅ | ✅ |
| **Kurssuche** | | |
| Volltextsuche | ✅ | ✅ + Suchserver |
| Filter (Datum, Ort, Preis, Umkreis) | ⚠️ | ✅ |
| Performance max. 1,5 Sek. | ❓ | ✅ PFLICHT |
| **Kursbuchung** | | |
| Warenkorb | ✅ | ✅ |
| Checkout | ✅ | ✅ |
| Warteliste | ❓ | ✅ NEU |
| Automatische Benachrichtigung | ❌ | ✅ NEU |
| **E-Payment** | | |
| Kreditkarte, PayPal, SEPA | ❓ | ✅ |
| PCI-DSS-Konformität | ❓ | ✅ PFLICHT |
| Gutscheine | ❓ | ✅ |
| **Kursleitenden-Portal** | ❌ | ✅ **KOMPLETT NEU** |
| Kursübersicht | ❌ | ✅ |
| Terminplanung | ❌ | ✅ |
| Teilnehmerverwaltung | ❌ | ✅ |
| Dokumentenverwaltung (DOX42) | ❌ | ✅ |
| **Notification Center** | ❌ | ✅ **KOMPLETT NEU** |
| Browser-Push | ❌ | ✅ |
| E-Mail | ✅ | ✅ |
| In-App | ❌ | ✅ |
| **KI-Funktionen** | ❌ | ✅ **KOMPLETT NEU** |
| KI-Chatbot | ❌ | ✅ |
| KI-gestützte Texterstellung | ❌ | ✅ |
| Deutsche Server (DSGVO) | - | ✅ PFLICHT |

---

## 4. Integrationen (REST-API)

### 4.1 VHS-Interne Systeme (PFLICHT)

| System | Beschreibung | Status |
|--------|--------------|--------|
| **Information Manager** | Kursverwaltung (MSSQL-DB) | ⚠️ API-Doku prüfen |
| **Suchserver** | Volltextsuche | ❌ Neu |
| **Notification Service** | Browser-Push-Notifications | ❌ Neu |
| **DOX42** | Dokumentgenerierung (Bescheinigungen, Rechnungen) | ❌ Neu |

**⚠️ KRITISCHES RISIKO:** Gesamtes System hängt von Information Manager REST-API ab.

**Klärungsbedarf:**
- ✅ Ist API dokumentiert?
- ✅ Existiert Test-Zugang?
- ✅ Welche Endpunkte verfügbar?
- ✅ Performance/Stabilität?

### 4.2 Externe Services

| Service | Beschreibung | Status |
|---------|--------------|--------|
| **Payment Service Provider** | Kreditkarte, PayPal, SEPA | ❓ Welcher PSP? |
| **Location API** | Umkreissuche | ❌ Neu |
| **IBAN-Validierung** | SEPA-Validierung | ❌ Neu |
| **Google/Facebook API** | Social Login | ✅ Vorhanden |

---

## 5. Nicht-Funktionale Anforderungen

### 5.1 Performance

| Anforderung | Ziel | Kritikalität |
|-------------|------|--------------|
| Suchergebnisse | Max. 1,5 Sek. | HOCH |
| Bilder-Optimierung | WebP, Lazy Loading | MITTEL |
| Responsive Design | Mobile First | HOCH |

### 5.2 Sicherheit

| Anforderung | Standard | Kritikalität |
|-------------|----------|--------------|
| HTTPS/TLS | TLS 1.3 | PFLICHT |
| DSGVO-Konformität | EU-DSGVO | PFLICHT |
| PCI-DSS | Payment-Sicherheit | PFLICHT |
| OWASP Top 10 | Sicherheitsstandard | HOCH |

### 5.3 Barrierefreiheit

| Anforderung | Standard | Kritikalität |
|-------------|----------|--------------|
| BITV 2.0 | Deutsche Norm | PFLICHT (Gesetz) |
| WCAG 2.2 Level AA | Internationaler Standard | PFLICHT |
| Tastaturbedienbarkeit | 100% | PFLICHT |
| Screenreader-Kompatibilität | 100% | PFLICHT |

**Status IST:** ❌ Nicht erfüllt (Color-Contrast-Fehler)
**Status SOLL:** ✅ Verpflichtend

---

## 6. Drupal-Architektur (SOLL)

### 6.1 Entities-Übersicht

| Entity-Typ | Anzahl | Komplexität | Stunden (Trad.) | Stunden (KI) |
|------------|--------|-------------|-----------------|--------------|
| Content Types | 8 | MITTEL-HOCH | 54h | 18h |
| Paragraph Types | 20 | GEMISCHT | 97h | 32h |
| Taxonomies | 5 | EINFACH-MITTEL | 11h | 4h |
| Views | 9 | MITTEL-HOCH | 61h | 20h |
| Webforms | 5 | EINFACH-HOCH | 26h | 9h |
| Custom Modules | 8 | HOCH | 370h | 130h |
| Theme Components (SDC) | 55 | GEMISCHT | 200h | 67h |
| **GESAMT** | **110** | | **819h** | **280h** |

### 6.2 Kritische Custom Modules

| Modul | Beschreibung | Aufwand (Trad.) | Aufwand (KI) |
|-------|--------------|-----------------|--------------|
| **Information Manager Integration** | REST-API zu Kursverwaltung | 80h | 28h |
| **Payment Integration** | PSP-Anbindung (PCI-DSS) | 60h | 21h |
| **Booking System** | Warenkorb + Buchungslogik | 60h | 21h |
| **Instructor Portal** | Kursleitenden-Funktionen | 50h | 18h |
| **Notification Service** | Browser-Push + In-App | 40h | 14h |
| **Chatbot Integration** | KI-Chatbot (deutsche Server) | 40h | 14h |
| **Waitlist Management** | Wartelisten-Automatisierung | 20h | 7h |
| **DOX42 Integration** | Dokumentgenerierung | 20h | 7h |
| **GESAMT** | | **370h** | **130h** |

---

## 7. Aufwands-Schätzung

### 7.1 Gesamtübersicht

```
╔═══════════════════════════════════════════════════════════════╗
║              PROJEKT-SCHÄTZUNG VERGLEICH                       ║
╠═══════════════════════════════════════════════════════════════╣
║ Kategorie             │ Traditionell │ KI-Unterstützt │ Erspart║
╠═══════════════════════════════════════════════════════════════╣
║ Inhaltstypen          │ 54h          │ 18h            │ 67%    ║
║ Paragraphs            │ 97h          │ 32h            │ 67%    ║
║ Views                 │ 61h          │ 20h            │ 67%    ║
║ Theme-Komponenten     │ 200h         │ 67h            │ 67%    ║
║ Custom Modules        │ 370h         │ 130h           │ 65%    ║
║ Migration             │ 40h          │ 20h            │ 50%    ║
╠═══════════════════════════════════════════════════════════════╣
║ ZWISCHENSUMME         │ 3.227h       │ 822h           │        ║
║ + Multiplikatoren     │ 2.131h       │ 420h           │        ║
║ + Projektmanagement   │ 147h         │ 42h            │        ║
║ + Puffer              │ 807h         │ 123h           │        ║
╠═══════════════════════════════════════════════════════════════╣
║ GESAMT                │ 4.034h       │ 945h           │ 77%    ║
║ Personen-Tage (8h)    │ 504 PT       │ 118 PT         │        ║
║ Zeitplan (40h/Woche)  │ 101 Wochen   │ 24 Wochen      │        ║
╠═══════════════════════════════════════════════════════════════╣
║ KI-ERSPARNIS          │         77% Reduktion (3.089h)         ║
╚═══════════════════════════════════════════════════════════════╝
```

### 7.2 Budget-Vergleich

| Szenario | Entwicklung (PT) | Wartung (3J, PT) | Gesamt (PT) | vs. Ausschreibung (444,8 PT) |
|----------|------------------|------------------|-------------|------------------------------|
| **Traditionell (Onshore)** | 504 | 180 | 684 | ❌ 154% (ÜBERBUDGET) |
| **KI-Unterstützt (Nearshore)** | 118 | 180 | 298 | ✅ 67% (UNTERBUDGET) |

**Annahmen:**
- Wartung: ~180 PT für 3 Jahre (60 PT/Jahr)
- PM & Overhead: in Multiplikatoren enthalten

---

## 8. Risikobewertung

### 8.1 Hohe Risiken (🔴)

| Risiko | Beschreibung | Wahrscheinlichkeit | Impact | Mitigation |
|--------|--------------|-------------------|--------|------------|
| **API-Abhängigkeit** | Information Manager API instabil/undokumentiert | MITTEL | HOCH | Frühe API-Tests, Fallback-Konzept |
| **Zahlungsintegration** | PCI-DSS-Konformität komplex | NIEDRIG | HOCH | Zertifizierter PSP (Stripe, PayPal) |
| **Deadline 31.10.2027** | Fixe Deadline bei agilem Vorgehen | HOCH | HOCH | MVP-First, MUST/SHOULD/COULD |

### 8.2 Mittlere Risiken (🟡)

| Risiko | Beschreibung | Wahrscheinlichkeit | Impact | Mitigation |
|--------|--------------|-------------------|--------|------------|
| **KI-Services DSGVO** | Deutsche Server erforderlich | NIEDRIG | MITTEL | Azure OpenAI (Frankfurt) oder Anthropic EU |
| **Barrierefreiheit** | BITV 2.0 / WCAG 2.2 AA verpflichtend | NIEDRIG | MITTEL | Barrierefreiheits-Expert*in |
| **Notification Service** | Echtzeit-Komplexität | NIEDRIG | MITTEL | Etablierte Technologie (Pusher, Firebase) |

### 8.3 Niedrige Risiken (🟢)

| Risiko | Beschreibung | Wahrscheinlichkeit | Impact | Mitigation |
|--------|--------------|-------------------|--------|------------|
| **Mehrsprachigkeit** | Drupal-Standardfunktion | NIEDRIG | NIEDRIG | i18n-Standard |
| **SEO** | Drupal hat gute SEO-Module | NIEDRIG | NIEDRIG | Standard-Best-Practices |

---

## 9. Kritische Klärungsfragen (Bieterfragen)

**VOR Angebotserstellung MÜSSEN geklärt werden:**

### 9.1 Information Manager REST-API
- ✅ Ist die API dokumentiert und stabil?
- ✅ Welche Endpunkte existieren (Kurse, Buchungen, Teilnehmende)?
- ✅ Gibt es Test-Zugang für Integration?
- ✅ Performance: Wie viele Requests/Sekunde?

### 9.2 Zahlungsintegration
- ✅ Welcher Payment Service Provider ist gewünscht/vorgegeben?
- ✅ PCI-DSS: Wird extern gehostet oder intern betrieben?
- ✅ Welche Zahlungsarten sind PFLICHT (Kreditkarte, PayPal, SEPA)?

### 9.3 KI-Services
- ✅ Ist Azure OpenAI (Frankfurt, Deutschland) akzeptabel?
- ✅ Welche DSGVO-Dokumentation wird erwartet?
- ✅ Muss KI-Chatbot bestimmte Compliance erfüllen?

### 9.4 Barrierefreiheit
- ✅ Wird externes BITV-Audit verlangt?
- ✅ Ist Zertifizierung erforderlich?
- ✅ Wer prüft Barrierefreiheit bei Abnahme?

### 9.5 Hosting & Infrastruktur
- ✅ Wer hostet die Plattform (VHS oder Dienstleister)?
- ✅ Welche Infrastruktur-Anforderungen gibt es?
- ✅ Cloud erlaubt oder On-Premise verpflichtend?

### 9.6 Wartung (3 Jahre)
- ✅ Welche SLAs werden erwartet?
- ✅ Reaktionszeiten definiert?
- ✅ Update-Zyklen vorgegeben?

---

## 10. BID/NO-BID Empfehlung

### ✅ **Empfehlung: BID** (unter Bedingungen)

**Begründung:**

**PRO BID:**
✅ Starke Passung zu adesso-Kompetenzen (Public Sector, Drupal, REST-APIs, Barrierefreiheit)
✅ adessoCMS-Baseline als Fundament vorhanden
✅ KI-unterstützte Entwicklung (Claude Code) = 77% Reduktion
✅ Nearshore-Kapazitäten verfügbar
✅ 3 Jahre Wartung = Planbare Einnahmen
✅ Referenzprojekt für Public Sector

**CONTRA BID:**
❌ Hohe Komplexität (8 Custom Modules, kritische Abhängigkeiten)
❌ 100% Preiswertung = Günstigstes Angebot gewinnt
❌ Risiken: API-Abhängigkeit, PCI-DSS, Fixe Deadline

### 10.1 Voraussetzungen für BID

**MUSS erfüllt sein:**

1. ✅ **Klärung kritischer Fragen** via Bieterfragen (siehe 9.)
2. ✅ **Nearshore-Kapazitäten** verbindlich sichern (Sales-Vorgabe!)
3. ✅ **SPOC mit Public-/Webportal-Erfahrung** verfügbar (min. 3 Jahre)
4. ✅ **Referenzen** für barrierefreie Webportale (BITV 2.0 / WCAG 2.2 AA)
5. ✅ **KI-Strategie** kommunizieren (Claude Code als USP)

**SOLLTE erfüllt sein:**

6. ⚠️ **Factorial oder 1xInternet** einbinden (Christian Huschke-Vorschlag)
7. ⚠️ **Payment-Expertise** im Team (PCI-DSS)
8. ⚠️ **Barrierefreiheits-Expert*in** verfügbar

---

## 11. Strategische Positionierung

### 11.1 USP (Unique Selling Proposition)

> **"Moderne KI-unterstützte Drupal-11-Lösung mit 77% kürzerer Entwicklungszeit"**

**Argumentationslinie:**

1. **Technologie:** Drupal 11 + adessoCMS-Baseline
2. **Methodik:** KI-unterstützte Entwicklung (Claude Code)
3. **Qualität:** Automatisierte Tests, BITV 2.0-konform
4. **Performance:** 77% schneller als traditionelle Entwicklung
5. **Preis:** Nearshore-Kalkulation = Wettbewerbsfähig

### 11.2 Kommunikation im Angebot

**Technisches Konzept:**
- adessoCMS-Baseline als Fundament
- 110 Drupal-Entities geplant
- 8 kritische Custom Modules
- Vollständige BITV 2.0 / WCAG 2.2 AA Konformität

**Projektorganisation:**
- Agiles Vorgehen (MUST/SHOULD/COULD)
- SPOC mit Public-Erfahrung
- Nearshore-Team für Entwicklung
- Onshore für PM + Barrierefreiheit

**Qualitätssicherung:**
- Automatisierte Tests (Unit, Integration, E2E)
- BITV-Audit durch externe Expert*innen
- PCI-DSS-konformer Payment Service Provider

---

## 12. Nächste Schritte

### 12.1 Sofort (diese Woche)

1. ✅ **Bieterfragen** formulieren und einreichen
2. ✅ **Nearshore-Kapazitäten** mit Sales klären (Hans Scharinger)
3. ✅ **SPOC** identifizieren (Christian Huschke?)
4. ✅ **Referenzen** aufbereiten (barrierefreie Projekte)

### 12.2 Nach Klärung (Woche 2-3)

5. ✅ **Detailliertes Angebot** kalkulieren (inkl. Wartung)
6. ✅ **Technisches Konzept** erstellen (Pflichtenheft-Grundlage)
7. ✅ **Team** zusammenstellen (Nearshore + Onshore)
8. ✅ **Factorial / 1xInternet** prüfen (Subunternehmer?)

### 12.3 Vor Abgabefrist (03.02.2026)

9. ✅ **Angebot** finalisieren
10. ✅ **Referenzen** beifügen
11. ✅ **Technisches Konzept** beifügen
12. ✅ **Fristgerecht** einreichen

---

## Anhang A: Dokument-Referenzen

| Dokument | Pfad |
|----------|------|
| **Gap-Analyse** | `audit_data/vhs-frankfurt/gap_analyse.md` |
| **Schätzung Vergleich** | `audit_data/vhs-frankfurt/schaetzung_vergleich.md` |
| **Audit Report** | `audit_data/vhs-frankfurt/audit_report.md` |
| **Lastenheft** | `input/Lastenheft Webinfrastruktur VHS_15.12.2025.pdf` |
| **Leistungsbeschreibung** | `input/Leistungsbeschreibung Webinfrastruktur VHS_15.12.2025.pdf` |
| **Mail (internes adesso)** | `input/mail.txt` |

---

## Anhang B: Kontakte & Verantwortlichkeiten

| Rolle | Name | E-Mail | Aufgabe |
|-------|------|--------|---------|
| **Sales Lead** | Hans Scharinger | Hans.Scharinger@adesso.de | Bid-Entscheidung, Nearshore |
| **Tech Lead** | Christian Huschke | Christian.Huschke@adesso.de | Technische Qualifizierung |
| **Public Lead (Vorschlag)** | Laura Schöning | Laura.Schoening@adesso.de | Ausschreibungs-Management |
| **Solutions Lead (Du)** | Marc Philipps | marc.philipps@adesso.de | Audit, Konzept, Architektur |

---

**Erstellt von:** Marc Philipps (Solutions Lead Drupal @ adesso SE)
**Datum:** 2026-01-08
**Version:** 1.0
