# Drupal Views

## Übersicht

9 Views für Content-Listings:

| # | Machine Name | Label | Komplexität | Stunden |
|---|--------------|-------|-------------|---------|
| 1 | news_listing | News-Übersicht | Medium | 6h |
| 2 | news_slider_block | News Slider | Complex | 12h |
| 3 | video_listing | Video-Übersicht | Medium | 6h |
| 4 | video_slider_block | Video Slider | Complex | 12h |
| 5 | team_listing | Team-Übersicht | Medium | 6h |
| 6 | partner_listing | Partner-Grid | Simple | 3h |
| 7 | event_listing | Termine | Medium | 6h |
| 8 | job_listing | Stellenanzeigen | Simple | 3h |
| 9 | search_results | Suchergebnisse | Medium | 6h |
| | | **Gesamt** | | **60h** |

## View-Konfigurationen

### 1. News Listing

```yaml
id: news_listing
label: 'News-Übersicht'
base_table: node_field_data
display:
  default:
    display_plugin: default
    display_options:
      filters:
        - type = 'article'
        - status = 1
      sorts:
        - field_date DESC
      pager:
        type: full
        items_per_page: 12
      style:
        type: grid
        columns: 3
  page_1:
    display_plugin: page
    path: /news
  feed_1:
    display_plugin: feed
    path: /news/rss
```

**Exposed Filters:**
- field_category (Select)
- field_tags (Autocomplete)
- field_date (Date Range)

---

### 2. News Slider Block

```yaml
id: news_slider_block
label: 'News Slider'
display:
  default:
    filters:
      - type = 'article'
      - status = 1
    sorts:
      - field_date DESC
    pager:
      type: some
      items_per_page: 6
  block_1:
    display_plugin: block
```

**Contextual Filter:**
- field_category (von Paragraph übergeben)

---

### 3. Video Listing

```yaml
id: video_listing
label: 'Video-Übersicht'
path: /videos
filters:
  - type = 'video'
  - status = 1
pager:
  items_per_page: 12
style:
  type: grid
  columns: 3
```

---

### 4. Video Slider Block

Analog zu News Slider Block für Video Content Type.

---

### 5. Team Listing

```yaml
id: team_listing
label: 'Team-Übersicht'
base_table: node_field_data
filters:
  - type = 'person'
  - status = 1
contextual_filters:
  - field_team (Taxonomy ID)
sorts:
  - field_number ASC
  - title ASC
style:
  type: grid
  columns: 4
```

**Gruppierung:**
- Optional nach Position (Torwart, Abwehr, etc.)

---

### 6. Partner Listing

```yaml
id: partner_listing
label: 'Partner-Grid'
path: /netzwerk
filters:
  - type = 'partner'
  - status = 1
grouping:
  - field_category
sorts:
  - field_weight ASC
style:
  type: unformatted
```

---

### 7. Event Listing

```yaml
id: event_listing
label: 'Termine'
path: /termine
filters:
  - type = 'event'
  - status = 1
  - field_date >= NOW (Upcoming)
sorts:
  - field_date ASC
exposed_filters:
  - field_event_type
  - field_competition
pager:
  items_per_page: 20
```

**Alternative Display:** Kalender (Views Calendar)

---

### 8. Job Listing

```yaml
id: job_listing
label: 'Stellenanzeigen'
path: /jobs
filters:
  - type = 'job'
  - status = 1
  - field_deadline >= NOW
sorts:
  - field_deadline ASC
style:
  type: table
```

---

### 9. Search Results

```yaml
id: search_results
label: 'Suchergebnisse'
base_table: search_api_index_default
path: /suche
exposed_filters:
  - search_api_fulltext (Required)
  - type (Optional)
sorts:
  - search_api_relevance DESC
pager:
  items_per_page: 10
```

## View-Templates

```
templates/views/
├── views-view--news-listing.html.twig
├── views-view--news-listing--page-1.html.twig
├── views-view-unformatted--news-listing.html.twig
├── views-view-fields--news-listing.html.twig
└── node--article--teaser.html.twig
```

## Caching

| View | Cache | Max-Age |
|------|-------|---------|
| news_listing | Tag-based | 5 min |
| news_slider_block | Tag-based | 5 min |
| video_listing | Tag-based | 5 min |
| team_listing | Tag-based | 1 hour |
| partner_listing | Tag-based | 1 hour |
| event_listing | Time-based | 1 min |
| job_listing | Tag-based | 1 hour |
| search_results | None | - |

```yaml
# View Cache Settings
cache:
  type: tag
  options:
    - 'node_list:article'
```

## AJAX & Lazy Loading

```yaml
# AJAX Pager
use_ajax: true
ajax_settings:
  effect: fade
  speed: fast
```

## Export

```bash
# Views als Config exportieren
drush cex views.view.news_listing
```
