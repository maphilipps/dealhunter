# Navigation

## Übersicht

| Navigation | Typ | Beschreibung |
|------------|-----|--------------|
| Main Menu | Mega Menu | Multi-level Desktop-Navigation |
| Burger Menu | Mobile | Vollbild-Overlay Navigation |
| Footer Menu | Links | Footer-Links |
| Utility Menu | Icons | Suche, Shop, Tickets |
| Sticky Nav | Behavior | Fixierte Navigation beim Scrollen |

## Main Navigation (Desktop)

### Mega-Menu Struktur

```
├── Verein
│   ├── Der VfL
│   ├── Geschichte
│   ├── Satzung & Ordnungen
│   ├── Gremien
│   └── ...
├── Profis
│   ├── Kader
│   ├── Trainer
│   └── Spielplan
├── Frauen
│   └── ...
├── Talentwerk
│   └── ...
├── Stadion
│   └── ...
├── Fans
│   └── ...
├── 1848TV
├── News
├── Termine
├── Netzwerk
└── Jobs
```

### Mega-Menu Features

- **Dropdown-Panels:** Große Panels mit mehreren Spalten
- **Featured Content:** Hervorgehobene Inhalte im Menu
- **Quick Links:** Wichtige Links prominent platziert
- **Icons:** Visuelle Unterstützung für Kategorien

### Drupal-Implementierung

| Komponente | Lösung |
|------------|--------|
| Menu System | Core Menu |
| Mega-Menu | We Megamenu oder Custom Twig |
| Menu Block | Menu Block Modul |

**Custom Template Approach (empfohlen):**
```twig
{# templates/navigation/menu--main.html.twig #}
<nav class="main-navigation">
  {% for item in items %}
    <div class="nav-item {{ item.below ? 'has-children' : '' }}">
      {{ link(item.title, item.url) }}
      {% if item.below %}
        <div class="mega-menu-panel">
          {% include '@theme/navigation/mega-panel.html.twig' %}
        </div>
      {% endif %}
    </div>
  {% endfor %}
</nav>
```

---

## Mobile Navigation (Burger)

### Features

- **Burger Icon:** Animiertes Hamburger-Icon
- **Fullscreen Overlay:** Volle Bildschirmhöhe
- **Accordion:** Aufklappbare Untermenüs
- **Touch-optimiert:** Große Tap-Targets

### Implementierung

```twig
{# templates/navigation/mobile-menu.html.twig #}
<div class="mobile-menu" x-data="{ open: false }">
  <button @click="open = !open" class="burger-btn">
    <span></span>
  </button>
  <div class="menu-overlay" x-show="open" x-transition>
    {% include '@theme/navigation/mobile-items.html.twig' %}
  </div>
</div>
```

---

## Sticky Navigation

### Verhalten

1. **Initial:** Navigation am oberen Rand
2. **Scroll Down:** Navigation versteckt sich
3. **Scroll Up:** Navigation erscheint als Sticky
4. **Kompakt-Modus:** Reduzierte Höhe im Sticky-State

### CSS/JS Implementierung

```css
.site-header {
  position: fixed;
  top: 0;
  width: 100%;
  transition: transform 0.3s ease;
}

.site-header.hidden {
  transform: translateY(-100%);
}

.site-header.sticky {
  background: rgba(0, 0, 0, 0.95);
  padding: 0.5rem 0;
}
```

```js
// Scroll direction detection
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  const header = document.querySelector('.site-header');

  if (currentScroll > lastScroll && currentScroll > 100) {
    header.classList.add('hidden');
  } else {
    header.classList.remove('hidden');
    header.classList.toggle('sticky', currentScroll > 50);
  }
  lastScroll = currentScroll;
});
```

---

## Footer Navigation

### Struktur

```
├── Sitemap
│   ├── Verein
│   ├── Profis
│   ├── Stadion
│   └── Fans
├── Service
│   ├── Kontakt
│   ├── Newsletter
│   └── Jobs
├── Legal
│   ├── Impressum
│   ├── Datenschutz
│   └── AGB
└── Social Media
    ├── Facebook
    ├── Instagram
    ├── Twitter
    ├── YouTube
    └── TikTok
```

### Drupal-Menus

| Menu | Machine Name |
|------|--------------|
| Footer Sitemap | footer_sitemap |
| Footer Service | footer_service |
| Footer Legal | footer_legal |
| Social Media | social_media |

---

## Utility Navigation

### Elemente

| Element | Funktion | Icon |
|---------|----------|------|
| Suche | Suchfeld öffnen | 🔍 |
| Shop | Link zu shop.vfl-bochum.de | 🛒 |
| Tickets | Link zu tickets.vfl-bochum.de | 🎫 |
| Login | Mitgliederbereich (optional) | 👤 |

---

## Breadcrumbs

### Implementierung

```twig
{# templates/navigation/breadcrumb.html.twig #}
<nav aria-label="Breadcrumb" class="breadcrumb">
  <ol itemscope itemtype="https://schema.org/BreadcrumbList">
    {% for item in breadcrumb %}
      <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
        {% if item.url %}
          <a itemprop="item" href="{{ item.url }}">
            <span itemprop="name">{{ item.text }}</span>
          </a>
        {% else %}
          <span itemprop="name">{{ item.text }}</span>
        {% endif %}
        <meta itemprop="position" content="{{ loop.index }}" />
      </li>
    {% endfor %}
  </ol>
</nav>
```

---

## Aufwand

| Komponente | Stunden |
|------------|---------|
| Mega-Menu (Desktop) | 12h |
| Mobile Navigation | 8h |
| Footer Navigation | 4h |
| Utility Navigation | 4h |
| Sticky Behavior | 4h |
| Breadcrumbs | 2h |
| **Gesamt** | **34h** |
