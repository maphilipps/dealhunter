# Detailed Breakdown

::: tip Einheit: Personentage (PT)
Alle Schätzungen in Personentagen (1 PT = 8 Stunden)
:::

## Base (59 PT)

### Content Types (6 PT)

| Name | Komplexität | Tage |
|------|-------------|------|
| Landing Page | Complex | 1.5 PT |
| News/Article | Medium | 0.75 PT |
| Video | Medium | 0.75 PT |
| Person/Teammember | Medium | 0.75 PT |
| Partner | Simple | 0.4 PT |
| Event/Termin | Medium | 0.75 PT |
| Page (Basic) | Simple | 0.4 PT |
| Job | Medium | 0.75 PT |
| Team | Simple | 0.4 PT |
| **Subtotal** | | **6 PT** |

::: info Drupal CMS Einsparung
Mit News Recipe, Person Recipe und Event Recipe: **~2.5 PT Ersparnis**
:::

### Paragraph Types (9 PT)

| Name | Komplexität | Tage |
|------|-------------|------|
| hero | Complex | 0.75 PT |
| news_slider | Complex | 0.75 PT |
| video_slider | Complex | 0.75 PT |
| teaser_slider | Complex | 0.75 PT |
| product_slider | Complex | 0.75 PT |
| team_slider | Complex | 0.75 PT |
| text | Simple | 0.2 PT |
| free_html | Medium | 0.4 PT |
| media | Simple | 0.2 PT |
| cta | Simple | 0.2 PT |
| card | Medium | 0.4 PT |
| card_group | Medium | 0.4 PT |
| accordion | Medium | 0.4 PT |
| newsletter | Medium | 0.4 PT |
| partner_grid | Medium | 0.4 PT |
| banderole | Medium | 0.4 PT |
| matchday_widget | Complex | 0.75 PT |
| table_standings | Medium | 0.4 PT |
| **Subtotal** | | **9 PT** |

### Taxonomies (1 PT)

| Name | Komplexität | Tage |
|------|-------------|------|
| Partner Category | Simple | 0.2 PT |
| Tags | Simple | 0.2 PT |
| Team Category | Simple | 0.2 PT |
| Content Category | Simple | 0.2 PT |
| **Subtotal** | | **1 PT** |

### Media Types (1 PT)

| Name | Komplexität | Tage |
|------|-------------|------|
| Image | Simple | 0.2 PT |
| Video | Medium | 0.4 PT |
| Document | Simple | 0.2 PT |
| SVG/Icon | Simple | 0.2 PT |
| **Subtotal** | | **1 PT** |

### Views (8 PT)

| Name | Komplexität | Tage |
|------|-------------|------|
| News Listing | Medium | 0.75 PT |
| News Slider Block | Complex | 1.5 PT |
| Video Listing | Medium | 0.75 PT |
| Video Slider Block | Complex | 1.5 PT |
| Team Listing | Medium | 0.75 PT |
| Partner Listing | Simple | 0.4 PT |
| Event Listing | Medium | 0.75 PT |
| Job Listing | Simple | 0.4 PT |
| Search Results | Medium | 0.75 PT |
| **Subtotal** | | **8 PT** |

### Webforms (3 PT)

| Name | Komplexität | Tage |
|------|-------------|------|
| Contact Form | Medium | 0.75 PT |
| Newsletter Signup | Simple | 0.4 PT |
| Membership Application | Complex | 1.5 PT |
| **Subtotal** | | **3 PT** |

::: info Drupal CMS Einsparung
Mit Webform Recipe: **~1.5 PT Ersparnis**
:::

### Custom Modules (17 PT)

| Name | Komplexität | Tage |
|------|-------------|------|
| Sportdaten-Integration | Complex | 9 PT |
| Salesforce Integration | Medium | 3.5 PT |
| 1848TV Integration | Medium | 3.5 PT |
| Partner Management | Simple | 1.5 PT |
| **Subtotal** | | **17 PT** |

### Theme Components (15 PT)

| Name | Komplexität | Tage |
|------|-------------|------|
| Header/Navigation | Complex | 1.5 PT |
| Footer | Medium | 0.75 PT |
| Hero Component | Complex | 1.5 PT |
| Slider/Carousel | Complex | 1.5 PT |
| Card Component | Medium | 0.75 PT |
| Button Component | Simple | 0.4 PT |
| Form Styling | Medium | 0.75 PT |
| Match Widget | Complex | 1.5 PT |
| Table Component | Medium | 0.75 PT |
| Partner Logo Grid | Medium | 0.75 PT |
| Video Player | Medium | 0.75 PT |
| News Card | Medium | 0.75 PT |
| Team Card | Medium | 0.75 PT |
| Event Card | Medium | 0.75 PT |
| Accordion Component | Medium | 0.75 PT |
| Newsletter Component | Medium | 0.75 PT |
| **Subtotal** | | **15 PT** |

---

## Multipliers (92 PT)

| Multiplier | Prozent | Tage |
|------------|---------|------|
| Testing | 25% | 15 PT |
| Documentation | 10% | 6 PT |
| QA | 15% | 9 PT |
| Multilingual | 0% | 0 PT |
| Advanced Permissions | 10% | 6 PT |
| Custom Integrations | 50% | 30 PT |
| Security | 10% | 6 PT |
| Performance | 15% | 9 PT |
| Accessibility | 20% | 12 PT |
| **Total** | | **92 PT** |

---

## Migration (29 PT)

| Phase | Tage |
|-------|------|
| Setup & Analyse | 4 PT |
| Mapping & Planung | 2.5 PT |
| Script-Entwicklung | 10 PT |
| Media-Migration | 4 PT |
| Test-Durchläufe | 4 PT |
| Final-Migration | 2.5 PT |
| Validierung | 2.5 PT |
| **Subtotal** | **29 PT** |

---

## Additional Effort (46 PT)

| Item | Tage |
|------|------|
| Infrastructure Setup | 8 PT |
| Training & Handover | 4 PT |
| Project Management (18%) | 34 PT |
| **Total** | **46 PT** |

---

## Buffer (45 PT)

| Risk Level | Prozent | Tage |
|------------|---------|------|
| Low | 15% | 34 PT |
| **Medium (gewählt)** | **20%** | **45 PT** |
| High | 25% | 57 PT |

---

## Gesamt-Kalkulation

```
Base (Entities):           59 PT
+ Multipliers:             92 PT
+ Migration:               29 PT
+ Additional:              46 PT
─────────────────────────────────
Subtotal:                 226 PT

+ Buffer (20%):            45 PT
─────────────────────────────────
TOTAL ohne Drupal CMS:    271 PT

- Drupal CMS Einsparungen: 15 PT
─────────────────────────────────
TOTAL mit Drupal CMS:     256 PT
```

## Drupal CMS 2.0 Einsparungen Detail

| Recipe | Kategorie | Einsparung |
|--------|-----------|------------|
| News Recipe | Content Type | 0.75 PT |
| Person Recipe | Content Type | 0.75 PT |
| Event Recipe | Content Type | 0.75 PT |
| Webform Recipe | Forms | 2 PT |
| SEO Recipe (Yoast) | Config | 1.5 PT |
| Authentication Recipe | Security | 1.5 PT |
| Anti-Spam Recipe | Security | 0.75 PT |
| Google Analytics Recipe | Analytics | 0.75 PT |
| Privacy/GDPR Recipe | Compliance | 1.5 PT |
| Mercury Theme Basis | Theme | 3 PT |
| AI Image Alt Text | Content | 1 PT |
| AI Content Summary | Content | 1 PT |
| **TOTAL Einsparung** | | **~15 PT** |
