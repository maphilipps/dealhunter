# Asset Optimization

## Aktuelle Asset-Verteilung

| Asset-Typ | Größe | Requests | Optimierungspotential |
|-----------|-------|----------|----------------------|
| HTML | ~50 KB | 1 | Mittel (JSON-Payload) |
| CSS | ~80 KB | 3-5 | Niedrig |
| JavaScript | ~400 KB | 10-15 | Hoch |
| Images | ~600 KB | 15-20 | Hoch |
| Fonts | ~50 KB | 3-4 | Niedrig |
| **Gesamt** | **~1.17 MB** | **~50** | |

## Image-Optimierung

### Aktueller Stand

- Format: Hauptsächlich JPEG/PNG
- Responsive: Teilweise implementiert
- Lazy Loading: Nicht durchgängig

### Empfehlungen

#### 1. Moderne Formate

| Format | Einsparung | Browser-Support |
|--------|-----------|-----------------|
| WebP | ~30% | 95%+ |
| AVIF | ~50% | 85%+ |

```html
<picture>
  <source srcset="/image.avif" type="image/avif">
  <source srcset="/image.webp" type="image/webp">
  <img src="/image.jpg" alt="..." loading="lazy">
</picture>
```

#### 2. Responsive Images

```html
<img
  srcset="/hero-400.jpg 400w,
          /hero-800.jpg 800w,
          /hero-1200.jpg 1200w,
          /hero-1600.jpg 1600w"
  sizes="(max-width: 600px) 100vw,
         (max-width: 1200px) 80vw,
         1600px"
  src="/hero-1200.jpg"
  alt="Hero Image"
  loading="lazy"
>
```

#### 3. Lazy Loading

```html
<!-- Native Lazy Loading -->
<img src="/image.jpg" loading="lazy" alt="...">

<!-- Intersection Observer für erweiterte Kontrolle -->
<img data-src="/image.jpg" class="lazy" alt="...">
```

### Drupal Image Styles

| Style Name | Dimensions | Format |
|------------|------------|--------|
| hero_desktop | 1920x800 | WebP |
| hero_tablet | 1024x600 | WebP |
| hero_mobile | 768x400 | WebP |
| teaser_large | 640x360 | WebP |
| teaser_small | 320x180 | WebP |
| thumbnail | 100x100 | WebP |

---

## JavaScript-Optimierung

### Aktueller Stand

- Framework: Next.js (React)
- Bundle-Größe: ~400 KB
- Code Splitting: Teilweise

### Empfehlungen

#### 1. Code Splitting

```javascript
// Dynamic Imports
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false
});
```

#### 2. Tree Shaking

```javascript
// Statt
import _ from 'lodash';

// Besser
import debounce from 'lodash/debounce';
```

#### 3. Third-Party Scripts

| Script | Empfehlung |
|--------|-----------|
| Google Analytics | gtag async |
| Google Tag Manager | defer |
| Social Widgets | Lazy Load |
| Chat Widgets | Lazy Load |

```html
<!-- Async/Defer Pattern -->
<script async src="https://www.googletagmanager.com/gtag/js"></script>
<script>
  // Inline critical gtag config
</script>
```

---

## CSS-Optimierung

### Aktueller Stand

- Methodik: CSS-in-JS oder Extracted CSS
- Critical CSS: Nicht explizit
- Unused CSS: Vorhanden

### Empfehlungen

#### 1. Critical CSS

```html
<head>
  <style>
    /* Inline Critical CSS */
    .hero { ... }
    .nav { ... }
  </style>
  <link rel="preload" href="/styles.css" as="style" onload="this.rel='stylesheet'">
</head>
```

#### 2. PurgeCSS

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('@fullhuman/postcss-purgecss')({
      content: ['./templates/**/*.twig', './js/**/*.js'],
      safelist: ['active', 'open', /^swiper/]
    })
  ]
}
```

---

## Font-Optimierung

### Aktueller Stand

- Custom Fonts: Ja
- Font Display: swap
- Preload: Teilweise

### Empfehlungen

```html
<!-- Font Preload -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

<!-- Font Display -->
<style>
@font-face {
  font-family: 'VfL Font';
  src: url('/fonts/main.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0000-00FF;
}
</style>
```

### Font Subsetting

```bash
# Nur benötigte Zeichen extrahieren
pyftsubset font.ttf \
  --unicodes="U+0000-00FF,U+00C4,U+00D6,U+00DC,U+00E4,U+00F6,U+00FC,U+00DF" \
  --output-file=font-subset.woff2 \
  --flavor=woff2
```

---

## Caching-Strategie

### HTTP Cache Headers

| Asset-Typ | Cache-Control | Max-Age |
|-----------|---------------|---------|
| HTML | no-cache | - |
| CSS (hashed) | public, immutable | 1 year |
| JS (hashed) | public, immutable | 1 year |
| Images | public | 1 month |
| Fonts | public | 1 year |

```nginx
# Nginx Configuration
location ~* \.(css|js)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location ~* \.(jpg|jpeg|png|webp|avif|gif|svg)$ {
  add_header Cache-Control "public, max-age=2592000";
}
```

### Service Worker (Optional)

```javascript
// sw.js - Cache Strategy
const CACHE_NAME = 'vfl-v1';
const STATIC_ASSETS = ['/css/main.css', '/js/app.js', '/fonts/main.woff2'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});
```

---

## Drupal-spezifische Optimierungen

### Core Settings

```php
// settings.php
$config['system.performance']['css']['preprocess'] = TRUE;
$config['system.performance']['js']['preprocess'] = TRUE;
$config['system.performance']['css']['gzip'] = TRUE;
$config['system.performance']['js']['gzip'] = TRUE;
```

### Module

| Modul | Funktion |
|-------|----------|
| Advagg | Advanced CSS/JS Aggregation |
| Image Optimize | Automatic Image Compression |
| Responsive Image | Responsive Image Sets |
| Lazy | Lazy Loading for Images |
