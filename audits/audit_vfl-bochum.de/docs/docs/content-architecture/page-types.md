# Page Types (Content Types)

## Übersicht

9 Content Types wurden für die Drupal-Architektur identifiziert:

| # | Content Type | Komplexität | Stunden |
|---|--------------|-------------|---------|
| 1 | Landing Page | Complex | 12h |
| 2 | News/Article | Medium | 6h |
| 3 | Video | Medium | 6h |
| 4 | Person/Teammember | Medium | 6h |
| 5 | Partner | Simple | 3h |
| 6 | Event/Termin | Medium | 6h |
| 7 | Page (Basic) | Simple | 3h |
| 8 | Job | Medium | 6h |
| 9 | Team | Simple | 3h |
| | **Gesamt** | | **51h** |

## Detaillierte Beschreibungen

### 1. Landing Page

**Komplexität:** Complex (12h)

Flexible Sektionen-Seiten für Homepage und Bereichsseiten.

**Felder:**
- Title
- Hero (Entity Reference: Paragraph)
- Sections (Entity Reference: Paragraph, Multiple)
- Meta Tags

**Verwendung:**
- Homepage
- Verein-Übersicht
- Stadion-Übersicht
- Fans-Übersicht

---

### 2. News/Article

**Komplexität:** Medium (6h)

News-Artikel mit Tags und Kategorien.

**Felder:**
- Title
- Teaser Image (Entity Reference: Media)
- Teaser Text (Text, Summary)
- Body (Text, Formatted, Long)
- Date (Datetime)
- Category (Entity Reference: Taxonomy)
- Tags (Entity Reference: Taxonomy, Multiple)
- Author (Entity Reference: User)

**Verwendung:**
- Alle News-Artikel
- Pressemitteilungen
- Spielberichte

---

### 3. Video

**Komplexität:** Medium (6h)

Video-Content mit 1848TV Integration.

**Felder:**
- Title
- Thumbnail (Entity Reference: Media)
- Video URL/Embed (Text)
- Description (Text, Formatted)
- Duration (Integer)
- Date (Datetime)
- Category (Entity Reference: Taxonomy)
- Tags (Entity Reference: Taxonomy, Multiple)

**Verwendung:**
- 1848TV Videos
- YouTube Embeds
- Pressekonferenzen
- Interviews

---

### 4. Person/Teammember

**Komplexität:** Medium (6h)

Spieler- und Staff-Profile.

**Felder:**
- Name (Title)
- First Name (Text)
- Last Name (Text)
- Portrait (Entity Reference: Media)
- Action Image (Entity Reference: Media)
- Position (Text)
- Jersey Number (Integer)
- Nationality (Text)
- Date of Birth (Date)
- Team (Entity Reference: Taxonomy)
- Biography (Text, Formatted)
- Social Media Links (Link, Multiple)
- Statistics (Custom Field Group)

**Verwendung:**
- Spieler-Profile
- Trainer-Profile
- Staff-Profile

---

### 5. Partner

**Komplexität:** Simple (3h)

Sponsoren und Partner.

**Felder:**
- Name (Title)
- Logo (Entity Reference: Media)
- Logo Monochrome (Entity Reference: Media)
- Website (Link)
- Category (Entity Reference: Taxonomy)
- Weight (Integer, für Sortierung)

**Verwendung:**
- Lead Partner
- Premium Partner
- Top Partner
- Network Partner

---

### 6. Event/Termin

**Komplexität:** Medium (6h)

Spiele und Events.

**Felder:**
- Title
- Event Type (Select: Spiel, Event, Pressekonferenz)
- Date/Time (Datetime Range)
- Location (Text)
- Home Team (Entity Reference)
- Away Team (Entity Reference)
- Competition (Entity Reference: Taxonomy)
- Ticket Link (Link)
- Result (Text)
- Match Report (Entity Reference: Node)

**Verwendung:**
- Spielplan
- Termine
- Events

---

### 7. Page (Basic)

**Komplexität:** Simple (3h)

Einfache Textseiten.

**Felder:**
- Title
- Body (Text, Formatted, Long)
- Sidebar Content (Entity Reference: Paragraph, Optional)

**Verwendung:**
- Impressum
- Datenschutz
- AGB
- Kontakt

---

### 8. Job

**Komplexität:** Medium (6h)

Stellenanzeigen.

**Felder:**
- Title
- Department (Text)
- Location (Text)
- Employment Type (Select: Vollzeit, Teilzeit, etc.)
- Description (Text, Formatted)
- Requirements (Text, Formatted)
- Benefits (Text, Formatted)
- Application Deadline (Date)
- Contact (Text)
- Application Link/Email (Link)

**Verwendung:**
- Stellenausschreibungen
- Praktika
- Ausbildung

---

### 9. Team

**Komplexität:** Simple (3h)

Team-Gruppierungen.

**Felder:**
- Name (Title)
- Description (Text)
- Category (Entity Reference: Taxonomy)
- Weight (Integer)

**Verwendung:**
- Profis
- Frauen
- U23, U19, etc.

## Mapping-Tabelle

| Aktuelle Seite | Drupal Content Type |
|----------------|---------------------|
| Homepage | Landing Page |
| Verein-Übersicht | Landing Page |
| News-Artikel | News/Article |
| Video-Detail | Video |
| Spieler-Profil | Person |
| Partner-Seite | Partner (View) |
| Spielplan | Event (View) |
| Impressum | Page (Basic) |
| Stellenanzeige | Job |
| Team-Übersicht | Team (View) |
