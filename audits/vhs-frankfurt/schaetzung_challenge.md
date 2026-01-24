# Schätzungs-Challenge: VHS Frankfurt Webinfrastruktur

**Erstellt:** 2026-01-08
**Projekt:** Neuentwicklung der Webinfrastruktur der VHS Frankfurt
**Quelle:** Offizielles Leistungsverzeichnis (Version 2)
**Abgabefrist:** 03.02.2026

---

## Executive Summary

**🚨 KRITISCHE DISKREPANZ GEFUNDEN:**

| Quelle | Entwicklungs-PT | Faktor |
|--------|----------------|--------|
| **Ausschreibung (offiziell)** | **445,8 PT** | **Baseline** |
| Meine Schätzung (traditionell) | 231 PT | **0,52x (48% zu niedrig!)** |
| Meine Schätzung (KI-unterstützt) | 104 PT | **0,23x (77% zu niedrig!)** |

**Die Ausschreibung schätzt fast DOPPELT so viel wie meine traditionelle Schätzung!**

---

## 1. Detaillierter Vergleich: Ausschreibung vs. Meine Schätzung

### 1.1 Gruppe 1: Erstellung Webinfrastruktur (Ausschreibung)

| Nr. | Bezeichnung | PT (8h/Tag) | % vom Gesamt |
|-----|-------------|-------------|--------------|
| 1.1 | Kick-off | 6 | 1,3% |
| 1.2 | Layout | 16,8 | 3,8% |
| **1.3** | **Setup, Konzeption & Projektleitung** | **109** | **24,4%** |
| **1.4** | **API/SDK** | **53,4** | **12,0%** |
| 1.5 | CMS | 61,6 | 13,8% |
| 1.6 | Kurssuche/Kursdetails | 24 | 5,4% |
| 1.7 | Account | 16,8 | 3,8% |
| 1.8 | Buchung | 30 | 6,7% |
| 1.9 | Payment | 16,2 | 3,6% |
| 1.10 | Gutscheine | 14,4 | 3,2% |
| 1.11 | Merkliste | 5,4 | 1,2% |
| 1.12 | Warenkorb | 5,4 | 1,2% |
| 1.13 | Reservierung | 5,4 | 1,2% |
| 1.14 | Buchung (Meine Kurse) | 9,6 | 2,2% |
| 1.15 | Kursalarm | 5,4 | 1,2% |
| 1.16 | Newsletter | 2,4 | 0,5% |
| 1.17 | Kursleiterportal | 24 | 5,4% |
| 1.18 | Export von Kursen | 3 | 0,7% |
| 1.19 | Notification Center | 7,8 | 1,7% |
| 1.20 | Chatbot/Support | 13,8 | 3,1% |
| 1.21 | Analytics | 12 | 2,7% |
| 1.22 | Logging | 2,4 | 0,5% |
| **GESAMT** | **Gruppe 1** | **445,8** | **100%** |

### 1.2 Gruppe 2: Wartung & Support (3 Jahre)

| Jahr | Umfang | PT |
|------|--------|----|
| Jahr 1 (2027-2028) | CMS Updates, Refactoring, Bugfixes, PM | 35 |
| Jahr 2 (2028-2029) | + Suchserver-Upgrade | 44 |
| Jahr 3 (2029-2030) | + CMS Major Release | 41 |
| **GESAMT** | **Wartung (3 Jahre)** | **120** |

**Gesamtvolumen Ausschreibung:** 445,8 PT (Entwicklung) + 120 PT (Wartung) = **565,8 PT**

---

## 2. Kritische Diskrepanzen

### 2.1 Position 1.3: Setup, Konzeption & Projektleitung (109 PT = 872h)

**Ausschreibung schätzt:**
- Projektsetup (Repos, CI/CD, Tools)
- Konzeption & Dokumentation
- QA & Testing (Unit-Tests, E2E-Tests)
- Projektleitung (gesamte Laufzeit)
- Benutzerschulung & Dokumentation

**Meine Schätzung hatte:**
- Projekt-Setup: ~16h
- Dokumentation: ~40h
- Testing: In Feature-Schätzungen enthalten
- Projektmanagement: **NICHT explizit geschätzt!**

**⚠️ PROBLEM:** Ich habe Projektmanagement komplett unterschätzt!

**Rechnung (Ausschreibung):**
- Projektlaufzeit: ~22 Monate (bis 31.10.2027)
- PM-Aufwand: ~40% der 109 PT = ~44 PT = 352h
- Das sind ~16h PM pro Monat über 22 Monate

**Challenge:**
- **Zu niedrig:** Schulungen (nicht geschätzt), PM-Overhead
- **Zu hoch:** 109 PT erscheint sehr großzügig für Setup
- **Realistisch:** 60-80 PT (480-640h) inkl. PM

---

### 2.2 Position 1.4: API/SDK (53,4 PT = 427h)

**Ausschreibung schätzt:**
- Anbindung Information-Manager-API
- 20 API-Endpunkte:
  - Registrierung, Login/Logout, Passwort vergessen
  - Nutzerdaten ändern, Teilnehmer verwalten
  - Warteliste, Reservierungen, Merkliste, Warenkorb
  - Kursalarm, Newsletter
  - Kurssuche, Kursdetails
  - Support-Anfragen
  - Payment, Buchung
  - Gutscheine, Promocodes
  - Kursleiterportal

**Meine Schätzung hatte:**
- API-Integration: ~80h (in "Integrationen" enthalten)
- Custom APIs: Implizit in Feature-Schätzungen

**⚠️ PROBLEM:** Ich habe API-Arbeit massiv unterschätzt!

**Challenge:**
- **Zu niedrig:** API-Fehlerbehandlung, Retry-Logik, Caching
- **Zu hoch:** 53,4 PT = 21,4h pro Endpunkt erscheint hoch
- **Realistisch:** 30-40 PT (240-320h) für robuste API-Integration

---

### 2.3 Position 1.5: CMS (61,6 PT = 493h)

**Ausschreibung schätzt:**
- Grundsetup
- Basis-Theme (Header, Footer, Navigation)
- Inhaltstypen
- Inhaltselemente (Paragraphs)
- Dynamisches Element: Kursliste
- Dynamisches Element: Kursteaser
- SEO
- Consent Management
- KI (Inhaltserstellung/Übersetzungen)

**Meine Schätzung hatte:**
- Content Types: 54h
- Paragraphs: 97h
- Theme-Basis: ~40h
- **Summe:** ~191h

**⚠️ PROBLEM:** Ich habe Theme-Arbeit und KI-Features unterschätzt!

**Challenge:**
- **Zu niedrig:** KI-Integration, Consent Management
- **Realistisch:** 45-55 PT (360-440h) inkl. KI & Consent

---

### 2.4 Position 1.6: Kurssuche/Kursdetails (24 PT = 192h)

**Ausschreibung schätzt:**
- Kurssuche (inkl. Filter und Sortierung)
- Kursdetails
- XML-Sitemap für Kurse
- Structured Data - Auszeichnung
- Kursfragen

**Meine Schätzung hatte:**
- Kurssuche (View): 16h
- Kursdetails: In Content Type enthalten (12h)
- **Summe:** ~28h

**⚠️ PROBLEM:** Structured Data, XML-Sitemap, Kursfragen nicht geschätzt!

**Challenge:**
- **Zu niedrig:** Structured Data, SEO-Optimierung
- **Realistisch:** 18-22 PT (144-176h)

---

### 2.5 Position 1.17: Kursleiterportal (24 PT = 192h)

**Ausschreibung schätzt:**
- Profil
- Listung meiner Kurse (Gruppiert/sortiert/gefiltert)
- Dokumentenverwaltung
- Teilnehmer-Management
- Teilnehmer-Benachrichtigungen
- Terminplanung

**Meine Schätzung hatte:**
- Kursleiterportal: **NICHT explizit geschätzt!**
- Implizit in "Personen" Content Type enthalten: 6h

**⚠️ PROBLEM:** Kursleiterportal komplett unterschätzt!

**Challenge:**
- **Zu niedrig:** Komplexes Portal unterschätzt
- **Realistisch:** 20-24 PT (160-192h)

---

## 3. Weitere Unterschätzte Bereiche

### 3.1 Testing & QA (in Position 1.3 enthalten)

**Ausschreibung:**
- Funktionale Tests
- Automatisierte Tests (Unit-Tests, E2E-Tests)
- Teil von 109 PT

**Meine Schätzung:**
- Testing implizit in Features: ~10% = ~185h

**Challenge:**
- **Realistisch:** 20-30% des Entwicklungsaufwands = 400-600h

---

### 3.2 Analytics (Position 1.21: 12 PT = 96h)

**Ausschreibung schätzt:**
- Basisdaten
- eCommerce Reports:
  - Warenkörbe, Merkzettel
  - Checkout, Newsletter
  - Suchen, Kursempfehlungen
  - Kursleiterprofile
  - CMS-Elemente

**Meine Schätzung:**
- Analytics: **NICHT geschätzt!**

**Challenge:**
- **Realistisch:** 10-12 PT (80-96h)

---

### 3.3 Notification Center (Position 1.19: 7,8 PT = 62h)

**Ausschreibung schätzt:**
- Interface für Benachrichtigungen
- Ausgabe auf Seite
- Push-Benachrichtigungen (inkl. Provider-Anbindung)

**Meine Schätzung:**
- Benachrichtigungen: In Paragraph geschätzt (8h)

**Challenge:**
- **Zu niedrig:** Push-Provider-Integration unterschätzt
- **Realistisch:** 6-8 PT (48-64h)

---

## 4. Zusammenfassung: Wo sind meine Schätzungen zu niedrig?

| Bereich | Meine Schätzung | Ausschreibung | Differenz | Challenge-Ergebnis |
|---------|----------------|---------------|-----------|-------------------|
| **Projektmanagement** | **0h** | **~350h** | **+350h** | **280h realistisch** |
| **API-Integration** | **80h** | **427h** | **+347h** | **280h realistisch** |
| **Testing & QA** | **185h** | **~400h** | **+215h** | **400h realistisch** |
| **Theme-Arbeit** | **40h** | **~200h** | **+160h** | **120h realistisch** |
| **Kursleiterportal** | **6h** | **192h** | **+186h** | **160h realistisch** |
| **Analytics** | **0h** | **96h** | **+96h** | **80h realistisch** |
| **Notification Center** | **8h** | **62h** | **+54h** | **48h realistisch** |
| **SEO/Structured Data** | **0h** | **~80h** | **+80h** | **60h realistisch** |
| **Consent Management** | **0h** | **~40h** | **+40h** | **32h realistisch** |
| **Schulungen** | **0h** | **~80h** | **+80h** | **40h realistisch** |

**Gesamte Unterschätzung:** +1.608h = +201 PT

---

## 5. Aktualisierte Schätzung

### 5.1 Traditionelle Entwicklung (ohne KI)

| Kategorie | Original | Challenge-Korrektur | Neu (Traditionell) |
|-----------|----------|---------------------|-------------------|
| Entities (Content Types, Paragraphs, etc.) | 223h | +60h (Detailarbeit) | 283h |
| Integrationen | 144h | +347h (API) | 491h |
| Custom Modules | 396h | +120h (Portal, Features) | 516h |
| Frontend/Theme | 408h | +200h (Theme-Arbeit, SEO) | 608h |
| Testing & QA | 185h | +215h (E2E, Unit) | 400h |
| Deployment | 56h | +20h (CI/CD) | 76h |
| Dokumentation | 40h | +40h (Schulungen) | 80h |
| Projektmanagement | 0h | +280h (PM) | 280h |
| Analytics & Monitoring | 0h | +80h (Analytics) | 80h |
| Sonstiges (Buffer) | 395h | -395h (umverteilt) | 0h |
| **GESAMT** | **1.847h** | **+967h** | **2.814h** |

**Traditionell (neu):** 2.814h = **352 PT @ 8h/Tag**

---

### 5.2 KI-unterstützte Entwicklung

Mit 55% KI-Ersparnis (wie ursprünglich geschätzt):

**KI-unterstützt (neu):** 2.814h × 0,45 = **1.266h = 158 PT @ 8h/Tag**

---

### 5.3 Vergleich mit Ausschreibung

| Quelle | Entwicklungs-PT | Vergleich |
|--------|----------------|-----------|
| **Ausschreibung (offiziell)** | **445,8 PT** | **Baseline** |
| Meine Schätzung (traditionell) - ALT | 231 PT | -48% (ZU NIEDRIG) |
| **Meine Schätzung (traditionell) - NEU** | **352 PT** | **-21% (besser!)** |
| Meine Schätzung (KI) - ALT | 104 PT | -77% (ZU NIEDRIG) |
| **Meine Schätzung (KI) - NEU** | **158 PT** | **-65% (immer noch niedrig)** |

---

## 6. Kritische Fragen zur Ausschreibungs-Schätzung

### 6.1 Ist die Ausschreibung zu hoch?

**Mögliche Gründe für hohe Schätzung:**

1. **Traditionelle Wasserfall-Methodik:** Keine Agile/Scrum, mehr Overhead
2. **Risiko-Puffer:** Öffentliche Ausschreibungen kalkulieren großzügig
3. **Umfangreiche Dokumentation:** Öffentlicher Sektor erfordert mehr Doku
4. **Langwierige Abstimmungsprozesse:** Mehr Meetings, mehr PM
5. **Keine KI-Tools:** Traditionelle Entwicklung ohne KI-Unterstützung

**Bereiche, die challengebar sind:**

| Position | Ausschreibung | Challenge | Begründung |
|----------|---------------|-----------|------------|
| 1.3 Setup/PM | 109 PT | 70-80 PT | PM-Overhead zu hoch kalkuliert |
| 1.4 API/SDK | 53,4 PT | 35-40 PT | 21h pro Endpunkt ist sehr hoch |
| 1.5 CMS | 61,6 PT | 45-50 PT | KI kann hier viel abnehmen |
| 1.20 Chatbot | 13,8 PT | 8-10 PT | Chatbot-Integration ist Standard |

**Mögliche Einsparungen:** 50-70 PT

**Ausschreibung nach Challenge:** 445,8 - 60 = **385 PT**

---

## 7. Empfehlungen für adesso-Angebot

### 7.1 Realistische Schätzung mit KI-Tools

| Kategorie | Stunden | PT @ 8h/Tag |
|-----------|---------|-------------|
| **Basis-Entwicklung** | 1.400h | 175 PT |
| **Projektmanagement** | 240h | 30 PT |
| **Testing & QA** | 320h | 40 PT |
| **Dokumentation & Schulung** | 80h | 10 PT |
| **Risiko-Puffer (10%)** | 204h | 26 PT |
| **GESAMT** | **2.244h** | **281 PT** |

---

### 7.2 Preisstrategie

**Option 1: Aggressiv (Wettbewerbsvorteil durch KI)**
- Angebot: **280 PT** (63% der Ausschreibung)
- Tagessatz: €850-950
- Gesamtpreis: €238.000 - €266.000
- **Risiko:** Zu niedrig = Qualitätszweifel?

**Option 2: Konservativ (Nähe an Ausschreibung)**
- Angebot: **380 PT** (85% der Ausschreibung)
- Tagessatz: €800-900
- Gesamtpreis: €304.000 - €342.000
- **Vorteil:** Seriöser, aber teuer

**Option 3: Mittelweg (EMPFOHLEN)**
- Angebot: **330 PT** (74% der Ausschreibung)
- Tagessatz: €850
- Gesamtpreis: **€280.500**
- **Begründung:** KI-Effizienz + realistischer Puffer

---

## 8. Nächste Schritte

1. ✅ Schätzung challengen (erledigt)
2. ⏭️ Preiskalkulation finalisieren
3. ⏭️ Risiko-Assessment durchführen
4. ⏭️ Wartungskosten kalkulieren (Gruppe 2)
5. ⏭️ Angebot formulieren

---

**Fazit:**

Die Ausschreibung schätzt **deutlich höher** als meine ursprüngliche Analyse. Nach gründlichem Challenge:

- **Meine ursprüngliche Schätzung war 40-50% zu niedrig**
- **Hauptgründe:** PM, API-Integration, Testing unterschätzt
- **Realistische Schätzung (mit KI):** 280-330 PT
- **Ausschreibungs-Budget:** 445,8 PT (mit Puffer)

**Wir haben Raum für ein kompetitives Angebot bei 330 PT!**

---

*Erstellt: 2026-01-08*
*Basis: Offizielles Leistungsverzeichnis Version 2*
