# Interactive Features

## Übersicht

| # | Feature | Komplexität | Drupal-Modul |
|---|---------|-------------|--------------|
| 1 | Suche | Medium | Search API |
| 2 | Kontaktformular | Medium | Webform + Salesforce |
| 3 | Newsletter-Anmeldung | Simple | Simplenews |
| 4 | Spielplan/Matchcenter | Complex | Custom Module |
| 5 | Tabelle | Medium | Custom Module |
| 6 | Liveticker | Complex | Custom Module |

## 1. Suchfunktion

**Komplexität:** Medium

**Aktuelle Implementierung:**
- Volltextsuche über alle Inhalte
- Keine Facetten/Filter sichtbar
- Autosuggest nicht vorhanden

**Drupal-Implementierung:**

| Komponente | Modul |
|------------|-------|
| Search Backend | Search API |
| Database Backend | Search API Database |
| Facets (optional) | Facets |
| Autocomplete | Search API Autocomplete |

**Konfiguration:**
- Index: Alle Content Types
- Felder: Title, Body, Tags, Category
- Fulltext Processor: Stemmer, Stopwords
- View: search_results

---

## 2. Kontaktformular

**Komplexität:** Medium

**Aktuelle Implementierung:**
- Kontaktformular mit Salesforce Web-to-Case Integration
- Felder: Name, E-Mail, Betreff, Nachricht
- Datenschutz-Checkbox

**Drupal-Implementierung:**

| Komponente | Modul |
|------------|-------|
| Formular-Builder | Webform |
| Salesforce | Salesforce Suite oder Custom |
| Spam-Schutz | Honeypot, Antibot |

**Salesforce Integration:**
```yaml
handler:
  type: remote_post
  endpoint: https://webto.salesforce.com/servlet/servlet.WebToCase
  mapping:
    - name: orgid
    - name: subject
    - name: email
    - name: description
```

---

## 3. Newsletter-Anmeldung

**Komplexität:** Simple

**Aktuelle Implementierung:**
- E-Mail-Feld
- Datenschutz-Checkbox
- Vermutlich Integration mit E-Mail-Marketing-Tool

**Drupal-Implementierung:**

| Option | Beschreibung |
|--------|--------------|
| Simplenews | Native Drupal Newsletter |
| Mailchimp | Mailchimp for Drupal |
| Custom | Webform + API |

**Empfehlung:** Webform mit Remote Post Handler für maximale Flexibilität.

---

## 4. Spielplan / Matchcenter

**Komplexität:** Complex

**Aktuelle Implementierung:**
- Kalenderansicht der Spiele
- Filter nach Wettbewerb
- Detail-Ansicht mit Spielinfos
- Ticket-Links

**Drupal-Implementierung:**

**Custom Module: `vfl_matchcenter`**

| Funktionalität | Implementierung |
|----------------|-----------------|
| Daten-Import | Cron Job, API Fetch |
| Speicherung | Event Content Type |
| Anzeige | Views + Twig Templates |
| Live-Updates | AJAX Polling |

**API-Struktur:**
```php
interface MatchDataProviderInterface {
  public function getUpcomingMatches(): array;
  public function getMatchById(string $id): ?Match;
  public function getStandings(): array;
  public function getLiveData(string $matchId): ?LiveData;
}
```

---

## 5. Tabelle

**Komplexität:** Medium

**Aktuelle Implementierung:**
- Bundesliga-Tabelle
- Highlight des VfL
- Dynamische Updates

**Drupal-Implementierung:**

**Integriert in `vfl_matchcenter`**

| Komponente | Beschreibung |
|------------|--------------|
| Block | `standings_block` |
| Template | `block--standings.html.twig` |
| Cache | Cache Tags, 5 Min TTL |

---

## 6. Liveticker

**Komplexität:** Complex

**Aktuelle Implementierung:**
- Echtzeit-Updates während Spielen
- Events: Tore, Karten, Wechsel
- Timeline-Darstellung

**Drupal-Implementierung:**

**Optionen:**

| Ansatz | Vor-/Nachteile |
|--------|----------------|
| AJAX Polling | Einfach, aber Server-Last |
| WebSockets | Echtzeit, komplexer |
| SSE | Guter Kompromiss |

**Empfehlung:** AJAX Polling mit 30s Intervall

---

## Webform-Konfiguration

### Formulare

| Formular | Felder | Handler |
|----------|--------|---------|
| Kontakt | Name, Email, Betreff, Nachricht | Salesforce, Email |
| Newsletter | Email | Newsletter API |
| Mitgliedschaft | Ausführliche Personendaten | Email, PDF |

### Spam-Schutz

| Methode | Beschreibung |
|---------|--------------|
| Honeypot | Verstecktes Feld |
| Antibot | JavaScript-basiert |
| reCAPTCHA | Google Service (DSGVO!) |
| Zeitlimit | Min. Ausfüllzeit |

**Empfehlung:** Honeypot + Antibot (DSGVO-konform)
