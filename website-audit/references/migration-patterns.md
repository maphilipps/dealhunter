# Migration Patterns: Current Tech → Drupal

## Overview

This reference documents migration paths from common CMS platforms to Drupal/Drupal CMS, including effort estimation and risk assessment.

---

## Migration Assessment Framework

### Step 1: Identify Source System

Detect the current CMS/technology:

```
WordPress:    /wp-content/, wp-json, <meta generator="WordPress">
Typo3:        typo3conf/, typo3temp/, EXT:
Joomla:       /components/, /modules/, com_
Drupal:       /sites/default/files/, Drupal.settings
Magnolia:     /.magnolia/, /dam/, mgnl
Umbraco:      /umbraco/, UmbracoFile
Ibexa:        /var/site/, ezpublish
Custom:       No clear CMS indicators
```

### Step 2: Assess Migration Complexity

| Factor | Low | Medium | High |
|--------|-----|--------|------|
| Content volume | <500 pages | 500-2000 | >2000 |
| Content types | <5 | 5-10 | >10 |
| Custom fields | <20 | 20-50 | >50 |
| Media files | <1000 | 1000-5000 | >5000 |
| Multilingual | No | 2-3 languages | 4+ languages |
| Custom code | Minimal | Some | Extensive |
| Integrations | None | 1-3 | 4+ |

### Step 3: Choose Migration Strategy

1. **Big Bang:** All content at once
2. **Phased:** Content type by type
3. **Parallel Run:** Old and new coexist temporarily
4. **Hybrid:** Critical content first, archive later

---

## WordPress → Drupal

### Content Mapping

| WordPress | Drupal | Notes |
|-----------|--------|-------|
| Posts | Article/Blog CT | Direct mapping |
| Pages | Basic Page CT | Direct mapping |
| Categories | Taxonomy | Hierarchical |
| Tags | Taxonomy | Flat |
| Custom Post Types | Content Types | Field mapping needed |
| Featured Image | Media reference | Image styles differ |
| Gutenberg Blocks | Paragraphs | Rebuild required |
| ACF Fields | Drupal Fields | Type matching |
| Users | Users | Role mapping |
| Menus | Menus | Structure rebuild |
| Widgets | Blocks | Configuration |

### Migration Approach

**Recommended:** WordPress REST API or direct database

**Tools:**
- Drupal Migrate module (core)
- Migrate Plus
- Migrate Tools
- WordPress Migrate

**Process:**
1. Export via REST API or database
2. Map content types and fields
3. Transform content (shortcodes, images)
4. Migrate taxonomies first
5. Migrate users
6. Migrate content
7. Migrate media
8. Rebuild menus

### Gutenberg → Paragraphs Conversion

| Gutenberg Block | Drupal Paragraph |
|-----------------|------------------|
| Paragraph | Text |
| Heading | Text (with format) |
| Image | Image |
| Gallery | Gallery |
| Quote | Quote |
| List | Text |
| Video | Video embed |
| Button | CTA |
| Columns | Layout section |
| Group | Section wrapper |

**Complexity:** Medium-High (requires parsing block JSON)

### Effort Estimation

| Scope | Hours |
|-------|-------|
| Migration setup | 20-30h |
| Per content type (per 100 nodes) | 8-12h |
| Gutenberg parsing | +50% |
| Media migration | 8-16h |
| User migration | 4-8h |
| Menu rebuild | 4-8h |
| Testing & QA | 20-30% of total |

**Example: 500 pages, 3 content types, Gutenberg**
- Setup: 25h
- Content: 3 × 5 × 10h × 1.5 = 225h
- Media: 12h
- Users: 6h
- Menus: 6h
- QA: 68h
- **Total: ~342h**

---

## Typo3 → Drupal

### Content Mapping

| Typo3 | Drupal | Notes |
|-------|--------|-------|
| Pages (tree) | Content + Menus | Structure differs |
| Content Elements | Paragraphs | Rebuild |
| tt_content | Content Types | Type mapping |
| fe_users | Users | Different auth |
| sys_category | Taxonomy | |
| FAL | Media | |
| Backend Layouts | Layouts | Rebuild |
| TypoScript | Twig | Complete rewrite |
| Extbase | Custom modules | Rebuild |

### Migration Approach

**Recommended:** Database export + custom scripts

**Challenges:**
- Typo3's page tree ≠ Drupal structure
- Content elements embedded in pages
- TypoScript has no equivalent

**Process:**
1. Export database to CSV/JSON
2. Flatten page tree to content
3. Map content elements to paragraphs
4. Rebuild FAL → Media
5. Recreate navigation from page tree
6. Rebuild layouts

### Effort Estimation

| Scope | Hours |
|-------|-------|
| Migration setup | 30-40h |
| Page tree conversion | 16-24h |
| Per content type (per 100) | 12-16h |
| Content element parsing | +40% |
| FAL → Media | 12-20h |
| User migration | 8-12h |
| Testing & QA | 25-30% of total |

**Complexity Factor:** 1.3-1.5× compared to WordPress

---

## Magnolia → Drupal

### Content Mapping

| Magnolia | Drupal | Notes |
|----------|--------|-------|
| Content Types | Content Types | Similar concept |
| Components | Paragraphs | Good mapping |
| Assets (DAM) | Media | |
| Pages | Nodes + URL | |
| Workspaces | Revisions | Different model |
| Users/Roles | Users/Roles | |

### Migration Approach

**Recommended:** REST API export

**Process:**
1. Export via Magnolia REST API
2. Map content type schemas
3. Convert components to paragraphs
4. Migrate DAM assets
5. Rebuild templates in Twig

### Effort Estimation

| Scope | Hours |
|-------|-------|
| API integration | 16-24h |
| Schema mapping | 16-24h |
| Per content type (per 100) | 10-14h |
| Component conversion | +30% |
| DAM → Media | 12-20h |
| Testing & QA | 20-25% of total |

---

## Umbraco → Drupal

### Content Mapping

| Umbraco | Drupal | Notes |
|---------|--------|-------|
| Document Types | Content Types | Good mapping |
| Block Editor | Paragraphs | Similar concept |
| Media Types | Media Types | |
| Members | Users | |
| Data Types | Field Types | |
| Compositions | Field groups | |

### Migration Approach

**Recommended:** Umbraco API or database

**Process:**
1. Export via API or SQL
2. Map document types
3. Convert block editor to paragraphs
4. Migrate media library
5. Rebuild templates from Razor to Twig

### Effort Estimation

| Scope | Hours |
|-------|-------|
| Migration setup | 24-32h |
| Per document type (per 100) | 10-12h |
| Block → Paragraph | +25% |
| Media migration | 10-16h |
| Member → User | 6-10h |
| Testing & QA | 20-25% of total |

---

## Ibexa → Drupal

### Content Mapping

| Ibexa | Drupal | Notes |
|-------|--------|-------|
| Content Types | Content Types | Direct mapping |
| Field Types | Field Types | Similar |
| Locations | URL aliases | Different model |
| Page Builder | Layout Builder | Similar |
| Users/Policies | Users/Permissions | |
| Translations | Translations | Good mapping |

### Migration Approach

**Recommended:** Ibexa REST API

**Advantage:** Both PHP/Symfony, Twig templates similar

**Process:**
1. Export via REST API
2. Map content types (usually 1:1)
3. Convert field types
4. Migrate translations
5. Adapt Twig templates
6. Rebuild page builder layouts

### Effort Estimation

| Scope | Hours |
|-------|-------|
| API integration | 12-16h |
| Schema mapping | 12-16h |
| Per content type (per 100) | 8-12h |
| Translation handling | +40% for multilingual |
| Page builder conversion | +30% |
| Testing & QA | 20-25% of total |

**Complexity Factor:** 0.8-1.0× (easier than most)

---

## Custom/Static Sites → Drupal

### Assessment

For static sites or custom CMSs:

1. Identify content patterns manually
2. Define content types from patterns
3. Plan scraping or manual entry
4. Build Drupal structure first
5. Migrate content via scraping or import

### Migration Options

| Method | When to Use | Effort |
|--------|-------------|--------|
| Web scraping | No data access | High |
| Database export | Access available | Medium |
| CSV import | Manual export | Medium |
| Manual entry | <50 pages | Low |

### Scraping Approach

**Tools:**
- Puppeteer/Playwright
- BeautifulSoup
- Scrapy

**Process:**
1. Crawl sitemap
2. Extract content patterns
3. Parse HTML to structured data
4. Clean HTML (remove inline styles)
5. Import to Drupal

**Effort:** +50-100% compared to structured export

---

## Current Tech → Drupal Comparison Document

Generate this document during audit:

```markdown
## Technology Migration Analysis

### Current Stack
- **CMS:** [Detected CMS]
- **Version:** [If detected]
- **Framework:** [Frontend framework]
- **Hosting:** [If detected]

### Migration Path

| Current | Drupal Equivalent | Migration Complexity |
|---------|-------------------|---------------------|
| [Content Type] | [Drupal CT] | Simple/Medium/Complex |
| [Component] | [Paragraph] | Simple/Medium/Complex |
| ... | ... | ... |

### What Can Be Preserved
- Content text and structure
- Media files (with re-processing)
- URL patterns (with redirects)
- User accounts (with password reset)

### What Must Be Rebuilt
- Templates/themes
- Custom functionality
- Integrations
- Workflows

### Migration Effort

| Phase | Hours |
|-------|-------|
| Setup & mapping | XXh |
| Content migration | XXh |
| Media migration | XXh |
| Testing & QA | XXh |
| **Total** | **XXh** |

### Risks & Mitigations
1. **Risk:** [Description]
   **Mitigation:** [Action]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]
```

---

## Migration Effort Quick Reference

### By Source System

| Source | Multiplier | Notes |
|--------|------------|-------|
| WordPress (classic) | 1.0× | Baseline |
| WordPress (Gutenberg) | 1.5× | Block parsing |
| Typo3 | 1.3-1.5× | Page tree complexity |
| Magnolia | 1.2× | Good API |
| Umbraco | 1.1× | Similar architecture |
| Ibexa | 0.8-1.0× | Very similar |
| Custom/static | 1.5-2.0× | Scraping required |

### By Content Volume

| Pages | Base Hours |
|-------|------------|
| <100 | 40-60h |
| 100-500 | 60-120h |
| 500-1000 | 120-200h |
| 1000-5000 | 200-400h |
| >5000 | 400h+ |

### By Complexity

| Type | Multiplier |
|------|------------|
| Simple (mostly pages) | 1.0× |
| Medium (mixed content) | 1.3× |
| Complex (many types) | 1.6× |
| Very complex (integrations) | 2.0× |

---

## Post-Migration Tasks

Always include in estimates:

1. **Redirects setup** (4-8h)
2. **SEO verification** (8-16h)
3. **Content review** (2-4h per 100 pages)
4. **Training** (8-16h)
5. **Hypercare** (40-80h first month)

---

## Resources

- Drupal Migrate docs: https://www.drupal.org/docs/drupal-apis/migrate-api
- Migrate Plus: https://www.drupal.org/project/migrate_plus
- WordPress Migrate: https://www.drupal.org/project/wordpress_migrate
