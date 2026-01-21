# Drupal Paragraph Types

## Übersicht

18 Paragraph Types für flexible Seitenlayouts:

| # | Machine Name | Label | Komplexität | Stunden |
|---|--------------|-------|-------------|---------|
| 1 | hero | Hero | Complex | 6h |
| 2 | news_slider | News Slider | Complex | 6h |
| 3 | video_slider | Video Slider | Complex | 6h |
| 4 | teaser_slider | Teaser Slider | Complex | 6h |
| 5 | product_slider | Product Slider | Complex | 6h |
| 6 | team_slider | Team Slider | Complex | 6h |
| 7 | text | Text | Simple | 1.5h |
| 8 | free_html | Free HTML | Medium | 3.5h |
| 9 | media | Media | Simple | 1.5h |
| 10 | cta | CTA | Simple | 1.5h |
| 11 | card | Card | Medium | 3.5h |
| 12 | card_group | Card Group | Medium | 3.5h |
| 13 | accordion | Accordion | Medium | 3.5h |
| 14 | newsletter | Newsletter | Medium | 3.5h |
| 15 | partner_grid | Partner Grid | Medium | 3.5h |
| 16 | banderole | Banderole | Medium | 3.5h |
| 17 | matchday_widget | Matchday Widget | Complex | 6h |
| 18 | table_standings | Table Standings | Medium | 3.5h |
| | | **Gesamt** | | **74.5h** |

## Gemeinsame Basis-Felder

Alle Paragraphs erhalten über ein Behavior-Plugin:

| Feld | Machine Name | Typ |
|------|--------------|-----|
| Theme Variant | field_theme_variant | List (Select) |
| Background Color | field_background | Color |
| Spacing Top | field_spacing_top | List (Select) |
| Spacing Bottom | field_spacing_bottom | List (Select) |
| Width | field_width | List (Select) |

**Theme Variants:**
- default
- inverted (dark)
- highlight

**Width Options:**
- full (100%)
- wide (1400px)
- content (1200px)
- narrow (800px)

## Detaillierte Definitionen

### Hero

**Machine Name:** `hero`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_headline | Text | Hauptüberschrift |
| field_subline | Text | Unterüberschrift |
| field_background_image | Media Ref | Hintergrundbild |
| field_background_video | Media Ref | Hintergrundvideo (optional) |
| field_cta | Link | Call-to-Action |
| field_overlay | List | dark/light/gradient |

---

### Slider (News, Video, Teaser, Product, Team)

Alle Slider teilen eine ähnliche Struktur:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_headline | Text | Abschnittsüberschrift |
| field_view | View Ref | Referenz auf View |
| field_items_count | Integer | Anzahl Items |
| field_autoplay | Boolean | Automatisch abspielen |
| field_show_nav | Boolean | Navigation anzeigen |
| field_cta | Link | "Alle anzeigen" Link |

**View-Referenzen:**
- news_slider → `news_slider_block`
- video_slider → `video_slider_block`
- team_slider → `team_slider_block`

---

### Text

**Machine Name:** `text`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_body | Text (Formatted) | WYSIWYG Content |

---

### Free HTML

**Machine Name:** `free_html`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_html | Text (Long) | Raw HTML |
| field_admin_label | Text | Admin-Bezeichnung |

::: warning
Nur für Administratoren verfügbar!
:::

---

### Media

**Machine Name:** `media`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_media | Media Ref | Bild oder Video |
| field_caption | Text | Bildunterschrift |
| field_alignment | List | left/center/right/full |

---

### CTA

**Machine Name:** `cta`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_text | Text | Button-Text |
| field_link | Link | Ziel-URL |
| field_style | List | primary/secondary/outline |
| field_icon | Text | Icon-Name (optional) |

---

### Card

**Machine Name:** `card`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_image | Media Ref | Card-Bild |
| field_headline | Text | Überschrift |
| field_text | Text | Beschreibung |
| field_link | Link | Ziel-URL |
| field_highlighted | Boolean | Hervorgehoben |

---

### Card Group

**Machine Name:** `card_group`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_headline | Text | Gruppenüberschrift |
| field_cards | Paragraph Ref (card) | Cards |
| field_columns | List | 2/3/4 Spalten |

---

### Accordion

**Machine Name:** `accordion`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_headline | Text | Überschrift (optional) |
| field_items | Paragraph Ref (accordion_item) | Items |
| field_open_first | Boolean | Erstes öffnen |

**Nested Paragraph:** `accordion_item`
- field_question (Text)
- field_answer (Text Formatted)

---

### Newsletter

**Machine Name:** `newsletter`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_headline | Text | Überschrift |
| field_description | Text | Beschreibung |
| field_form | Webform Ref | Newsletter-Formular |

---

### Partner Grid

**Machine Name:** `partner_grid`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_headline | Text | Überschrift |
| field_category | Taxonomy Ref | Partner-Kategorie Filter |
| field_display | List | grid/carousel |
| field_show_all_link | Boolean | "Alle anzeigen" |

---

### Banderole (Ticker)

**Machine Name:** `banderole`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_items | Paragraph Ref (banderole_item) | Items |
| field_speed | Integer | Scroll-Geschwindigkeit |

**Nested Paragraph:** `banderole_item`
- field_text (Text)
- field_link (Link, optional)

---

### Matchday Widget

**Machine Name:** `matchday_widget`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_match | Entity Ref (event) | Spiel-Referenz |
| field_display | List | full/compact |
| field_show_lineup | Boolean | Aufstellung zeigen |
| field_show_stats | Boolean | Statistiken zeigen |

---

### Table Standings

**Machine Name:** `table_standings`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| field_competition | Taxonomy Ref | Wettbewerb |
| field_highlight_team | Boolean | VfL hervorheben |
| field_show_all | Boolean | Alle Teams anzeigen |

## SDC Template-Struktur

```
components/
├── hero/
│   ├── hero.component.yml
│   ├── hero.twig
│   └── hero.css
├── slider/
│   ├── slider.component.yml
│   ├── slider.twig
│   └── slider.js
└── ...
```
