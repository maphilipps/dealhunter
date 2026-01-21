# Accessibility Issues

## Kritische Issues

### Issue #1: Fehlende Skip-Links

**WCAG:** 2.4.1 Bypass Blocks (Level A)

**Beschreibung:**
Es gibt keine Möglichkeit, die Hauptnavigation zu überspringen und direkt zum Hauptinhalt zu gelangen.

**Betroffene Nutzer:**
- Screenreader-Nutzer
- Tastatur-Nutzer

**Lösung:**
```html
<body>
  <a href="#main-content" class="skip-link">
    Zum Hauptinhalt springen
  </a>
  <!-- Navigation -->
  <main id="main-content" tabindex="-1">
    <!-- Content -->
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  padding: 1rem;
  background: #000;
  color: #fff;
  z-index: 9999;
}

.skip-link:focus {
  top: 0;
}
```

**Aufwand:** 2h

---

### Issue #2: Unzureichender Farbkontrast

**WCAG:** 1.4.3 Contrast Minimum (Level AA)

**Beschreibung:**
Einige Textelemente haben einen Kontrast unter 4.5:1.

**Betroffene Stellen:**
| Element | Vordergrund | Hintergrund | Ratio | Erforderlich |
|---------|-------------|-------------|-------|--------------|
| Datum-Label | #999 | #fff | 2.8:1 | 4.5:1 |
| Placeholder | #aaa | #f5f5f5 | 2.3:1 | 4.5:1 |
| Disabled Button | #ccc | #eee | 1.6:1 | 3:1 |

**Lösung:**
```css
/* Datum-Label */
.date-label {
  color: #595959; /* 7:1 */
}

/* Placeholder */
input::placeholder {
  color: #666; /* 5.7:1 */
}
```

**Aufwand:** 4h

---

### Issue #3: Fehlende ARIA-Labels

**WCAG:** 4.1.2 Name, Role, Value (Level A)

**Beschreibung:**
Interaktive Elemente wie Icon-Buttons haben keine zugänglichen Namen.

**Betroffene Elemente:**
- Burger-Menu Button
- Slider-Navigation (vor/zurück)
- Social Media Links
- Suchbutton

**Lösung:**
```html
<!-- Burger Menu -->
<button aria-label="Hauptmenü öffnen" aria-expanded="false">
  <span class="burger-icon"></span>
</button>

<!-- Slider -->
<button aria-label="Vorheriger Slide" class="slider-prev">
  <svg>...</svg>
</button>

<!-- Social -->
<a href="..." aria-label="VfL Bochum auf Facebook">
  <svg>...</svg>
</a>
```

**Aufwand:** 4h

---

## Schwerwiegende Issues

### Issue #4: Slider nicht per Tastatur bedienbar

**WCAG:** 2.1.1 Keyboard (Level A)

**Beschreibung:**
Die Carousel/Slider-Komponenten sind nicht vollständig per Tastatur bedienbar.

**Probleme:**
- Navigation-Buttons nicht fokussierbar
- Keine Tastatursteuerung für Slides
- Kein Stoppen des Autoplay per Tastatur

**Lösung:**
```html
<div class="carousel" role="region" aria-label="News Slider" aria-roledescription="carousel">
  <button class="carousel-prev" aria-label="Vorheriger Slide">←</button>
  <button class="carousel-next" aria-label="Nächster Slide">→</button>
  <button class="carousel-pause" aria-label="Autoplay pausieren">⏸</button>

  <div class="carousel-slides" aria-live="off">
    <div role="group" aria-roledescription="slide" aria-label="1 von 5">
      <!-- Slide content -->
    </div>
  </div>
</div>
```

**Aufwand:** 8h

---

### Issue #5: Schwache Fokus-Indikatoren

**WCAG:** 2.4.7 Focus Visible (Level AA)

**Beschreibung:**
Die Standard-Fokusindikatoren sind kaum sichtbar oder wurden entfernt.

**Lösung:**
```css
/* Globale Fokus-Styles */
:focus-visible {
  outline: 3px solid #006EC7;
  outline-offset: 2px;
}

/* Für dunkle Hintergründe */
.dark-bg :focus-visible {
  outline-color: #fff;
}

/* Buttons */
button:focus-visible {
  box-shadow: 0 0 0 3px rgba(0, 110, 199, 0.5);
}
```

**Aufwand:** 4h

---

### Issue #6: Formular-Fehlerbehandlung

**WCAG:** 3.3.1 Error Identification (Level A)

**Beschreibung:**
Fehler in Formularen werden nicht zugänglich kommuniziert.

**Probleme:**
- Keine programmatische Verknüpfung zu Fehlermeldungen
- Fehler nicht per Screenreader angekündigt
- Keine Focus-Verschiebung zum ersten Fehler

**Lösung:**
```html
<label for="email">E-Mail</label>
<input
  id="email"
  type="email"
  aria-describedby="email-error"
  aria-invalid="true"
>
<span id="email-error" role="alert">
  Bitte geben Sie eine gültige E-Mail-Adresse ein.
</span>
```

**Aufwand:** 6h

---

## Moderate Issues

### Issue #7: Unspezifische Link-Texte

**WCAG:** 2.4.4 Link Purpose (Level A)

**Beschreibung:**
Links wie "Mehr lesen" oder "Hier klicken" geben ohne Kontext keinen Aufschluss über das Ziel.

**Lösung:**
```html
<!-- Option 1: Visually Hidden Text -->
<a href="/news/artikel">
  Mehr lesen
  <span class="visually-hidden">über Spielbericht VfL vs. Bayern</span>
</a>

<!-- Option 2: aria-label -->
<a href="/news/artikel" aria-label="Mehr lesen über Spielbericht VfL vs. Bayern">
  Mehr lesen
</a>
```

**Aufwand:** 4h

---

### Issue #8: Autoplay-Slider ohne Pause

**WCAG:** 2.2.2 Pause, Stop, Hide (Level A)

**Beschreibung:**
Automatisch wechselnde Slider können nicht pausiert werden.

**Lösung:**
```html
<button
  class="carousel-pause"
  aria-label="Autoplay pausieren"
  aria-pressed="false"
>
  ⏸
</button>
```

**Aufwand:** 2h

---

### Issue #9: Fehlende Live-Regions

**WCAG:** 4.1.3 Status Messages (Level AA)

**Beschreibung:**
Dynamisch aktualisierte Inhalte werden nicht an Screenreader kommuniziert.

**Betroffene Bereiche:**
- Suchergebnisse
- Formular-Erfolg/Fehler
- Warenkorb-Updates
- Liveticker

**Lösung:**
```html
<div aria-live="polite" aria-atomic="true" class="visually-hidden">
  5 Suchergebnisse gefunden
</div>
```

**Aufwand:** 4h

---

## Aufwands-Übersicht

| Issue | Priorität | Aufwand |
|-------|-----------|---------|
| #1 Skip-Links | Kritisch | 2h |
| #2 Kontrast | Kritisch | 4h |
| #3 ARIA-Labels | Kritisch | 4h |
| #4 Slider Keyboard | Hoch | 8h |
| #5 Fokus-Indikatoren | Hoch | 4h |
| #6 Formular-Fehler | Hoch | 6h |
| #7 Link-Texte | Mittel | 4h |
| #8 Autoplay-Pause | Mittel | 2h |
| #9 Live-Regions | Mittel | 4h |
| **Gesamt** | | **38h** |

*Plus Testing: ~16h*
*Plus Audit: ~8h*
**Gesamt: ~62h**
