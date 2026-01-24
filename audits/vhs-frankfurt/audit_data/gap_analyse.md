# Gap-Analyse: VHS Frankfurt Webinfrastruktur

**Erstellt:** 2026-01-08
**Projekt:** Neuentwicklung der Webinfrastruktur der VHS Frankfurt
**Ausschreibung:** Stadt Frankfurt am Main
**Abgabefrist:** 03.02.2026

---

## Executive Summary

Die aktuelle VHS Frankfurt Website (vhs.frankfurt.de) läuft auf **Kentico CMS** (proprietär, .NET-basiert). Das Lastenheft fordert eine vollständige Neuentwicklung mit einem modernen CMS. Da keine Drupal-Migration möglich ist, handelt es sich um eine **komplette Neuentwicklung**.

**Gesamtbewertung:**
- ✅ Erfüllt: 12 Anforderungen
- ⚠️ Teilweise: 8 Anforderungen
- ❌ Fehlt/Neu: 24 Anforderungen

**Aufwand-Kategorie:** GROSS (>150% der adessoCMS-Baseline)

---

## 1. Technologie-Stack

### IST-Zustand (Kentico CMS)

| Komponente | Technologie | Version |
|------------|-------------|---------|
| CMS | Kentico CMS | - |
| Framework | Microsoft ASP.NET | 4.0.30319 |
| Server | IIS | 10.0 |
| OS | Windows Server | - |
| UI | Bootstrap | - |
| JS | jQuery, Moment.js, toastr | 2.1.1, 2.17.1, 2.1.3 |
| CDN | Cloudflare | - |
| Auth | Facebook Login, Google Sign-in | - |

### SOLL-Zustand (Drupal 11)

| Komponente | Technologie | Version |
|------------|-------------|---------|
| CMS | Drupal | 11.x |
| Framework | Symfony (PHP) | 7.x |
| Server | Apache/Nginx | Latest |
| OS | Linux | - |
| UI | Tailwind CSS / Bootstrap | 4.x |
| JS | Alpine.js / Vanilla | - |
| CDN | Cloudflare (beibehalten) | - |
| Auth | OAuth 2.0 (Social Login) | - |

**Status:** ❌ Komplette Neuentwicklung erforderlich

---

## 2. Funktionale Gap-Analyse

### 2.1 Benutzerregistrierung & Login

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Native Registrierung (Private) | ✅ | ✅ | ✅ Erfüllt |
| Native Registrierung (Firmen) | ❓ | ✅ | ⚠️ Prüfen |
| Social Login (Google) | ✅ | ✅ | ✅ Erfüllt |
| Social Login (Facebook) | ✅ | ✅ | ✅ Erfüllt |
| Passwort-Sicherheit (Verschlüsselung) | ❓ | ✅ | ⚠️ Prüfen |
| Passwort vergessen | ✅ | ✅ | ✅ Erfüllt |
| E-Mail-Verifizierung | ❓ | ✅ | ⚠️ Prüfen |
| Externe Kontoverknüpfung | ❌ | ✅ | ❌ Neu |

### 2.2 Kurssuche & Navigation

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Volltextsuche | ✅ | ✅ | ✅ Erfüllt |
| Tippfehlerkorrektur | ❓ | ✅ | ⚠️ Prüfen |
| Synonyme-Suche | ❓ | ✅ | ⚠️ Prüfen |
| Filter: Datum | ❓ | ✅ | ⚠️ Prüfen |
| Filter: Uhrzeit | ❓ | ✅ | ⚠️ Prüfen |
| Filter: Preis | ❓ | ✅ | ⚠️ Prüfen |
| Filter: Ort | ❓ | ✅ | ⚠️ Prüfen |
| Filter: Umkreis (Location API) | ❌ | ✅ | ❌ Neu |
| Suchergebnisse max. 1,5 Sek. | ❓ | ✅ | ⚠️ Prüfen |
| Suchserver-Integration | ❓ | ✅ Pflicht | ❌ Neu |

### 2.3 Kursbuchung & Warenkorb

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Warenkorb | ✅ | ✅ | ✅ Erfüllt |
| Checkout | ✅ | ✅ | ✅ Erfüllt |
| Datennacherfassung | ❓ | ✅ | ⚠️ Prüfen |
| Warteliste-Buchung | ❓ | ✅ | ❌ Neu |
| Automatische Wartelisten-Benachrichtigung | ❌ | ✅ | ❌ Neu |
| Zeitbasierte Reservierungs-Freigabe | ❌ | ✅ | ❌ Neu |

### 2.4 Nutzerkonto

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Profilverwaltung | ✅ | ✅ | ✅ Erfüllt |
| Buchungsübersicht | ✅ | ✅ | ✅ Erfüllt |
| Ermäßigungsnachweise | ❓ | ✅ | ❌ Neu |
| KI-Validierung Ermäßigungsnachweise | ❌ | ✅ | ❌ Neu |
| Merkliste | ✅ | ✅ | ✅ Erfüllt |

### 2.5 E-Payment

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Kreditkarte | ❓ | ✅ | ❌ Neu |
| PayPal | ❓ | ✅ | ❌ Neu |
| SEPA-Lastschrift | ❓ | ✅ | ❌ Neu |
| IBAN-Validierung | ❌ | ✅ | ❌ Neu |
| Rechnung (Firmen) | ❓ | ✅ | ❌ Neu |
| Gutscheine | ❓ | ✅ | ❌ Neu |
| PCI-DSS-Konformität | ❓ | ✅ Pflicht | ❌ Prüfen |

### 2.6 Kursleitenden-Portal (NEU)

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Kursleitenden-Profil | ❌ | ✅ | ❌ Neu |
| Kursübersicht (eigene Kurse) | ❌ | ✅ | ❌ Neu |
| Terminplanung | ❌ | ✅ | ❌ Neu |
| Teilnehmerverwaltung | ❌ | ✅ | ❌ Neu |
| Dokumentenverwaltung | ❌ | ✅ | ❌ Neu |
| Teilnahmebescheinigungen (DOX42) | ❌ | ✅ | ❌ Neu |

### 2.7 Notification Center (NEU)

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Browser-Push-Notifications | ❌ | ✅ | ❌ Neu |
| E-Mail-Benachrichtigungen | ✅ | ✅ | ✅ Erfüllt |
| In-App-Benachrichtigungen | ❌ | ✅ | ❌ Neu |
| Echtzeit-Updates | ❌ | ✅ | ❌ Neu |

### 2.8 KI-Funktionalitäten (NEU)

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| KI-Chatbot | ❌ | ✅ | ❌ Neu |
| KI-gestützte Texterstellung (CMS) | ❌ | ✅ | ❌ Neu |
| KI-Support-Anfragen | ❌ | ✅ | ❌ Neu |
| Deutsche Server (DSGVO) | - | ✅ Pflicht | ❌ Neu |

### 2.9 CMS-Backend

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Content-Erstellung | ✅ | ✅ | ✅ Erfüllt |
| Komponentenbasiertes System | ❓ | ✅ | ⚠️ Prüfen |
| Mehrsprachigkeit | ❓ | ✅ | ❌ Neu |
| Benutzer-/Rechteverwaltung | ✅ | ✅ | ✅ Erfüllt |
| SEO-Funktionalität | ❓ | ✅ | ⚠️ Prüfen |
| Versionierung | ❓ | ✅ | ⚠️ Prüfen |
| Workflows/Freigaben | ❓ | ✅ | ❌ Neu |
| "Leichte Sprache" | ✅ | ✅ | ✅ Erfüllt |

---

## 3. Nicht-funktionale Anforderungen

### 3.1 Performance

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| Suchantwort max. 1,5 Sek. | ❓ | ✅ | ⚠️ Testen |
| Bilder-Optimierung | ❓ | ✅ | ⚠️ Prüfen |
| Responsive Design | ✅ | ✅ | ✅ Erfüllt |
| Mobile First | ❓ | ✅ | ⚠️ Prüfen |

### 3.2 Sicherheit

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| HTTPS/TLS | ✅ | ✅ | ✅ Erfüllt |
| HSTS | ✅ | ✅ | ✅ Erfüllt |
| DSGVO-Konformität | ❓ | ✅ | ⚠️ Audit |
| PCI-DSS (Payment) | ❓ | ✅ | ❌ Neu |
| Datenschutz-Zustimmung | ✅ | ✅ | ✅ Erfüllt |

### 3.3 Barrierefreiheit

| Anforderung | IST | SOLL | Status |
|-------------|-----|------|--------|
| BITV 2.0 | ⚠️ | ✅ Pflicht | ⚠️ Mängel |
| WCAG 2.2 Level AA | ⚠️ | ✅ Pflicht | ⚠️ Mängel |
| Tastaturbedienbarkeit | ❓ | ✅ | ⚠️ Prüfen |
| Screenreader-Kompatibilität | ❓ | ✅ | ⚠️ Prüfen |
| Kontrastverhältnisse | ❌ | ✅ | ❌ Mängel |

**Gefundene Barrierefreiheits-Mängel (IST):**
- ❌ Suchbutton: Kontrastverhältnis 1.91:1 (erforderlich: 4.5:1)
  - Vordergrund: #ffffff, Hintergrund: #b1c609

---

## 4. Integrationen

### 4.1 VHS-interne Systeme

| System | IST | SOLL | Status |
|--------|-----|------|--------|
| Information Manager (Kursverwaltung) | ✅ | ✅ REST-API | ⚠️ Neu implementieren |
| Suchserver (Volltextsuche) | ❓ | ✅ REST-API | ❌ Neu |
| Notification Service | ❌ | ✅ REST-API | ❌ Neu |
| DOX42 (Dokumentgenerierung) | ❌ | ✅ | ❌ Neu |

### 4.2 Externe Services

| Service | IST | SOLL | Status |
|---------|-----|------|--------|
| Google API (Social Login) | ✅ | ✅ | ✅ Erfüllt |
| Facebook API (Social Login) | ✅ | ✅ | ✅ Erfüllt |
| Payment Service Provider | ❓ | ✅ | ❌ Neu |
| Location-APIs (Umkreissuche) | ❌ | ✅ | ❌ Neu |
| IBAN-Validierungs-API | ❌ | ✅ | ❌ Neu |

---

## 5. Drupal-Mapping für Neuentwicklung

### 5.1 Content Types (Inhaltstypen)

| Feature | Drupal Entity | Komplexität | Stunden |
|---------|---------------|-------------|---------|
| Kurs | Content Type: `course` | HOCH | 12h |
| Landingpage | Content Type: `landing_page` | HOCH | 10h |
| News/Aktuelles | Content Type: `news` | MITTEL | 6h |
| Veranstaltung | Content Type: `event` | MITTEL | 8h |
| Service-Seite | Content Type: `page` | EINFACH | 3h |
| Person (Kursleitende) | Content Type: `person` | MITTEL | 6h |
| FAQ | Content Type: `faq` | EINFACH | 3h |
| Standort | Content Type: `location` | MITTEL | 6h |
| **Gesamt Content Types** | **8** | | **54h** |

### 5.2 Paragraph Types (Komponenten)

| Komponente | Drupal Paragraph | Komplexität | Stunden |
|------------|------------------|-------------|---------|
| Hero-Banner | `hero` | MITTEL | 4h |
| Kurs-Card | `course_card` | MITTEL | 4h |
| Text | `text` | EINFACH | 1h |
| Bild/Media | `media` | EINFACH | 1h |
| Galerie | `gallery` | MITTEL | 3h |
| Akkordeon/FAQ | `accordion` | MITTEL | 3h |
| Card-Group | `card_group` | MITTEL | 4h |
| Kontakt-Teaser | `contact_teaser` | EINFACH | 2h |
| Newsletter-Formular | `newsletter` | MITTEL | 3h |
| Kurs-Carousel | `course_carousel` | HOCH | 6h |
| Standort-Karte | `location_map` | HOCH | 6h |
| Download-Bereich | `downloads` | EINFACH | 2h |
| Video-Embed | `video_embed` | EINFACH | 2h |
| Suche-Widget | `search_widget` | HOCH | 8h |
| Warenkorb-Widget | `cart_widget` | HOCH | 8h |
| Login-Widget | `login_widget` | HOCH | 8h |
| Kursleitenden-Profil | `instructor_profile` | MITTEL | 4h |
| Buchungsübersicht | `booking_overview` | HOCH | 8h |
| Benachrichtigungen | `notifications` | HOCH | 8h |
| Chatbot-Widget | `chatbot` | HOCH | 12h |
| **Gesamt Paragraphs** | **20** | | **97h** |

### 5.3 Taxonomies (Klassifikationen)

| Taxonomie | Drupal Vocabulary | Komplexität | Stunden |
|-----------|-------------------|-------------|---------|
| Kurskategorie | `course_category` | MITTEL (hierarchisch) | 4h |
| Programmbereich | `program_area` | EINFACH | 2h |
| Tags | `tags` | EINFACH | 1h |
| Standorte | `locations` | EINFACH | 2h |
| Zielgruppen | `target_groups` | EINFACH | 2h |
| **Gesamt Taxonomies** | **5** | | **11h** |

### 5.4 Views (Listenansichten)

| View | Beschreibung | Komplexität | Stunden |
|------|--------------|-------------|---------|
| Kurssuche | Volltextsuche mit Filtern | HOCH | 16h |
| Kursübersicht | Kategoriebasierte Listung | MITTEL | 6h |
| News-Übersicht | Aktuelles-Listing | MITTEL | 4h |
| Veranstaltungen | Event-Kalender | MITTEL | 6h |
| Kursleitende | Team-Übersicht | MITTEL | 4h |
| Standorte | Standort-Listing | EINFACH | 3h |
| Meine Buchungen | User-Dashboard | HOCH | 8h |
| Meine Kurse (Kursleitende) | Kursleitenden-Dashboard | HOCH | 8h |
| Ähnliche Kurse | Kurs-Empfehlungen | MITTEL | 6h |
| **Gesamt Views** | **9** | | **61h** |

### 5.5 Webforms (Formulare)

| Formular | Beschreibung | Komplexität | Stunden |
|----------|--------------|-------------|---------|
| Kontaktformular | Standard-Kontakt | EINFACH | 2h |
| Kurs-Anfrage | Spezifische Kursanfrage | MITTEL | 4h |
| Newsletter-Anmeldung | E-Mail-Signup | EINFACH | 2h |
| Beratungsanfrage | Mehrstufig | HOCH | 8h |
| Ermäßigungsantrag | Mit Dokumenten-Upload | HOCH | 10h |
| **Gesamt Webforms** | **5** | | **26h** |

### 5.6 Custom Modules (Individuelle Module)

| Modul | Beschreibung | Komplexität | Stunden |
|-------|--------------|-------------|---------|
| VHS Information Manager Integration | REST-API zu Kursverwaltung | HOCH | 80h |
| VHS Payment | Payment-Integration (PSP) | HOCH | 60h |
| VHS Notification | Browser-Push + In-App | HOCH | 40h |
| VHS Booking | Buchungs-/Warenkorb-Logik | HOCH | 60h |
| VHS Instructor Portal | Kursleitenden-Funktionen | HOCH | 50h |
| VHS Chatbot | KI-Integration (deutsche Server) | HOCH | 40h |
| VHS Waitlist | Wartelisten-Management | MITTEL | 20h |
| VHS DOX42 | Dokumentgenerierung | MITTEL | 20h |
| **Gesamt Custom Modules** | **8** | | **370h** |

### 5.7 Theme Components (SDC)

| Komponente | Beschreibung | Komplexität | Stunden |
|------------|--------------|-------------|---------|
| Header | Navigation + Login + Warenkorb | HOCH | 12h |
| Footer | Links + Newsletter | MITTEL | 6h |
| Kurs-Card | Kursdarstellung | MITTEL | 4h |
| Suche-Ergebnis | Suchergebnisdarstellung | MITTEL | 4h |
| Filter-Panel | Suchfilter-UI | HOCH | 8h |
| Warenkorb-Popup | Mini-Cart | HOCH | 8h |
| Login-Modal | Anmelde-Dialog | MITTEL | 6h |
| User-Dashboard | Buchungsübersicht | HOCH | 12h |
| Kursleitenden-Dashboard | Instruktor-Portal | HOCH | 12h |
| Notification-Center | Benachrichtigungen | MITTEL | 6h |
| Chatbot-UI | Chat-Interface | HOCH | 10h |
| Buchungs-Checkout | Mehrstufiger Checkout | HOCH | 16h |
| Map-Component | Standort-Karte | MITTEL | 6h |
| Kalender-Widget | Veranstaltungskalender | HOCH | 10h |
| + 40 weitere Standard-Komponenten | Buttons, Cards, etc. | GEMISCHT | 80h |
| **Gesamt Theme Components** | **~55** | | **200h** |

---

## 6. Zusammenfassung der Entities

| Entity-Typ | Anzahl | Traditionell | KI-Unterstützt |
|------------|--------|--------------|----------------|
| Content Types | 8 | 54h | 18h |
| Paragraph Types | 20 | 97h | 32h |
| Taxonomies | 5 | 11h | 4h |
| Views | 9 | 61h | 20h |
| Webforms | 5 | 26h | 9h |
| Custom Modules | 8 | 370h | 130h |
| Theme Components (SDC) | 55 | 200h | 67h |
| **SUMME ENTITIES** | **110** | **819h** | **280h** |

---

## 7. Risikobewertung

### Hohe Risiken (🔴)

1. **API-Abhängigkeit vom Information Manager**
   - Gesamtes System hängt von stabiler REST-API ab
   - Fehler können Buchungen blockieren
   - **Mitigation:** Frühe API-Tests, Fallback-Konzept

2. **Zahlungsintegration (PCI-DSS)**
   - Sensible Daten dürfen NICHT im CMS gespeichert werden
   - Externe Payment Service Provider erforderlich
   - **Mitigation:** Zertifizierter PSP (Stripe, PayPal, etc.)

3. **Deadline 31.10.2027**
   - Fixe Deadline bei agilem Vorgehen
   - Scope-Management kritisch
   - **Mitigation:** MVP-First, klare MUST/SHOULD/COULD

### Mittlere Risiken (🟡)

4. **KI-Services DSGVO**
   - KI-Services müssen auf deutschen Servern laufen
   - **Mitigation:** Azure OpenAI (Frankfurt) oder Anthropic EU

5. **Barrierefreiheit BITV 2.0 / WCAG 2.2 AA**
   - Gesetzliche Anforderung, hoher QA-Aufwand
   - **Mitigation:** Barrierefreiheits-Expert*in einbinden

6. **Notification Service (Echtzeit)**
   - WebSocket/Polling-Komplexität
   - **Mitigation:** Etablierte Technologie (Pusher, Firebase)

### Niedrige Risiken (🟢)

7. **Mehrsprachigkeit**
   - Drupal-Standardfunktion
   - **Mitigation:** i18n von Anfang an planen

8. **SEO-Anforderungen**
   - Drupal hat gute SEO-Module (Yoast, Metatag)
   - **Mitigation:** Standard-Best-Practices

---

## Nächste Schritte

1. **Duale Schätzung erstellen** (Traditionell vs. KI-unterstützt)
2. **Vergleich mit Ausschreibungs-Volumen** (444,8 PT)
3. **Bid/No-Bid Empfehlung** formulieren
