# WCAG 2.1 Audit

## Prüfumfang

| Kriterium | Level | Geprüft |
|-----------|-------|---------|
| Perceivable | A, AA | ✅ |
| Operable | A, AA | ✅ |
| Understandable | A, AA | ✅ |
| Robust | A, AA | ✅ |

## 1. Perceivable (Wahrnehmbar)

### 1.1 Text Alternatives

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 1.1.1 Non-text Content | A | ⚠️ | Alt-Texte teilweise fehlend |

**Befunde:**
- Hero-Images: Alt-Texte vorhanden
- News-Thumbnails: Alt-Texte vorhanden
- Spieler-Fotos: Alt-Texte vorhanden
- Partner-Logos: Teilweise fehlend
- Dekorative Bilder: Nicht als solche markiert

### 1.2 Time-based Media

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 1.2.1 Audio-only, Video-only | A | ⚠️ | Keine Transkripte |
| 1.2.2 Captions | A | ❌ | Keine Untertitel |
| 1.2.3 Audio Description | A | ❌ | Nicht vorhanden |
| 1.2.5 Audio Description (Extended) | AA | ❌ | Nicht vorhanden |

**Befunde:**
- 1848TV Videos ohne Untertitel
- Keine Transkripte für Pressekonferenzen

### 1.3 Adaptable

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 1.3.1 Info and Relationships | A | ⚠️ | Formular-Labels optimierbar |
| 1.3.2 Meaningful Sequence | A | ✅ | OK |
| 1.3.3 Sensory Characteristics | A | ✅ | OK |
| 1.3.4 Orientation | AA | ✅ | OK |
| 1.3.5 Identify Input Purpose | AA | ⚠️ | autocomplete fehlt |

### 1.4 Distinguishable

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 1.4.1 Use of Color | A | ⚠️ | Einige Links nur farblich |
| 1.4.2 Audio Control | A | ✅ | OK |
| 1.4.3 Contrast (Minimum) | AA | ⚠️ | 4 Stellen problematisch |
| 1.4.4 Resize Text | AA | ✅ | OK |
| 1.4.5 Images of Text | AA | ✅ | OK |
| 1.4.10 Reflow | AA | ✅ | OK |
| 1.4.11 Non-text Contrast | AA | ⚠️ | Einige Icons |
| 1.4.12 Text Spacing | AA | ✅ | OK |
| 1.4.13 Content on Hover | AA | ⚠️ | Dropdowns |

---

## 2. Operable (Bedienbar)

### 2.1 Keyboard Accessible

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 2.1.1 Keyboard | A | ⚠️ | Slider nicht erreichbar |
| 2.1.2 No Keyboard Trap | A | ✅ | OK |
| 2.1.4 Character Key Shortcuts | A | ✅ | OK |

**Befunde:**
- Carousel-Navigation nur mit Maus
- Modal-Dialoge: Fokus-Trapping fehlt
- Mega-Menu: Keyboard-Navigation unvollständig

### 2.2 Enough Time

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 2.2.1 Timing Adjustable | A | ⚠️ | Autoplay Slider |
| 2.2.2 Pause, Stop, Hide | A | ⚠️ | Slider-Pause fehlt |

### 2.3 Seizures and Physical Reactions

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 2.3.1 Three Flashes | A | ✅ | OK |

### 2.4 Navigable

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 2.4.1 Bypass Blocks | A | ❌ | Skip-Link fehlt |
| 2.4.2 Page Titled | A | ✅ | OK |
| 2.4.3 Focus Order | A | ⚠️ | Teilweise |
| 2.4.4 Link Purpose | A | ⚠️ | "Mehr lesen" |
| 2.4.5 Multiple Ways | AA | ✅ | OK |
| 2.4.6 Headings and Labels | AA | ✅ | OK |
| 2.4.7 Focus Visible | AA | ⚠️ | Schwache Indikatoren |

### 2.5 Input Modalities

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 2.5.1 Pointer Gestures | A | ✅ | OK |
| 2.5.2 Pointer Cancellation | A | ✅ | OK |
| 2.5.3 Label in Name | A | ✅ | OK |
| 2.5.4 Motion Actuation | A | ✅ | OK |

---

## 3. Understandable (Verständlich)

### 3.1 Readable

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 3.1.1 Language of Page | A | ⚠️ | lang="de" prüfen |
| 3.1.2 Language of Parts | AA | ✅ | OK |

### 3.2 Predictable

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 3.2.1 On Focus | A | ✅ | OK |
| 3.2.2 On Input | A | ✅ | OK |
| 3.2.3 Consistent Navigation | AA | ✅ | OK |
| 3.2.4 Consistent Identification | AA | ✅ | OK |

### 3.3 Input Assistance

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 3.3.1 Error Identification | A | ⚠️ | Formulare |
| 3.3.2 Labels or Instructions | A | ⚠️ | Suchfeld |
| 3.3.3 Error Suggestion | AA | ⚠️ | Formulare |
| 3.3.4 Error Prevention | AA | ✅ | OK |

---

## 4. Robust (Robust)

### 4.1 Compatible

| Kriterium | Level | Status | Notizen |
|-----------|-------|--------|---------|
| 4.1.1 Parsing | A | ✅ | OK (HTML5) |
| 4.1.2 Name, Role, Value | A | ⚠️ | ARIA unvollständig |
| 4.1.3 Status Messages | AA | ⚠️ | Live Regions fehlen |

---

## Zusammenfassung

| Level | Erfüllt | Teilweise | Nicht erfüllt |
|-------|---------|-----------|---------------|
| A | 18 | 10 | 2 |
| AA | 10 | 6 | 2 |

**Gesamtbewertung:** Partial WCAG 2.1 Level A
