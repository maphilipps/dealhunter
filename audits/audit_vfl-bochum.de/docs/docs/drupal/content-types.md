# Drupal Content Types

## Übersicht

9 Content Types werden für die VfL Bochum Website benötigt:

| # | Machine Name | Label | Komplexität | Stunden |
|---|--------------|-------|-------------|---------|
| 1 | landing_page | Landing Page | Complex | 12h |
| 2 | article | News/Artikel | Medium | 6h |
| 3 | video | Video | Medium | 6h |
| 4 | person | Person | Medium | 6h |
| 5 | partner | Partner | Simple | 3h |
| 6 | event | Event/Termin | Medium | 6h |
| 7 | page | Seite | Simple | 3h |
| 8 | job | Stellenanzeige | Medium | 6h |
| 9 | team | Team | Simple | 3h |
| | | **Gesamt** | | **51h** |

## Detaillierte Definitionen

### 1. Landing Page

**Machine Name:** `landing_page`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Title | title | Text | 1 |
| Hero | field_hero | Entity Ref: Paragraph | 1 |
| Sections | field_sections | Entity Ref: Paragraph | ∞ |
| Meta Tags | field_meta_tags | Metatag | 1 |

**Erlaubte Paragraphs für field_sections:**
- hero, news_slider, video_slider, teaser_slider, text, card_group, partner_grid, accordion, newsletter, matchday_widget, table_standings, banderole

---

### 2. Article (News)

**Machine Name:** `article`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Title | title | Text | 1 |
| Teaser Image | field_teaser_image | Entity Ref: Media | 1 |
| Teaser Text | field_teaser_text | Text (Summary) | 1 |
| Body | body | Text (Formatted, Long) | 1 |
| Category | field_category | Entity Ref: Taxonomy | 1 |
| Tags | field_tags | Entity Ref: Taxonomy | ∞ |
| Date | field_date | Datetime | 1 |

**Display Modes:**
- full, teaser, search_result

---

### 3. Video

**Machine Name:** `video`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Title | title | Text | 1 |
| Thumbnail | field_thumbnail | Entity Ref: Media | 1 |
| Video URL | field_video_url | Link | 1 |
| Description | field_description | Text (Formatted) | 1 |
| Duration | field_duration | Integer | 1 |
| Category | field_category | Entity Ref: Taxonomy | 1 |
| Tags | field_tags | Entity Ref: Taxonomy | ∞ |
| Date | field_date | Datetime | 1 |

---

### 4. Person

**Machine Name:** `person`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Name | title | Text | 1 |
| First Name | field_first_name | Text | 1 |
| Last Name | field_last_name | Text | 1 |
| Portrait | field_portrait | Entity Ref: Media | 1 |
| Action Image | field_action_image | Entity Ref: Media | 1 |
| Position | field_position | Text | 1 |
| Number | field_number | Integer | 1 |
| Nationality | field_nationality | Text | 1 |
| Birthday | field_birthday | Date | 1 |
| Team | field_team | Entity Ref: Taxonomy | 1 |
| Biography | field_biography | Text (Formatted) | 1 |
| Social Links | field_social_links | Link | ∞ |

---

### 5. Partner

**Machine Name:** `partner`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Name | title | Text | 1 |
| Logo | field_logo | Entity Ref: Media | 1 |
| Logo Mono | field_logo_mono | Entity Ref: Media | 1 |
| Website | field_website | Link | 1 |
| Category | field_category | Entity Ref: Taxonomy | 1 |
| Weight | field_weight | Integer | 1 |

---

### 6. Event

**Machine Name:** `event`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Title | title | Text | 1 |
| Event Type | field_event_type | List (Select) | 1 |
| Date | field_date | Datetime Range | 1 |
| Location | field_location | Text | 1 |
| Home Team | field_home_team | Text | 1 |
| Away Team | field_away_team | Text | 1 |
| Competition | field_competition | Entity Ref: Taxonomy | 1 |
| Ticket Link | field_ticket_link | Link | 1 |
| Result | field_result | Text | 1 |

**Event Types:**
- match (Spiel)
- event (Veranstaltung)
- press (Pressekonferenz)

---

### 7. Page (Basic)

**Machine Name:** `page`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Title | title | Text | 1 |
| Body | body | Text (Formatted, Long) | 1 |
| Sidebar | field_sidebar | Entity Ref: Paragraph | ∞ |

---

### 8. Job

**Machine Name:** `job`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Title | title | Text | 1 |
| Department | field_department | Text | 1 |
| Location | field_location | Text | 1 |
| Employment Type | field_employment_type | List (Select) | 1 |
| Description | body | Text (Formatted, Long) | 1 |
| Requirements | field_requirements | Text (Formatted) | 1 |
| Benefits | field_benefits | Text (Formatted) | 1 |
| Deadline | field_deadline | Date | 1 |
| Apply Link | field_apply_link | Link | 1 |

---

### 9. Team

**Machine Name:** `team`

| Feld | Machine Name | Typ | Kardinalität |
|------|--------------|-----|--------------|
| Name | title | Text | 1 |
| Description | field_description | Text | 1 |
| Category | field_category | Entity Ref: Taxonomy | 1 |
| Weight | field_weight | Integer | 1 |

## Konfiguration Export

```bash
# Export Content Type Config
drush cex --destination=/tmp/config

# Dateien in config/sync:
# - node.type.*.yml
# - field.storage.node.*.yml
# - field.field.node.*.yml
# - core.entity_form_display.node.*.yml
# - core.entity_view_display.node.*.yml
```
