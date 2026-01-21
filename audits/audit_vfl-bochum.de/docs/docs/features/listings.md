# Views & Listings

## Übersicht

9 Views wurden für Content-Listings identifiziert:

| # | View | Komplexität | Stunden | Content Type |
|---|------|-------------|---------|--------------|
| 1 | News Listing | Medium | 6h | News/Article |
| 2 | News Slider Block | Complex | 12h | News/Article |
| 3 | Video Listing | Medium | 6h | Video |
| 4 | Video Slider Block | Complex | 12h | Video |
| 5 | Team Listing | Medium | 6h | Person |
| 6 | Partner Listing | Simple | 3h | Partner |
| 7 | Event Listing | Medium | 6h | Event |
| 8 | Job Listing | Simple | 3h | Job |
| 9 | Search Results | Medium | 6h | Multiple |
| | **Gesamt** | | **60h** | |

## Detaillierte View-Konfigurationen

### 1. News Listing

**Komplexität:** Medium (6h)

**URL:** `/news`

**Display Types:**
- Page (Grid)
- Feed (RSS)

**Felder:**
- Image (Teaser)
- Title (linked)
- Teaser Text
- Date
- Category Tag

**Filter:**
- Category (Exposed)
- Tags (Contextual/Exposed)
- Date Range (Exposed)

**Sortierung:**
- Datum (DESC)

**Pager:**
- Full Pager, 12 items

---

### 2. News Slider Block

**Komplexität:** Complex (12h)

**Display Type:** Block

**JavaScript:** Swiper.js oder Splide

**Felder:**
- Image (Hero)
- Title (linked)
- Teaser Text
- Date
- Category Tag

**Filter:**
- Category (Pre-filtered by Block Config)
- Featured (Optional)

**Limit:** 6-10 items

**Template:**
```twig
{# views-view--news-slider.html.twig #}
<div class="news-slider swiper">
  <div class="swiper-wrapper">
    {% for row in rows %}
      <div class="swiper-slide">
        {{ row.content }}
      </div>
    {% endfor %}
  </div>
  <div class="swiper-pagination"></div>
  <div class="swiper-button-prev"></div>
  <div class="swiper-button-next"></div>
</div>
```

---

### 3. Video Listing

**Komplexität:** Medium (6h)

**URL:** `/1848tv` oder `/videos`

**Display Types:**
- Page (Grid)

**Felder:**
- Thumbnail (mit Play-Icon Overlay)
- Title (linked)
- Duration
- Date
- Category

**Filter:**
- Category (Exposed)
- Tags (Exposed)

**Sortierung:**
- Datum (DESC)

**Pager:**
- Full Pager, 12 items

---

### 4. Video Slider Block

**Komplexität:** Complex (12h)

**Display Type:** Block

**JavaScript:** Swiper.js

**Felder:**
- Thumbnail (mit Play-Icon)
- Title
- Duration

**Limit:** 8 items

---

### 5. Team Listing

**Komplexität:** Medium (6h)

**URL:** `/profis/kader`, `/frauen/kader`, etc.

**Display Types:**
- Page (Grid)
- Block (Team Category)

**Felder:**
- Portrait Image
- Name
- Position
- Jersey Number

**Filter:**
- Team Category (Contextual)
- Position (Exposed, optional)

**Sortierung:**
- Jersey Number (ASC) oder Name (ASC)

**Gruppierung:**
- Optional nach Position (Torwart, Abwehr, Mittelfeld, Sturm)

---

### 6. Partner Listing

**Komplexität:** Simple (3h)

**URL:** `/netzwerk`

**Display Type:** Page (Logo Grid)

**Felder:**
- Logo
- Name
- Website Link

**Filter:**
- Partner Category (Pre-filtered by Section)

**Sortierung:**
- Weight (ASC)
- Category (Grouping)

**Layout:**
```
Lead Partner (große Logos)
├── Logo 1
└── Logo 2

Premium Partner (mittlere Logos)
├── Logo 3
├── Logo 4
└── ...

Top Partner (kleine Logos)
└── ...
```

---

### 7. Event Listing

**Komplexität:** Medium (6h)

**URL:** `/termine`, `/spielplan`

**Display Types:**
- Page (Calendar/List)
- Block (Upcoming)

**Felder:**
- Date/Time
- Event Type Icon
- Title (Teams oder Event Name)
- Location
- Ticket Link

**Filter:**
- Event Type (Exposed)
- Competition (Exposed)
- Date Range (Exposed)

**Sortierung:**
- Date (ASC für Upcoming, DESC für Archive)

---

### 8. Job Listing

**Komplexität:** Simple (3h)

**URL:** `/jobs`

**Display Types:**
- Page (List)

**Felder:**
- Title (linked)
- Department
- Location
- Employment Type
- Deadline

**Filter:**
- Department (Exposed, optional)

**Sortierung:**
- Deadline (ASC) oder Posted Date (DESC)

---

### 9. Search Results

**Komplexität:** Medium (6h)

**URL:** `/suche`

**Display Type:** Page

**Felder:**
- Content Type Icon/Label
- Title (linked)
- Excerpt/Teaser
- Date

**Filter:**
- Search Keywords (Exposed, Required)
- Content Type (Exposed, optional)

**Sortierung:**
- Relevance (Default)
- Date (Optional)

---

## View Templates

### Grid Layout

```twig
{# views-view-unformatted--[view-name].html.twig #}
<div class="view-grid view-grid--{{ columns|default(3) }}-cols">
  {% for row in rows %}
    <div class="view-grid__item">
      {{ row.content }}
    </div>
  {% endfor %}
</div>
```

### List Layout

```twig
{# views-view-list--[view-name].html.twig #}
<ul class="view-list">
  {% for row in rows %}
    <li class="view-list__item">
      {{ row.content }}
    </li>
  {% endfor %}
</ul>
```

## Caching-Strategie

| View | Cache | Max Age |
|------|-------|---------|
| News Listing | Tag-based | 5 min |
| Video Listing | Tag-based | 5 min |
| Team Listing | Tag-based | 1 hour |
| Partner Listing | Tag-based | 1 hour |
| Event Listing | Time-based | 1 min |
| Search Results | None | - |
