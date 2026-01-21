# Data Tables

::: tip Einheit: Personentage (PT)
Alle Schätzungen in Personentagen (1 PT = 8 Stunden)
:::

## Content Inventory

### Sitemap-Analyse (Vollständig)

| Bereich | URL-Pattern | Seiten | Nodes (geschätzt) |
|---------|-------------|--------|-------------------|
| **News** | /news/* | 15+ | 500+ |
| Verein | /verein/* | 11 | 20 |
| Stadion | /stadion/* | 8 | 15 |
| Fans | /fans/* | 8 | 12 |
| Talentwerk | /talentwerk/* | 6 | 50 |
| Termine | /termine/* | 4 | 200+ |
| Frauen | /frauen/* | 4 | 30 |
| Spielplan | /spielplan/* | 2 | 50 |
| Netzwerk | /netzwerk/* | 2 | 10 |
| Jobs | /jobs/* | 2 | 20 |
| **1848TV** | /1848tv/* | 10+ | 335+ |
| Partner | /partner/* | 4 | 50 |
| Team | /mannschaft/* | 5 | 100 |
| Sonstige | /* | 9 | 15 |
| **Gesamt** | | **90+** | **1400+** |

### News-Seiten Detail

| Unterseite | URL | Beschreibung |
|------------|-----|--------------|
| News Übersicht | /news/ | Hauptlisting aller News |
| Profis News | /news/profis/ | Bundesliga News |
| Frauen News | /news/frauen/ | Frauen-Mannschaft News |
| Talentwerk News | /news/talentwerk/ | Nachwuchs News |
| Fans News | /news/fans/ | Fan-relevante News |
| Verein News | /news/verein/ | Vereinsnachrichten |
| Partner News | /news/partner/ | Partner-Mitteilungen |
| Pressebereich | /presse/ | Pressemitteilungen |
| Archiv | /news/archiv/ | Ältere Artikel |
| Tag-Filter | /news/tag/* | Gefilterte Ansichten |
| Kategorie-Filter | /news/kategorie/* | Kategorisierte News |

### 1848TV Seiten Detail

| Unterseite | URL | Beschreibung |
|------------|-----|--------------|
| 1848TV Übersicht | /1848tv/ | Video-Hauptseite |
| Highlights | /1848tv/highlights/ | Spiel-Highlights |
| Pressekonferenzen | /1848tv/pressekonferenzen/ | PK-Videos |
| Interviews | /1848tv/interviews/ | Spieler-Interviews |
| Inside VfL | /1848tv/inside/ | Behind-the-Scenes |
| Frauen | /1848tv/frauen/ | Frauen-Team Videos |
| Talentwerk | /1848tv/talentwerk/ | Nachwuchs-Videos |
| Live | /1848tv/live/ | Live-Streams |
| Archiv | /1848tv/archiv/ | Video-Archiv |
| Playlists | /1848tv/playlists/ | Kuratierte Listen |

## Entity Breakdown

### Content Types (9)

| Machine Name | Label | Fields | Complexity | PT |
|--------------|-------|--------|------------|-----|
| landing_page | Landing Page | 4 | Complex | 1.5 |
| article | News | 7 | Medium | 0.75 |
| video | Video | 8 | Medium | 0.75 |
| person | Person | 12 | Medium | 0.75 |
| partner | Partner | 6 | Simple | 0.4 |
| event | Event | 10 | Medium | 0.75 |
| page | Seite | 3 | Simple | 0.4 |
| job | Job | 10 | Medium | 0.75 |
| team | Team | 4 | Simple | 0.4 |
| **Total** | | | | **6 PT** |

### Paragraph Types (18)

| Machine Name | Label | Fields | Complexity | PT |
|--------------|-------|--------|------------|-----|
| hero | Hero | 6 | Complex | 0.75 |
| news_slider | News Slider | 6 | Complex | 0.75 |
| video_slider | Video Slider | 6 | Complex | 0.75 |
| teaser_slider | Teaser Slider | 6 | Complex | 0.75 |
| product_slider | Product Slider | 6 | Complex | 0.75 |
| team_slider | Team Slider | 6 | Complex | 0.75 |
| text | Text | 1 | Simple | 0.2 |
| free_html | Free HTML | 2 | Medium | 0.4 |
| media | Media | 3 | Simple | 0.2 |
| cta | CTA | 4 | Simple | 0.2 |
| card | Card | 5 | Medium | 0.4 |
| card_group | Card Group | 3 | Medium | 0.4 |
| accordion | Accordion | 3 | Medium | 0.4 |
| newsletter | Newsletter | 3 | Medium | 0.4 |
| partner_grid | Partner Grid | 4 | Medium | 0.4 |
| banderole | Banderole | 2 | Medium | 0.4 |
| matchday_widget | Matchday Widget | 4 | Complex | 0.75 |
| table_standings | Table Standings | 3 | Medium | 0.4 |
| **Total** | | | | **9 PT** |

### Taxonomies (4)

| Machine Name | Label | Hierarchical | Est. Terms | PT |
|--------------|-------|--------------|------------|-----|
| partner_category | Partner-Kategorie | No | 7 | 0.2 |
| tags | Tags | No | 50+ | 0.2 |
| team_category | Team-Kategorie | Yes | 5 | 0.2 |
| content_category | Content-Kategorie | No | 10 | 0.2 |
| **Total** | | | | **1 PT** |

### Views (9)

| Machine Name | Label | Displays | Complexity | PT |
|--------------|-------|----------|------------|-----|
| news_listing | News-Übersicht | Page, Feed | Medium | 0.75 |
| news_slider_block | News Slider | Block | Complex | 1.5 |
| video_listing | Video-Übersicht | Page | Medium | 0.75 |
| video_slider_block | Video Slider | Block | Complex | 1.5 |
| team_listing | Team | Page, Block | Medium | 0.75 |
| partner_listing | Partner | Page | Simple | 0.4 |
| event_listing | Termine | Page | Medium | 0.75 |
| job_listing | Jobs | Page | Simple | 0.4 |
| search_results | Suche | Page | Medium | 0.75 |
| **Total** | | | | **8 PT** |

### Custom Modules (4)

| Machine Name | Beschreibung | Complexity | PT |
|--------------|--------------|------------|-----|
| vfl_sportdata | Sportdaten-API Integration | Complex | 9 |
| vfl_video | 1848TV Integration | Medium | 3.5 |
| vfl_salesforce | Salesforce CRM | Medium | 3.5 |
| vfl_partner | Partner-Management | Simple | 1.5 |
| **Total** | | | **17 PT** |

## Estimation Tables

### PT nach Komplexität

| Entity Type | Simple | Medium | Complex |
|-------------|--------|--------|---------|
| Content Type | 0.4 PT | 0.75 PT | 1.5 PT |
| Paragraph | 0.2 PT | 0.4 PT | 0.75 PT |
| Taxonomy | 0.2 PT | 0.4 PT | 0.75 PT |
| Media Type | 0.2 PT | 0.4 PT | 0.45 PT |
| View | 0.4 PT | 0.75 PT | 1.5 PT |
| Webform | 0.4 PT | 0.75 PT | 1.5 PT |
| Block | 0.2 PT | 0.4 PT | 0.75 PT |
| Custom Module | 1.5 PT | 3.5 PT | 9 PT |
| Theme Component | 0.4 PT | 0.75 PT | 1.5 PT |

### Multipliers Applied

| Multiplier | Prozent | Basis | Ergebnis |
|------------|---------|-------|----------|
| Testing | 25% | 59 PT | 15 PT |
| Documentation | 10% | 59 PT | 6 PT |
| QA | 15% | 59 PT | 9 PT |
| Advanced Permissions | 10% | 59 PT | 6 PT |
| Custom Integrations | 50% | 59 PT | 30 PT |
| Security | 10% | 59 PT | 6 PT |
| Performance | 15% | 59 PT | 9 PT |
| Accessibility | 20% | 59 PT | 12 PT |
| **Total** | | | **92 PT** |

### Migration Calculation

| Content Type | Nodes | Complexity | PT/100 | Total |
|--------------|-------|------------|--------|-------|
| Pages | 60 | Simple | 1 PT | 0.6 PT |
| News | 500 | Medium | 2 PT | 10 PT |
| Videos | 335 | Simple | 1 PT | 3.4 PT |
| Persons | 100 | Medium | 2 PT | 2 PT |
| Partners | 50 | Simple | 1 PT | 0.5 PT |
| Events | 200 | Medium | 2 PT | 4 PT |
| Media | 2000 | Simple | 0.5 PT | 10 PT |
| **Total** | **~3245** | | | **~30.5 PT** |

*Inklusive Setup und Validierung: ~29 PT*

## Budget Summary

| Category | PT | Tagessatz (€) | Kosten (€) |
|----------|-----|---------------|------------|
| Base Development | 59 | 960 | 56,640 |
| Multipliers | 92 | 960 | 88,320 |
| Migration | 29 | 960 | 27,840 |
| Additional | 46 | 800 | 36,800 |
| Buffer | 45 | 960 | 43,200 |
| **Subtotal** | **271** | | **252,800** |
| Drupal CMS Einsparung | -15 | 960 | -14,400 |
| **TOTAL mit Drupal CMS** | **256 PT** | | **238,400** |

*Hinweis: Beispielrechnung mit angenommenen Tagessätzen*

## Drupal CMS 2.0 Recipe-Mapping

| VfL Bochum Feature | Drupal CMS Recipe | Einsparung |
|--------------------|-------------------|------------|
| News/Artikel | News Recipe | 0.75 PT |
| Spieler-Profile | Person Recipe | 0.75 PT |
| Termine/Events | Event Recipe | 0.75 PT |
| Kontaktformulare | Webform Recipe | 2 PT |
| SEO-Optimierung | Yoast SEO Recipe | 1.5 PT |
| Login/Registrierung | Authentication Recipe | 1.5 PT |
| Spam-Schutz | Anti-Spam Recipe | 0.75 PT |
| Analytics | Google Analytics Recipe | 0.75 PT |
| Datenschutz | Privacy/GDPR Recipe | 1.5 PT |
| Theme-Basis | Mercury Theme | 3 PT |
| Alt-Text Generation | AI Image Alt Text | 1 PT |
| Content Summary | AI Content Summary | 1 PT |
| **GESAMT** | | **~15 PT** |
