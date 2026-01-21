# Media Types

## Übersicht

6 Media-Typen wurden für die Drupal-Architektur identifiziert:

| # | Media Type | Komplexität | Stunden | Beschreibung |
|---|------------|-------------|---------|--------------|
| 1 | Image | Simple | 1.5h | Standard-Bilder |
| 2 | Video | Medium | 3h | Videos (1848TV, YouTube) |
| 3 | Player Image Set | Medium | 3h | Spielerfotos (multi-format) |
| 4 | Hero Image Set | Medium | 3h | Hero-Banner (responsive) |
| 5 | Logo | Simple | 1.5h | Partner-Logos |
| 6 | Document | Simple | 1.5h | PDF-Downloads |
| | **Gesamt** | | **7.5h** | |

## Detaillierte Beschreibungen

### 1. Image

**Komplexität:** Simple (1.5h)

Standard-Bilder für allgemeine Verwendung.

**Felder:**
- Name (Text)
- Image (Image)
- Alt Text (Text)
- Focal Point (Focal Point)

**Image Styles:**
- thumbnail (100x100)
- small (320x240)
- medium (640x480)
- large (1280x720)
- full (original)

**Responsive Image Sets:**
- content_image
- teaser_image
- gallery_image

---

### 2. Video

**Komplexität:** Medium (3h)

Videos von 1848TV und YouTube.

**Felder:**
- Name (Text)
- Video URL (Text)
- oEmbed URL (Text, für YouTube)
- Thumbnail (Image)
- Duration (Integer)
- Provider (Select: 1848TV, YouTube, Vimeo)

**Unterstützte Provider:**
- 1848TV (custom player)
- YouTube (oEmbed)
- Vimeo (oEmbed)

---

### 3. Player Image Set

**Komplexität:** Medium (3h)

Spielerfotos in verschiedenen Formaten.

**Felder:**
- Name (Text)
- Portrait (Image) - Hochformat
- Action Shot (Image) - Spielszene
- Thumbnail (Image) - Kleines Bild
- Background Removed (Image) - Freigestellt

**Image Styles:**
- player_portrait (400x500)
- player_action (800x600)
- player_card (300x400)
- player_thumbnail (100x100)

---

### 4. Hero Image Set

**Komplexität:** Medium (3h)

Hero-Banner mit responsiven Varianten.

**Felder:**
- Name (Text)
- Desktop Image (Image) - 1920x800
- Tablet Image (Image) - 1024x600
- Mobile Image (Image) - 768x400
- Focal Point (Focal Point)

**Responsive Breakpoints:**
```css
/* Desktop */
@media (min-width: 1200px) { /* 1920x800 */ }
/* Tablet */
@media (min-width: 768px) { /* 1024x600 */ }
/* Mobile */
@media (max-width: 767px) { /* 768x400 */ }
```

---

### 5. Logo

**Komplexität:** Simple (1.5h)

Partner-Logos in verschiedenen Varianten.

**Felder:**
- Name (Text)
- Logo Color (Image) - Farbige Version
- Logo Monochrome (Image) - Schwarz/Weiß
- Logo White (Image) - Weiße Version

**Empfohlene Formate:**
- SVG (bevorzugt)
- PNG mit Transparenz

**Image Styles:**
- logo_small (150x80)
- logo_medium (200x100)
- logo_large (300x150)

---

### 6. Document

**Komplexität:** Simple (1.5h)

PDF-Downloads und andere Dokumente.

**Felder:**
- Name (Text)
- File (File)
- Description (Text, Optional)
- File Size (Computed)

**Erlaubte Dateitypen:**
- PDF (.pdf)
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- Text (.txt)

---

## Media Library Konfiguration

### Upload-Einstellungen

| Setting | Wert |
|---------|------|
| Max Upload Size | 50 MB |
| Max Image Resolution | 4000x4000 |
| Allowed Image Formats | jpg, jpeg, png, gif, webp, svg |
| Allowed Video Formats | mp4, webm (falls lokal) |
| Allowed Document Formats | pdf, doc, docx, xls, xlsx, txt |

### Verzeichnisstruktur

```
public://
├── images/
│   ├── news/
│   ├── heroes/
│   └── general/
├── videos/
│   └── thumbnails/
├── players/
│   ├── portraits/
│   └── action/
├── logos/
├── documents/
└── uploads/
```

## Focal Point Integration

Für responsive Bildausschnitte wird das Focal Point Modul verwendet:

**Konfiguration:**
- Focal Point auf allen Image-Feldern aktivieren
- Crop Types für verschiedene Seitenverhältnisse
- Preview im Media Edit Form

**Crop Types:**

| Name | Ratio | Verwendung |
|------|-------|------------|
| square | 1:1 | Thumbnails |
| landscape | 16:9 | News Teaser |
| portrait | 3:4 | Spieler-Karten |
| hero | 21:9 | Hero Banner |
| card | 4:3 | Cards |

## Migration

### Geschätztes Media-Volumen

| Typ | Anzahl (ca.) |
|-----|--------------|
| Images | 1.500 |
| Videos | 335 (nur Referenzen) |
| Player Images | 100 |
| Logos | 50 |
| Documents | 50 |
| **Gesamt** | **~2.000** |

### Migration-Strategie

1. **Download:** Media-Dateien von BloomReach CDN herunterladen
2. **Reorganisation:** Dateien in neue Verzeichnisstruktur sortieren
3. **Import:** Mit Migrate API in Drupal importieren
4. **URL-Mapping:** Alte URLs auf neue mappen (Redirects)
