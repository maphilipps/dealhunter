# Performance Recommendations

## Prioritäten-Matrix

| Empfehlung | Impact | Aufwand | Priorität |
|------------|--------|---------|-----------|
| Image WebP/AVIF | Hoch | Niedrig | 🔴 Hoch |
| Lazy Loading | Hoch | Niedrig | 🔴 Hoch |
| JS Code Splitting | Hoch | Mittel | 🔴 Hoch |
| Critical CSS | Mittel | Mittel | 🟡 Mittel |
| Font Subsetting | Niedrig | Niedrig | 🟢 Niedrig |
| Service Worker | Niedrig | Hoch | 🟢 Niedrig |

## Sofort umsetzbar (Quick Wins)

### 1. Responsive Images mit WebP

**Impact:** ~30% Bildgröße-Reduktion

```php
// Drupal: Responsive Image Style
// Konfiguration in: admin/config/media/responsive-image-style

// Image Style: hero_webp
// Effect: Convert to WebP
// Effect: Scale and Crop (1920x800)
```

### 2. Native Lazy Loading

**Impact:** Reduzierte Initial Load

```twig
{# In Twig Templates #}
<img src="{{ file_url(image.uri) }}"
     alt="{{ image.alt }}"
     loading="lazy"
     decoding="async">
```

### 3. Preload Critical Assets

**Impact:** Schnellere LCP

```twig
{# In html.html.twig #}
<link rel="preload" href="{{ theme_path }}/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{{ hero_image_url }}" as="image">
```

---

## Mittelfristig umsetzen

### 4. JavaScript Optimization

**Aufwand:** 16-24h

**Maßnahmen:**
- Third-Party Scripts verzögert laden
- Inline Critical JS
- Async/Defer für non-critical

```html
<!-- GTM Lazy Load -->
<script>
  window.addEventListener('load', function() {
    setTimeout(function() {
      var script = document.createElement('script');
      script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-XXXX';
      document.head.appendChild(script);
    }, 2000);
  });
</script>
```

### 5. Critical CSS Extraction

**Aufwand:** 8-12h

```bash
# Critical CSS Tool
npm install -g critical

critical src/index.html --base dist/ --inline --minify > dist/index-critical.html
```

### 6. CDN-Optimierung

**Aufwand:** 4-8h

| Setting | Empfehlung |
|---------|-----------|
| Edge Caching | Aktivieren |
| Brotli Compression | Aktivieren |
| HTTP/2 | Sicherstellen |
| Image Optimization | CDN-seitig |

---

## Drupal-spezifische Optimierungen

### BigPipe aktivieren

```php
// BigPipe ist in Drupal Core enthalten
// Aktivieren: drush en big_pipe
```

**Vorteile:**
- Streaming von Inhalten
- Placeholders für personalisierte Inhalte
- Bessere TTFB für gecachte Seiten

### Cache Tags Strategie

```php
// Custom Block mit Cache Tags
public function build() {
  return [
    '#markup' => $this->getContent(),
    '#cache' => [
      'tags' => ['node_list:news', 'config:block.block.news_block'],
      'contexts' => ['url.path', 'user.roles'],
      'max-age' => 300, // 5 minutes
    ],
  ];
}
```

### Redis/Memcached

```php
// settings.php
$settings['cache']['default'] = 'cache.backend.redis';
$settings['redis.connection']['host'] = 'redis';
$settings['redis.connection']['port'] = 6379;
```

---

## Performance-Budget einhalten

### Monitoring Setup

```javascript
// Real User Monitoring
if ('PerformanceObserver' in window) {
  // LCP
  new PerformanceObserver((list) => {
    const entry = list.getEntries().at(-1);
    gtag('event', 'web_vitals', {
      metric_name: 'LCP',
      metric_value: entry.startTime
    });
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // CLS
  new PerformanceObserver((list) => {
    let clsValue = 0;
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) clsValue += entry.value;
    }
    gtag('event', 'web_vitals', {
      metric_name: 'CLS',
      metric_value: clsValue
    });
  }).observe({ type: 'layout-shift', buffered: true });
}
```

### CI/CD Integration

```yaml
# .gitlab-ci.yml
lighthouse:
  stage: test
  script:
    - npm install -g @lhci/cli
    - lhci autorun
  only:
    - merge_requests
```

---

## Erwartete Verbesserungen

### Vorher (BloomReach + Next.js)

| Metrik | Wert |
|--------|------|
| Page Size | 1.17 MB |
| Requests | ~50 |
| LCP | ~2.5s |
| TTFB | 172ms |

### Nachher (Drupal optimiert)

| Metrik | Ziel |
|--------|------|
| Page Size | < 800 KB |
| Requests | < 30 |
| LCP | < 2.0s |
| TTFB | < 150ms |

### ROI

| Verbesserung | Business Impact |
|--------------|-----------------|
| -1s Load Time | +7% Conversion |
| < 2.5s LCP | Besseres SEO Ranking |
| < 100ms TTFB | Bessere UX |
