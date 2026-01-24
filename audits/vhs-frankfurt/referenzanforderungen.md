# Referenzanforderungen VHS Frankfurt Ausschreibung

**Erstellt:** 2026-01-08
**Projekt:** Neuentwicklung der Webinfrastruktur der VHS Frankfurt
**Abgabefrist:** 03.02.2026

---

## 1. Explizit Geforderte Nachweise

### 1.1 SPOC-Qualifikation (PFLICHT)

Aus **Leistungsbeschreibung Abschnitt 3.2:**

| Anforderung | Nachweis |
|-------------|----------|
| **Mindestens 3 Jahre IT-Projektleitungs-Erfahrung** | Projektliste mit Zeiträumen, Rollen, Projektvolumen |
| **Methodenkompetenz agil + hybrid** | Zertifikate (Scrum Master, PMP, etc.) + Projektreferenzen |
| **C2 Deutschkenntnisse (GER)** | Sprachzertifikat oder Muttersprachler-Nachweis |

**Konkrete Nachweise für adesso:**
- ✅ CV des SPOC (z.B. Christian Huschke, Laura Schöning)
- ✅ Zertifikate: Scrum Master, SAFe, PMP o.ä.
- ✅ Referenzprojekte des SPOC (min. 3 Projekte, jeweils >3 Monate)

---

## 2. Implizit Erwartete Referenzen (aus Anforderungen)

### 2.1 Barrierefreiheit (KRITISCH)

**Warum:** BITV 2.0 / WCAG 2.2 Level AA ist **gesetzlich verpflichtend** (Leistungsbeschreibung 2.5).

**Benötigte Referenzen:**

| Typ | Beschreibung | Anzahl | Priorität |
|-----|--------------|--------|-----------|
| **BITV 2.0 zertifizierte Projekte** | Öffentliche Webportale mit BITV-Zertifikat | Min. 2 | ⭐⭐⭐ HOCH |
| **WCAG 2.2 Level AA** | Nachweis erfolgreicher Accessibility-Audits | Min. 2 | ⭐⭐⭐ HOCH |
| **Barrierefreiheits-Expertise** | Projekte mit Screenreader-Tests, Tastaturnavigation | Min. 1 | ⭐⭐ MITTEL |

**Mögliche adesso-Referenzen:**
- [ ] Stadt XY - Bürgerportal (BITV 2.0 zertifiziert)
- [ ] Bundesbehörde XY - Webauftritt (WCAG 2.1 AA)
- [ ] Hochschule XY - Studienportal (Accessibility-geprüft)

---

### 2.2 Public Sector / Öffentliche Auftraggeber

**Warum:** VHS ist öffentlicher Träger (Stadt Frankfurt), Vergaberecht, Transparenzpflichten.

**Benötigte Referenzen:**

| Typ | Beschreibung | Anzahl | Priorität |
|-----|--------------|--------|-----------|
| **Öffentliche Auftraggeber** | Kommunen, Länder, Bundesbehörden | Min. 3 | ⭐⭐⭐ HOCH |
| **Bildungssektor** | VHS, Hochschulen, Bildungseinrichtungen | Min. 1 | ⭐⭐⭐ HOCH |
| **Vergaberecht-Erfahrung** | Projekte nach VOL/IT, UVgO | Min. 2 | ⭐⭐ MITTEL |

**Mögliche adesso-Referenzen:**
- [ ] Stadt/Gemeinde XY - Webauftritt
- [ ] Landesbehörde XY - Fachverfahren
- [ ] VHS XY oder Bildungsträger - Portal (IDEAL!)

---

### 2.3 CMS-Implementierungen (Drupal bevorzugt)

**Warum:** CMS-basiert ist Pflicht (Leistungsbeschreibung 2.1), Drupal 11 ist Ziel-CMS.

**Benötigte Referenzen:**

| Typ | Beschreibung | Anzahl | Priorität |
|-----|--------------|--------|-----------|
| **Drupal-Projekte** | Drupal 9, 10 oder 11 Implementierungen | Min. 3 | ⭐⭐⭐ HOCH |
| **CMS-Migrationen** | Komplett-Neuentwicklungen (kein Upgrade) | Min. 2 | ⭐⭐ MITTEL |
| **On-Premise CMS** | Keine Cloud-Lösungen (wichtig!) | Min. 2 | ⭐⭐⭐ HOCH |

**Mögliche adesso-Referenzen:**
- [ ] adessoCMS-Baseline Projekt (Showcase)
- [ ] Kunde XY - Drupal 10 Migration
- [ ] Kunde XY - Drupal 11 Neuentwicklung

---

### 2.4 E-Commerce / Buchungssysteme

**Warum:** Kursbuchung, Warenkorb, Payment-Integration, PCI-DSS (Lastenheft).

**Benötigte Referenzen:**

| Typ | Beschreibung | Anzahl | Priorität |
|-----|--------------|--------|-----------|
| **Buchungssysteme** | Online-Buchung mit Warenkorb | Min. 2 | ⭐⭐⭐ HOCH |
| **Payment-Integration** | Kreditkarte, PayPal, SEPA | Min. 2 | ⭐⭐⭐ HOCH |
| **PCI-DSS-Konformität** | Zahlungsabwicklung nach Standard | Min. 1 | ⭐⭐ MITTEL |
| **Wartelisten-Management** | Automatische Benachrichtigungen | Min. 1 | ⭐ NIEDRIG |

**Mögliche adesso-Referenzen:**
- [ ] E-Commerce Plattform XY (Payment)
- [ ] Ticket-System XY (Buchungslogik)
- [ ] Event-Portal XY (Wartelisten)

---

### 2.5 REST-API-Integrationen

**Warum:** Information Manager API (PFLICHT), Suchserver, Notification Service, DOX42.

**Benötigte Referenzen:**

| Typ | Beschreibung | Anzahl | Priorität |
|-----|--------------|--------|-----------|
| **REST-API-Entwicklung** | Schnittstellenintegration zu Drittsystemen | Min. 3 | ⭐⭐⭐ HOCH |
| **Legacy-System-Integration** | Anbindung bestehender Systeme (MSSQL, etc.) | Min. 2 | ⭐⭐⭐ HOCH |
| **Bidirektionale Synchronisation** | Daten-Austausch in beide Richtungen | Min. 1 | ⭐⭐ MITTEL |

**Mögliche adesso-Referenzen:**
- [ ] Fachverfahren XY - SAP-Integration
- [ ] Portal XY - Legacy-Anbindung
- [ ] System XY - Microservices-Architektur

---

### 2.6 Agile Projekte / MVP-Ansatz

**Warum:** Agiles Vorgehensmodell ist PFLICHT (Leistungsbeschreibung 2.6).

**Benötigte Referenzen:**

| Typ | Beschreibung | Anzahl | Priorität |
|-----|--------------|--------|-----------|
| **Scrum/Agile Projekte** | Iterative Entwicklung mit Sprints | Min. 3 | ⭐⭐⭐ HOCH |
| **MVP-Entwicklung** | Minimum Viable Products | Min. 2 | ⭐⭐ MITTEL |
| **Hybride Vorgehensmodelle** | Agil + Wasserfall-Elemente | Min. 1 | ⭐⭐ MITTEL |

**Mögliche adesso-Referenzen:**
- [ ] Projekt XY - Scrum (6 Monate)
- [ ] Projekt XY - MVP-first Ansatz
- [ ] Projekt XY - SAFe Framework

---

### 2.7 Mehrsprachigkeit

**Warum:** DE + EN verpflichtend, Erweiterbarkeit erforderlich (Leistungsbeschreibung 2.2).

**Benötigte Referenzen:**

| Typ | Beschreibung | Anzahl | Priorität |
|-----|--------------|--------|-----------|
| **Mehrsprachige Portale** | Min. 2 Sprachen | Min. 2 | ⭐⭐ MITTEL |
| **i18n-Implementierung** | Internationalisierung (Drupal-Standard) | Min. 1 | ⭐ NIEDRIG |

**Mögliche adesso-Referenzen:**
- [ ] Internationales Portal XY (DE/EN/FR)
- [ ] Mehrsprachige Website XY

---

### 2.8 Performance & Skalierbarkeit

**Warum:** Kurze Ladezeiten PFLICHT, Lasttests erforderlich (Leistungsbeschreibung 2.1).

**Benötigte Referenzen:**

| Typ | Beschreibung | Anzahl | Priorität |
|-----|--------------|--------|-----------|
| **Performance-Optimierung** | Projekte mit Lasttest-Nachweis | Min. 2 | ⭐⭐ MITTEL |
| **Skalierbare Architekturen** | High-Traffic Websites (>100k Besucher/Monat) | Min. 1 | ⭐ NIEDRIG |

**Mögliche adesso-Referenzen:**
- [ ] High-Traffic Portal XY (Performance-Tests)
- [ ] Skalierbare Plattform XY

---

## 3. Empfohlene Referenzen (Wettbewerbsvorteile)

### 3.1 KI-Integration (USP!)

**Warum:** Chatbot-Integration ist PFLICHT, KI-gestützte Texterstellung gewünscht (Lastenheft).

**Empfohlene Referenzen:**

| Typ | Beschreibung | Anzahl | Vorteil |
|-----|--------------|--------|---------|
| **Chatbot-Implementierungen** | 24/7 Chatbots mit Eskalation | Min. 1 | ⭐⭐ Differenzierung |
| **KI-Services (DSGVO)** | Deutsche Server (Azure OpenAI Frankfurt, etc.) | Min. 1 | ⭐⭐⭐ KRITISCH |
| **Claude Code Development** | AI-assisted Development (USP!) | Min. 1 | ⭐⭐⭐ HOCH |

**Mögliche adesso-Referenzen:**
- [ ] Chatbot-Projekt XY (Azure Bot Service)
- [ ] KI-gestützte Content-Erstellung XY
- [ ] **Claude Code Showcase** (intern dokumentieren!)

---

### 3.2 Personalisierung & Recommendation Engines

**Warum:** Zielgruppenorientierte Ansprache gewünscht (Leistungsbeschreibung 2.2).

**Empfohlene Referenzen:**

| Typ | Beschreibung | Anzahl | Vorteil |
|-----|--------------|--------|---------|
| **Personalisierungslogik** | Empfehlungssysteme, Personalisierung | Min. 1 | ⭐⭐ Differenzierung |

---

### 3.3 Notification Services

**Warum:** Browser-Push, In-App-Notifications erforderlich (Lastenheft).

**Empfohlene Referenzen:**

| Typ | Beschreibung | Anzahl | Vorteil |
|-----|--------------|--------|---------|
| **Push-Notification-Systeme** | Browser-Push, In-App | Min. 1 | ⭐⭐ Differenzierung |

---

### 3.4 Social Login

**Warum:** Google, Facebook Login erforderlich (Leistungsbeschreibung 2.3).

**Empfohlene Referenzen:**

| Typ | Beschreibung | Anzahl | Vorteil |
|-----|--------------|--------|---------|
| **OAuth 2.0 Implementierungen** | Social Login (Google, Facebook) | Min. 1 | ⭐ Nice-to-Have |

---

## 4. Referenz-Matrix (Prioritäten-Übersicht)

| Kategorie | Anzahl Min. | Priorität | Status adesso |
|-----------|-------------|-----------|---------------|
| **BITV 2.0 / WCAG 2.2 AA** | 2-3 | ⭐⭐⭐ KRITISCH | ❓ Zu prüfen |
| **Public Sector** | 3 | ⭐⭐⭐ HOCH | ✅ Vorhanden |
| **Drupal-Projekte** | 3 | ⭐⭐⭐ HOCH | ✅ Vorhanden |
| **Buchungssysteme/Payment** | 2 | ⭐⭐⭐ HOCH | ❓ Zu prüfen |
| **REST-API-Integrationen** | 3 | ⭐⭐⭐ HOCH | ✅ Vorhanden |
| **Agile Projekte** | 3 | ⭐⭐⭐ HOCH | ✅ Vorhanden |
| **On-Premise CMS** | 2 | ⭐⭐⭐ HOCH | ❓ Zu prüfen |
| **Mehrsprachigkeit** | 2 | ⭐⭐ MITTEL | ✅ Vorhanden |
| **KI-Integration (DSGVO)** | 1 | ⭐⭐⭐ KRITISCH | ❓ Zu prüfen |
| **Chatbot-Implementierung** | 1 | ⭐⭐ MITTEL | ❓ Zu prüfen |
| **Performance-Optimierung** | 2 | ⭐⭐ MITTEL | ✅ Vorhanden |

---

## 5. Format der Referenzen

### 5.1 Mindestangaben pro Referenz

Für jede Referenz sollte dokumentiert werden:

```markdown
**Projekt:** [Name des Projekts]
**Kunde:** [Name des Kunden (anonymisiert, falls erforderlich)]
**Branche:** [Öffentliche Verwaltung, Bildung, etc.]
**Zeitraum:** [MM/YYYY - MM/YYYY]
**Projektvolumen:** [PT oder €]
**Rolle adesso:** [Generalunternehmer, Subunternehmer, etc.]
**Technologie-Stack:** [Drupal 10, PHP 8.2, etc.]

**Beschreibung:**
- Kurze Projektbeschreibung (3-5 Sätze)
- Herausforderungen und Lösungsansätze
- Besondere Erfolge

**Relevanz für VHS Frankfurt:**
- BITV 2.0 zertifiziert ✅
- REST-API-Integration ✅
- Payment-System ✅
- etc.

**Ansprechpartner Kunde:** [Name, Rolle] (optional)
**Referenzbereitschaft:** ✅ Ja / ❌ Nein
```

---

## 6. Kritische Lücken & Handlungsempfehlungen

### 6.1 Identifizierte Risiken

| Lücke | Beschreibung | Handlung |
|-------|--------------|----------|
| **BITV 2.0 Zertifikate** | Unklar, ob 2+ zertifizierte Projekte vorhanden | ✅ SOFORT prüfen (KO-Kriterium!) |
| **KI-Services (DSGVO)** | Deutsche Server für Chatbot/KI erforderlich | ✅ Azure OpenAI Frankfurt dokumentieren |
| **Payment/PCI-DSS** | Unklar, ob Payment-Referenzen vorhanden | ✅ E-Commerce Projekte prüfen |
| **VHS-spezifische Referenz** | Idealerweise andere VHS oder Bildungsträger | ⚠️ Nice-to-Have, nicht PFLICHT |
| **On-Premise CMS** | Cloud ist ausgeschlossen | ✅ Explizit On-Premise Projekte listen |

---

## 7. Empfohlene Referenz-Zusammenstellung (Angebot)

### 7.1 Kernreferenzen (MUSS)

**Mindestens 5-7 Referenzen mit folgender Abdeckung:**

1. **Referenz 1: Public Sector + BITV 2.0 + Drupal**
   - Beispiel: Stadt XY - Bürgerportal (Drupal 10, BITV-zertifiziert)
   - Deckt ab: Public Sector, Barrierefreiheit, CMS

2. **Referenz 2: Bildungssektor + Buchungssystem**
   - Beispiel: Hochschule XY - Event-/Kursbuchung
   - Deckt ab: Bildung, Booking, Payment

3. **Referenz 3: REST-API-Integration + Legacy-System**
   - Beispiel: Behörde XY - Fachverfahren-Anbindung
   - Deckt ab: API, Legacy, On-Premise

4. **Referenz 4: Agile Großprojekt + MVP**
   - Beispiel: Kunde XY - Agile Entwicklung (Scrum)
   - Deckt ab: Agile, MVP, Methodenkompetenz

5. **Referenz 5: Mehrsprachigkeit + Performance**
   - Beispiel: Internationales Portal XY (DE/EN)
   - Deckt ab: i18n, Performance, Skalierung

**Optional (Differenzierung):**

6. **Referenz 6: KI/Chatbot + DSGVO**
   - Beispiel: Chatbot-Implementierung (Azure OpenAI Deutschland)
   - Deckt ab: KI, Chatbot, DSGVO-Konformität

7. **Referenz 7: adessoCMS Baseline**
   - Beispiel: Showcase-Projekt (693h, 110+ Entities)
   - Deckt ab: Drupal-Expertise, Methodenkompetenz

---

## 8. SPOC-Nachweis (Personenbezogen)

### 8.1 Erforderliche Unterlagen

**Für den benannten SPOC (z.B. Christian Huschke):**

| Dokument | Beschreibung | Status |
|----------|--------------|--------|
| **Lebenslauf** | CV mit Projekthistorie | ✅ Vorbereiten |
| **Zertifikate** | Scrum Master, PMP, SAFe, etc. | ✅ Kopien beifügen |
| **Projektliste** | Min. 3 Projekte als PL (>3 Jahre Erfahrung) | ✅ Erstellen |
| **Sprachnachweis** | C2 Deutsch (GER) - Muttersprachler oder Zertifikat | ✅ Ggf. Erklärung |
| **Erreichbarkeit** | Kontaktdaten, Verfügbarkeit | ✅ Dokumentieren |

### 8.2 Projektliste SPOC (Beispiel-Format)

```markdown
**Projekt 1:**
- Name: [Projekt XY]
- Kunde: [Kunde XY]
- Rolle: Projektleiter
- Zeitraum: 01/2022 - 12/2023 (24 Monate)
- Volumen: 450 PT
- Vorgehensmodell: Scrum
- Team-Größe: 8 Personen
- Kurzbeschreibung: [...]

**Projekt 2:**
- [...]
```

---

## 9. Nächste Schritte (Sofort-Maßnahmen)

### 9.1 Diese Woche (vor 10.01.2026)

- [ ] **Referenz-Inventar erstellen**: Alle verfügbaren adesso-Referenzen auflisten
- [ ] **BITV 2.0 Projekte identifizieren**: KRITISCH - Gibt es 2+ zertifizierte Projekte?
- [ ] **SPOC benennen**: Christian Huschke? Laura Schöning? Andere?
- [ ] **SPOC-Unterlagen zusammenstellen**: CV, Zertifikate, Projektliste
- [ ] **Payment-Referenzen prüfen**: PCI-DSS-konforme Projekte vorhanden?
- [ ] **KI/DSGVO dokumentieren**: Azure OpenAI (Frankfurt) als Lösung beschreiben

### 9.2 Woche 2 (bis 17.01.2026)

- [ ] **Referenzen aufbereiten**: 5-7 Kernreferenzen im Format oben
- [ ] **Referenzbestätigungen einholen**: Kundenkontakte fragen
- [ ] **Lücken schließen**: Fehlende Referenzen durch Subunternehmer?
- [ ] **Factorial/1xInternet prüfen**: Können die BITV-Lücke schließen?

### 9.3 Vor Abgabefrist (03.02.2026)

- [ ] **Referenzen ins Angebot integrieren**
- [ ] **SPOC-Nachweis beifügen**
- [ ] **Qualifikationen dokumentieren**

---

## 10. Kritische Fragen an Sales/Recruiting

**An Hans Scharinger (Sales):**
1. ✅ Welche BITV 2.0 zertifizierten Projekte haben wir?
2. ✅ Gibt es Payment/PCI-DSS Referenzen?
3. ✅ Können wir Factorial/1xInternet als Subunternehmer einbinden (BITV-Expertise)?

**An Recruiting/HR:**
1. ✅ Wer kann SPOC sein? (3+ Jahre IT-PM, C2 Deutsch, verfügbar bis 10/2030)
2. ✅ Sind Zertifikate vorhanden (Scrum, PMP, etc.)?

**An Christian Huschke:**
1. ✅ Kannst du SPOC sein für dieses Projekt?
2. ✅ Welche Referenzprojekte kannst du beisteuern?

---

**Erstellt von:** Marc Philipps (Solutions Lead Drupal @ adesso SE)
**Datum:** 2026-01-08
**Version:** 1.0
**Status:** ENTWURF - Review erforderlich
