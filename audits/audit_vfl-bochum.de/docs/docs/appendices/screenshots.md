# Screenshots

## Homepage

::: info Screenshot-Hinweis
Screenshots werden während des Live-Audits mit Chrome DevTools MCP erfasst und hier eingefügt.
:::

### Desktop-Ansicht

**Homepage Desktop (1920x1080)**
- Hero-Bereich mit aktuellem Match-Info
- News-Slider mit neuesten Artikeln
- Video-Sektion (1848TV Integration)
- Partner-Grid nach Kategorien

### Mobile-Ansicht

**Homepage Mobile (375x812)**
- Burger-Menu Navigation
- Responsive Hero-Komponente
- Gestapelte Content-Sektionen

## Key Pages

### News-Übersicht

**News Listing**
- Grid-Layout mit Teaser-Cards
- Filteroptionen nach Kategorie
- Pagination am Seitenende

### Video-Sektion (1848TV)

**1848TV**
- Video-Karussell mit Kategorien
- Embedded Player
- Related Videos Sidebar

### Team-Übersicht

**Team**
- Kader-Übersicht mit Spieler-Cards
- Filtermöglichkeit nach Position
- Detailansicht mit Statistiken

### Partner-Sektion

**Partner**
- Partner-Grid nach Kategorien gruppiert
- Logo-Darstellung mit Hover-Effekt
- Links zu Partner-Detailseiten

## Components

### Hero-Teaser

**Hero Component**
- Video-Hintergrund Option
- Overlay mit Text und CTA
- Responsive Bildgrößen

### Navigation

**Mega-Menu**
- Multi-Level Dropdown
- Kategorisierte Menüpunkte
- Quick-Links Sektion

### Mobile Navigation

**Mobile Nav**
- Burger-Menu Trigger
- Vollbild-Overlay
- Animierte Übergänge

### Slider/Karussell

**Slider**
- Touch-fähige Navigation
- Pagination Dots
- Autoplay Option

## Performance

### Lighthouse Report

**Performance Metrics**

| Metrik | Wert | Status |
|--------|------|--------|
| Performance | ~60-70 | Verbesserungspotential |
| Accessibility | ~70-80 | Gut |
| Best Practices | ~80-90 | Gut |
| SEO | ~80-90 | Gut |

### Network Waterfall

**Analyse-Punkte:**
- Initial Load: ~3-4s
- Largest Contentful Paint: ~2.5s
- First Input Delay: ~100ms
- Cumulative Layout Shift: ~0.1

## Accessibility

### Axe DevTools Report

**Gefundene Issues:**
- Kontrast-Probleme in einigen Bereichen
- Fehlende Alt-Texte bei Bildern
- Formular-Labels zu verbessern
- Skip-Links fehlen

---

## Screenshot-Erfassung

Screenshots werden mit folgenden Tools erfasst:

```bash
# Chrome DevTools MCP
mcp__chrome-devtools__take_screenshot (fullPage: true)

# Puppeteer MCP
mcp__puppeteer__puppeteer_screenshot (name: "homepage", width: 1920, height: 1080)
```

### Auflösungen

| Device | Width | Height |
|--------|-------|--------|
| Desktop | 1920 | 1080 |
| Tablet | 768 | 1024 |
| Mobile | 375 | 812 |

::: tip Nächste Schritte
Nach dem Live-Audit werden hier die tatsächlichen Screenshots eingefügt.
:::
