# Core Web Vitals

## Übersicht

| Metrik | Aktuell | Ziel | Status |
|--------|---------|------|--------|
| **LCP** | ~2-3s | < 2.5s | ⚠️ |
| **FID/INP** | TBD | < 100ms | - |
| **CLS** | < 0.1 | < 0.1 | ✅ |
| **TTFB** | 172ms | < 200ms | ✅ |

## Largest Contentful Paint (LCP)

### Was wird gemessen?
Die Zeit bis das größte sichtbare Element (meist Hero-Image) gerendert ist.

### Aktuelle Situation

**LCP-Element:** Hero-Image auf der Homepage

**Faktoren:**
- Hero-Image-Größe
- JSON-Payload im HTML
- Font-Loading
- Third-Party Scripts

### Optimierungen

| Maßnahme | Impact | Aufwand |
|----------|--------|---------|
| Preload Hero Image | Hoch | Niedrig |
| Responsive Images | Hoch | Mittel |
| WebP/AVIF Format | Mittel | Niedrig |
| Font Preload | Mittel | Niedrig |
| Reduce JSON Payload | Hoch | Mittel |

```html
<!-- Preload Critical Image -->
<link rel="preload" as="image" href="/hero.webp"
      imagesrcset="/hero-400.webp 400w, /hero-800.webp 800w, /hero-1600.webp 1600w"
      imagesizes="100vw">
```

---

## First Input Delay (FID) / Interaction to Next Paint (INP)

### Was wird gemessen?
Die Zeit von der ersten Benutzerinteraktion bis zur Reaktion des Browsers.

### Faktoren

- JavaScript-Bundle-Größe
- Third-Party Scripts
- Main Thread Blocking

### Optimierungen

| Maßnahme | Impact | Aufwand |
|----------|--------|---------|
| Code Splitting | Hoch | Mittel |
| Defer Non-Critical JS | Hoch | Niedrig |
| Reduce Third-Party | Mittel | Niedrig |
| Web Workers | Mittel | Hoch |

---

## Cumulative Layout Shift (CLS)

### Was wird gemessen?
Visuelle Stabilität - wie viel sich das Layout während des Ladens verschiebt.

### Aktuelle Situation

**Status:** ✅ Gut (< 0.1)

SSR/SSG sorgt für stabiles Initial Layout.

### Best Practices beibehalten

```css
/* Aspect Ratio für Images */
img {
  aspect-ratio: 16 / 9;
  width: 100%;
  height: auto;
}

/* Font Display Swap */
@font-face {
  font-family: 'CustomFont';
  font-display: swap;
  src: url('/fonts/custom.woff2') format('woff2');
}

/* Skeleton Loading */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## Time to First Byte (TTFB)

### Was wird gemessen?
Die Zeit bis der erste Byte vom Server empfangen wird.

### Aktuelle Situation

**Wert:** 172ms
**Status:** ✅ Ausgezeichnet

### Faktoren

- Server-Konfiguration (Nginx)
- Caching (CDN, Page Cache)
- Database Queries
- Application Logic

### Drupal-Optimierungen

```php
// settings.php - Cache Settings
$settings['cache']['bins']['render'] = 'cache.backend.redis';
$settings['cache']['bins']['page'] = 'cache.backend.redis';
$settings['cache']['bins']['dynamic_page_cache'] = 'cache.backend.redis';

// Enable Page Cache for Anonymous
$config['system.performance']['cache']['page']['max_age'] = 3600;
```

---

## Performance Budget

### Empfohlenes Budget

| Ressource | Budget | Aktuell |
|-----------|--------|---------|
| HTML | < 100 KB | ~50 KB |
| CSS | < 100 KB | ~80 KB |
| JavaScript | < 300 KB | ~400 KB |
| Images | < 500 KB | ~600 KB |
| Fonts | < 100 KB | ~50 KB |
| **Total** | **< 1 MB** | **~1.17 MB** |

### Monitoring

```javascript
// Performance Observer
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      console.log('LCP:', entry.startTime);
    }
  }
});
observer.observe({ type: 'largest-contentful-paint', buffered: true });
```

---

## Tools für Messung

| Tool | Zweck |
|------|-------|
| PageSpeed Insights | Google's Official Tool |
| WebPageTest | Detailed Waterfall |
| Chrome DevTools | Local Testing |
| Lighthouse | Comprehensive Audit |
| CrUX Dashboard | Real User Data |
