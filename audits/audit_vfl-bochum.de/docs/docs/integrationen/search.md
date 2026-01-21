# Search & Analytics

## Suchfunktion

### Aktueller Stand

Die aktuelle Website verfügt über eine Volltextsuche mit:
- Suche über alle Inhalte
- Keine sichtbaren Facetten/Filter
- Keine Autosuggest-Funktion

### Drupal Search Implementierung

#### Option 1: Search API + Database (Empfohlen für Start)

**Module:**
- Search API
- Search API Database

**Vorteile:**
- Keine zusätzliche Infrastruktur
- Einfache Einrichtung
- Ausreichend für ~5.000 Inhalte

**Konfiguration:**

```yaml
# search_api.index.default.yml
id: default
name: 'Default Index'
datasource_settings:
  'entity:node':
    bundles:
      - article
      - video
      - person
      - page
processor_settings:
  add_url: {}
  aggregated_field: {}
  content_access: {}
  highlight:
    prefix: '<strong>'
    suffix: '</strong>'
  html_filter:
    fields:
      - body
  stemmer:
    fields:
      - title
      - body
    language: de
```

#### Option 2: Search API + Solr (Für erweiterte Features)

**Wann Solr?**
- > 10.000 Inhalte
- Komplexe Facetten
- Bessere Performance
- Fuzzy Search

**Module:**
- Search API
- Search API Solr

**Infrastruktur:**
```yaml
# docker-compose.yml
solr:
  image: solr:9
  volumes:
    - solr_data:/var/solr
  command: solr-precreate drupal
```

### Faceted Search

**Module:** Facets

```yaml
# facets.facet.content_type.yml
id: content_type
name: 'Content Type'
widget: links
settings:
  show_numbers: true
  soft_limit: 5
facet_source_id: 'search_api:views_page__search__page'
field_identifier: type
```

### Autocomplete

**Module:** Search API Autocomplete

```php
// Autocomplete Suggester Config
$config['search_api_autocomplete.search.search']['suggesters'] = [
  'server' => [
    'plugin_id' => 'server',
    'weights' => ['user_input' => 0.9, 'words' => 0.1],
  ],
];
```

---

## Analytics

### Google Tag Manager

**Container ID:** GTM-K5B3MHM

**Drupal-Modul:** Google Tag Manager

```php
// Einbindung
$config['google_tag.container.primary']['container_id'] = 'GTM-K5B3MHM';
```

### DataLayer Events

```javascript
// Standard Events
dataLayer.push({
  'event': 'pageview',
  'content_type': 'article',
  'content_id': '123',
  'content_title': 'Spielbericht...',
  'content_category': 'news'
});

// Video Events
dataLayer.push({
  'event': 'video_start',
  'video_title': 'Pressekonferenz',
  'video_id': '456',
  'video_duration': 1234
});

// Search Events
dataLayer.push({
  'event': 'search',
  'search_term': 'bundesliga',
  'search_results_count': 42
});

// Click Events
dataLayer.push({
  'event': 'cta_click',
  'cta_text': 'Tickets kaufen',
  'cta_location': 'hero'
});
```

### Drupal DataLayer Module

```twig
{# In node templates #}
<script>
  dataLayer.push({
    'content_type': '{{ node.bundle }}',
    'content_id': '{{ node.id }}',
    'content_author': '{{ node.getOwner.getDisplayName }}',
    'content_date': '{{ node.getCreatedTime|date('Y-m-d') }}'
  });
</script>
```

---

## Tracking-Übersicht

### Events zu tracken

| Event | Trigger | Daten |
|-------|---------|-------|
| Page View | Jeder Seitenaufruf | URL, Title, Type |
| Search | Suche ausgeführt | Query, Results |
| Video Play | Video gestartet | ID, Title, Duration |
| Video Complete | Video beendet | Watch Time |
| Form Submit | Formular gesendet | Form ID |
| CTA Click | Button/Link geklickt | Text, Location |
| Newsletter Signup | Newsletter angemeldet | Success/Error |
| Download | Datei heruntergeladen | Filename |

### E-Commerce (falls Shop-Daten)

```javascript
// Enhanced Ecommerce
dataLayer.push({
  'event': 'view_item',
  'ecommerce': {
    'items': [{
      'item_id': 'SKU_123',
      'item_name': 'Trikot Home',
      'price': 89.95
    }]
  }
});
```

---

## Privacy & GDPR

### Cookie Consent

**Module:** EU Cookie Compliance / Klaro

```javascript
// Klaro Config
var klaroConfig = {
  acceptAll: true,
  services: [
    {
      name: 'google-tag-manager',
      title: 'Google Tag Manager',
      purposes: ['analytics'],
      cookies: ['_ga', '_gid', '_gat'],
      required: false,
    },
    {
      name: 'youtube',
      title: 'YouTube Videos',
      purposes: ['functional'],
      required: false,
    }
  ]
};
```

### Consent Mode

```javascript
// Google Consent Mode v2
gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied'
});

// Nach Consent
gtag('consent', 'update', {
  'analytics_storage': 'granted'
});
```

---

## Aufwand

| Task | Stunden |
|------|---------|
| Search API Setup | 8h |
| Search View & Templates | 8h |
| Facets (optional) | 8h |
| Autocomplete | 4h |
| GTM Migration | 4h |
| DataLayer Events | 8h |
| Cookie Consent | 4h |
| **Gesamt** | **~44h** |
