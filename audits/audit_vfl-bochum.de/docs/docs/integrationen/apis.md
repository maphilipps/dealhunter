# APIs & External Systems

## Sportdaten-API

### Übersicht

| Attribut | Wert |
|----------|------|
| **Typ** | REST API |
| **Kritikalität** | Hoch |
| **Komplexität** | Complex |
| **Aufwand** | 70h |

### Funktionalitäten

| Feature | Beschreibung |
|---------|--------------|
| Spielplan | Kommende und vergangene Spiele |
| Tabelle | Aktuelle Bundesliga-Tabelle |
| Liveticker | Echtzeit-Updates während Spielen |
| Statistiken | Spielerstatistiken |
| Ergebnisse | Spielergebnisse und Details |

### API-Endpunkte (vermutlich)

```
GET /matches/upcoming
GET /matches/{id}
GET /standings
GET /matches/{id}/live
GET /players/{id}/stats
```

### Drupal-Implementierung

**Custom Module: `vfl_sportdata`**

```php
namespace Drupal\vfl_sportdata;

interface SportDataServiceInterface {

  public function getUpcomingMatches(): array;

  public function getMatch(string $id): ?Match;

  public function getStandings(): array;

  public function getLiveData(string $matchId): ?LiveData;

  public function getPlayerStats(string $playerId): ?PlayerStats;
}
```

**Caching-Strategie:**

| Daten | Cache TTL |
|-------|-----------|
| Spielplan | 1 Stunde |
| Tabelle | 5 Minuten |
| Liveticker | 30 Sekunden |
| Statistiken | 1 Tag |

---

## 1848TV Integration

### Übersicht

| Attribut | Wert |
|----------|------|
| **Typ** | Video Platform API |
| **Kritikalität** | Hoch |
| **Komplexität** | Medium |
| **Aufwand** | 28h |

### Funktionalitäten

| Feature | Beschreibung |
|---------|--------------|
| Video Listing | Liste aller Videos |
| Video Embed | Video-Player einbetten |
| Categories | Video-Kategorien |
| Search | Video-Suche |

### Integration-Ansätze

**Option 1: oEmbed (empfohlen)**
```php
// Drupal Media oEmbed Provider
$providers = [
  '1848tv' => [
    'provider_name' => '1848TV',
    'provider_url' => 'https://1848.tv',
    'endpoints' => [
      [
        'url' => 'https://1848.tv/oembed',
        'schemes' => ['https://1848.tv/video/*'],
      ],
    ],
  ],
];
```

**Option 2: Custom Module**
```php
namespace Drupal\vfl_video;

interface VideoProviderInterface {

  public function getVideos(int $limit = 10): array;

  public function getVideo(string $id): ?Video;

  public function getEmbedCode(string $id): string;
}
```

---

## Salesforce Integration

### Übersicht

| Attribut | Wert |
|----------|------|
| **Typ** | CRM Integration |
| **Kritikalität** | Mittel |
| **Komplexität** | Medium |
| **Aufwand** | 28h |

### Aktuell: Web-to-Case

Das Kontaktformular sendet Daten direkt an Salesforce:

```html
<form action="https://webto.salesforce.com/servlet/servlet.WebToCase" method="POST">
  <input type="hidden" name="orgid" value="XXXXX">
  <input type="hidden" name="retURL" value="https://vfl-bochum.de/danke">
  <input name="name" type="text">
  <input name="email" type="email">
  <textarea name="description"></textarea>
  <input type="submit">
</form>
```

### Drupal-Implementierung

**Option 1: Webform + Remote Post Handler**
```yaml
# webform.webform.contact.yml
handlers:
  salesforce:
    id: remote_post
    handler_id: salesforce
    settings:
      method: POST
      url: 'https://webto.salesforce.com/servlet/servlet.WebToCase'
      custom_data:
        orgid: 'XXXXX'
      field_mapping:
        name: 00NXX000000XXXX
        email: email
        subject: subject
        message: description
```

**Option 2: Salesforce Suite Module**
- Vollständige CRM-Integration
- Bidirektionale Synchronisation
- OAuth-Authentifizierung

---

## Google Tag Manager

### Übersicht

| Attribut | Wert |
|----------|------|
| **Container ID** | GTM-K5B3MHM |
| **Kritikalität** | Mittel |
| **Komplexität** | Low |
| **Aufwand** | 4h |

### Drupal-Implementierung

**Module:** Google Tag Manager

```php
// settings.php
$config['google_tag.settings']['container_id'] = 'GTM-K5B3MHM';
```

**DataLayer Events:**
```javascript
// Page View
dataLayer.push({
  'event': 'pageview',
  'pagePath': window.location.pathname,
  'pageTitle': document.title
});

// Video Play
dataLayer.push({
  'event': 'video_play',
  'videoTitle': 'Pressekonferenz ...',
  'videoId': '12345'
});

// Form Submit
dataLayer.push({
  'event': 'form_submit',
  'formId': 'contact'
});
```

---

## Shop & Ticketing

### Shop Integration

| Attribut | Wert |
|----------|------|
| **URL** | shop.vfl-bochum.de |
| **Typ** | Externe Plattform (Link) |
| **Aufwand** | 8h |

**Implementierung:**
- Verlinkung aus Navigation
- Product Slider (falls API verfügbar)
- Deep Links zu Produkten

### Ticketing Integration

| Attribut | Wert |
|----------|------|
| **URL** | tickets.vfl-bochum.de |
| **Typ** | Externe Plattform (Link) |
| **Aufwand** | 8h |

**Implementierung:**
- Verlinkung aus Navigation
- Ticket-Links bei Events/Spielen
- Verfügbarkeits-Info (falls API)

---

## API-Dokumentation Template

Für jede API sollte dokumentiert werden:

```markdown
# [API Name]

## Authentifizierung
- Typ: [API Key / OAuth / Basic Auth]
- Header: [Authorization: Bearer ...]

## Endpunkte

### GET /endpoint
**Beschreibung:** [Was macht der Endpunkt]
**Parameter:**
- param1 (required): [Beschreibung]
- param2 (optional): [Beschreibung]

**Response:**
json
{
  "data": [...],
  "meta": {...}
}


**Fehler:**
- 400: Invalid request
- 401: Unauthorized
- 404: Not found

## Rate Limits
- [X] Requests pro Minute

## Caching
- TTL: [X] Sekunden
```
