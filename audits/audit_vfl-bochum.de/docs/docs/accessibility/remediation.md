# Accessibility Remediation Plan

## Phasenplan

### Phase 1: Kritische Fixes (1 Woche)

| Task | Issue | Aufwand | Verantwortlich |
|------|-------|---------|----------------|
| Skip-Links implementieren | #1 | 2h | Frontend |
| Kontrast-Fixes | #2 | 4h | Design/Frontend |
| ARIA-Labels hinzufügen | #3 | 4h | Frontend |
| **Phase 1 Gesamt** | | **10h** | |

**Akzeptanzkriterien:**
- [ ] Skip-Link funktioniert auf allen Seiten
- [ ] Alle Texte haben min. 4.5:1 Kontrast
- [ ] Alle interaktiven Elemente haben zugängliche Namen

### Phase 2: Schwerwiegende Fixes (2 Wochen)

| Task | Issue | Aufwand | Verantwortlich |
|------|-------|---------|----------------|
| Slider Keyboard-Support | #4 | 8h | Frontend |
| Fokus-Indikatoren | #5 | 4h | Frontend |
| Formular-Accessibility | #6 | 6h | Frontend |
| **Phase 2 Gesamt** | | **18h** | |

**Akzeptanzkriterien:**
- [ ] Slider vollständig per Tastatur bedienbar
- [ ] Sichtbare Fokus-Indikatoren auf allen Elementen
- [ ] Formular-Fehler zugänglich kommuniziert

### Phase 3: Moderate Fixes (1 Woche)

| Task | Issue | Aufwand | Verantwortlich |
|------|-------|---------|----------------|
| Link-Texte verbessern | #7 | 4h | Content/Frontend |
| Autoplay-Pause | #8 | 2h | Frontend |
| Live-Regions | #9 | 4h | Frontend |
| **Phase 3 Gesamt** | | **10h** | |

### Phase 4: Testing & Dokumentation (1 Woche)

| Task | Aufwand |
|------|---------|
| Automatisiertes Testing (Axe, Pa11y) | 4h |
| Manuelles Testing (Tastatur, Screenreader) | 8h |
| Cross-Browser Testing | 4h |
| Dokumentation | 4h |
| **Phase 4 Gesamt** | **20h** |

---

## Technische Implementierung

### 1. Skip-Links (Drupal)

```twig
{# html.html.twig #}
<body{{ attributes.addClass(body_classes) }}>
  <a href="#main-content" class="skip-link visually-hidden focusable">
    {{ 'Skip to main content'|t }}
  </a>
  {{ page_top }}
  {{ page }}
  {{ page_bottom }}
</body>
```

```css
/* CSS */
.skip-link {
  background: var(--color-primary);
  color: white;
  padding: 0.5rem 1rem;
  position: absolute;
  left: 0;
  top: -100%;
  z-index: 9999;
}

.skip-link:focus {
  top: 0;
}
```

### 2. Fokus-Styles (Theme CSS)

```css
/* Focus Styles */
:focus {
  outline: none;
}

:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

/* Für bestimmte Elemente */
a:focus-visible {
  text-decoration: underline;
  text-underline-offset: 4px;
}

button:focus-visible,
[role="button"]:focus-visible {
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
```

### 3. Accessible Carousel (JavaScript)

```javascript
class AccessibleCarousel {
  constructor(element) {
    this.carousel = element;
    this.slides = element.querySelectorAll('[role="group"]');
    this.currentIndex = 0;
    this.isPlaying = true;

    this.init();
  }

  init() {
    this.setupAria();
    this.setupKeyboard();
    this.setupPauseButton();
  }

  setupAria() {
    this.carousel.setAttribute('aria-roledescription', 'carousel');
    this.slides.forEach((slide, i) => {
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${i + 1} von ${this.slides.length}`);
      slide.setAttribute('aria-hidden', i !== this.currentIndex);
    });
  }

  setupKeyboard() {
    this.carousel.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          this.prev();
          break;
        case 'ArrowRight':
          this.next();
          break;
        case 'Home':
          this.goTo(0);
          break;
        case 'End':
          this.goTo(this.slides.length - 1);
          break;
      }
    });
  }

  setupPauseButton() {
    const pauseBtn = this.carousel.querySelector('[aria-label*="pausieren"]');
    pauseBtn?.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      pauseBtn.setAttribute('aria-pressed', !this.isPlaying);
      pauseBtn.setAttribute('aria-label',
        this.isPlaying ? 'Autoplay pausieren' : 'Autoplay starten'
      );
    });
  }
}
```

### 4. Form Validation (Drupal/JS)

```javascript
// Accessible Form Validation
function validateForm(form) {
  const errors = [];
  const errorContainer = form.querySelector('[role="alert"]');

  // Clear previous errors
  errorContainer.innerHTML = '';

  // Validate fields
  form.querySelectorAll('[required]').forEach(field => {
    if (!field.value.trim()) {
      errors.push({
        field: field,
        message: `${field.labels[0]?.textContent || 'Feld'} ist erforderlich`
      });
    }
  });

  if (errors.length > 0) {
    // Announce errors
    errorContainer.innerHTML = `
      <h2>Es wurden ${errors.length} Fehler gefunden:</h2>
      <ul>
        ${errors.map(e => `<li><a href="#${e.field.id}">${e.message}</a></li>`).join('')}
      </ul>
    `;

    // Mark fields invalid
    errors.forEach(e => {
      e.field.setAttribute('aria-invalid', 'true');
    });

    // Focus first error
    errors[0].field.focus();

    return false;
  }

  return true;
}
```

---

## Testing-Checkliste

### Automatisiertes Testing

```bash
# Axe CLI
npm install -g @axe-core/cli
axe https://www.vfl-bochum.de --tags wcag2a,wcag2aa

# Pa11y
npm install -g pa11y
pa11y https://www.vfl-bochum.de --standard WCAG2AA
```

### Manuelles Testing

**Tastatur-Navigation:**
- [ ] Alle interaktiven Elemente erreichbar
- [ ] Fokus-Reihenfolge logisch
- [ ] Fokus sichtbar
- [ ] Keine Tastaturfallen
- [ ] Modal-Dialoge: Fokus-Trapping

**Screenreader:**
- [ ] VoiceOver (macOS/iOS)
- [ ] NVDA (Windows)
- [ ] JAWS (Windows)

**Checkliste:**
- [ ] Alle Bilder haben Alt-Text
- [ ] Formular-Labels korrekt verknüpft
- [ ] Überschriften-Hierarchie korrekt
- [ ] Links haben sinnvollen Text
- [ ] Dynamische Inhalte angekündigt

---

## KPIs & Erfolgsmessung

| Metrik | Aktuell | Ziel | Messung |
|--------|---------|------|---------|
| Axe Violations | ~25 | 0 | Automatisch |
| Pa11y Errors | ~20 | 0 | Automatisch |
| Lighthouse A11y | ~70 | 95+ | Automatisch |
| Manual Audit Pass | 60% | 100% | Manuell |

---

## Maintenance

### Ongoing Tasks

1. **Code Reviews:** Accessibility-Check bei jedem PR
2. **CI/CD Integration:** Axe Tests in Pipeline
3. **Content Guidelines:** Alt-Text Pflicht für Redakteure
4. **Schulungen:** Jährliche A11y-Trainings für Team
