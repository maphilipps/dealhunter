# Baseline Comparison

## adessoCMS Baseline

Das adessoCMS Drupal 11 Projekt dient als Referenz-Baseline:

| Metrik | adessoCMS | VfL Bochum |
|--------|-----------|------------|
| Content Types | 6 | 9 |
| Paragraph Types | 32 | 18 |
| Views | 27 | 9 |
| Config Files | 1,136 | ~700 (geschätzt) |
| **Total Effort** | **693h** | **2,168h** |

## Scale Factor

```
VfL Scale = VfL Entities / Baseline Entities

Content Types:  9 / 6 = 1.5x
Paragraphs:    18 / 32 = 0.56x
Views:         9 / 27 = 0.33x
Config:       700 / 1,136 = 0.62x

Durchschnitt: ~0.75x
```

## Abweichungs-Analyse

### Warum ist VfL 3x so aufwändig?

| Faktor | Baseline | VfL | Delta |
|--------|----------|-----|-------|
| **Custom Modules** | ~50h | 138h | +88h |
| **Integrationen** | Niedrig | Hoch | +200h |
| **Migration** | Keine | 230h | +230h |
| **Multipliers** | ~150h | 736h | +586h |

### Haupttreiber

1. **Custom Integrations (+50%)**
   - Sportdaten-API (70h)
   - 1848TV Integration (28h)
   - Salesforce (28h)

2. **Migration (+230h)**
   - Kein Standard-Export
   - Komplexe Datenstruktur
   - 1.000+ Nodes

3. **Accessibility (+20%)**
   - WCAG 2.1 AA Compliance
   - Remediation erforderlich

## Validierung

### Bottom-Up vs. Baseline

| Methode | Stunden |
|---------|---------|
| Bottom-Up | 2,168h |
| Baseline-Skaliert | ~700h × 1.5 = 1,050h |
| **Differenz** | **1,118h** |

### Erklärung der Differenz

Die Differenz von ~1,100h erklärt sich durch:

| Faktor | Stunden | Erklärung |
|--------|---------|-----------|
| Migration | 230h | Baseline hatte keine Migration |
| Integrations | 300h | Mehr externe Systeme |
| Buffer | 361h | Höheres Risiko |
| Testing/QA | 190h | Strengere Anforderungen |
| **Total** | **1,081h** | |

## Benchmark-Vergleich

### Ähnliche Projekte (Erfahrungswerte)

| Projekt-Typ | Stunden |
|-------------|---------|
| Einfache Corporate Site | 400-600h |
| Mittelgroße Site | 800-1,200h |
| **Komplexe Site mit Integrationen** | **1,500-2,500h** |
| Enterprise CMS Relaunch | 3,000-5,000h |

**VfL Bochum (2,168h):** Im oberen Bereich für komplexe Sites, gerechtfertigt durch Integrationen und Migration.

## Empfehlung

| Aspekt | Empfehlung |
|--------|------------|
| **Primärer Schätzer** | Bottom-Up (2,168h) |
| **Validierung** | Baseline zeigt Abweichung ist begründet |
| **Kommunikation** | Range: 1,800h - 2,500h |
| **Budget-Planung** | 2,200h (konservativ) |

## Optimierungs-Potentiale

Falls Budget reduziert werden muss:

| Maßnahme | Einsparung | Impact |
|----------|------------|--------|
| Weniger Paragraphs | ~30h | Flexibilität ↓ |
| Einfachere Migration | ~50h | Qualität ↓ |
| Reduzierte Integrationen | ~50h | Features ↓ |
| Weniger Testing | ~50h | Risiko ↑ |
| **Maximal möglich** | **~180h** | |

::: warning
Nicht empfohlen: Reduktion bei Security, Accessibility oder Core-Features.
:::
