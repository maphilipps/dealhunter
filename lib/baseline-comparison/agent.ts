import { generateObject } from 'ai';

import { baselineComparisonResultSchema, type BaselineComparisonResult } from './schema';

import type { ContentArchitecture } from '@/lib/deep-analysis/schemas';

/**
 * Input für den Baseline-Vergleich Agent
 */
export interface BaselineComparisonInput {
  bidId: string;
  contentArchitecture: ContentArchitecture;
  baselineEntityCounts?: Record<string, number>;
  baselineName?: string;
  baselineHours?: number;
}

/**
 * Baseline Entity Counts Struktur (aus technologies.baselineEntityCounts)
 */
interface BaselineEntityCounts {
  content_types?: number;
  paragraphs?: number;
  taxonomies?: number;
  views?: number;
  forms?: number;
  menus?: number;
  media_types?: number;
  integrations?: number;
}

/**
 * BaselineComparisonAgent
 *
 * Vergleicht die analysierte Website-Struktur mit der adesso-Baseline.
 * Kategorisiert Features in "Vorhanden" vs "Neu zu entwickeln".
 * Berechnet Baseline-Abdeckung und Stundenersparnis.
 */
export async function runBaselineComparison(
  input: BaselineComparisonInput
): Promise<BaselineComparisonResult> {
  const {
    contentArchitecture,
    baselineEntityCounts,
    baselineName = 'adessoCMS 2.0',
    baselineHours = 400,
  } = input;

  // Parse baseline entity counts if available
  const baseline: BaselineEntityCounts = baselineEntityCounts || {
    content_types: 12,
    paragraphs: 25,
    taxonomies: 8,
    views: 15,
    forms: 5,
    menus: 4,
    media_types: 6,
    integrations: 8,
  };

  // Format content architecture for AI
  const pageTypesInfo = contentArchitecture.pageTypes
    .map(pt => `- ${pt.type}: ${pt.count} Seiten`)
    .join('\n');

  const contentMappingInfo = contentArchitecture.contentTypeMapping
    .map(m => `- ${m.pageType} → ${m.drupalContentType} (Konfidenz: ${m.confidence}%)`)
    .join('\n');

  const { object } = await generateObject({
    model: 'openai/gpt-4o-mini',
    schema: baselineComparisonResultSchema,
    prompt: `Du bist ein Experte für Software-Projektschätzung bei adesso SE.

Deine Aufgabe ist es, die analysierte Anforderungsstruktur mit einer vorhandenen Baseline/Referenzimplementierung zu vergleichen - technologie-agnostisch.

## Baseline: ${baselineName}

Die Baseline enthält folgende vorkonfigurierte Komponenten:
- Content/Daten-Strukturen: ${baseline.content_types || 12}
- UI-Komponenten/Module: ${baseline.paragraphs || 25}
- Kategorisierungen/Taxonomien: ${baseline.taxonomies || 8}
- Ansichten/Listen: ${baseline.views || 15}
- Formulare: ${baseline.forms || 5}
- Navigation: ${baseline.menus || 4}
- Media-Handling: ${baseline.media_types || 6}
- Standard-Integrationen: ${baseline.integrations || 8}

Baseline-Stunden (Basis-Setup): ${baselineHours} PT

## Analysierte Anforderungen

**Erkannte Strukturen:**
${pageTypesInfo}

**Mapping zu Implementierung:**
${contentMappingInfo}

**Geschätzte Komponenten:** ${contentArchitecture.paragraphEstimate}
**Gesamtumfang:** ${contentArchitecture.totalPages} Einheiten

## Deine Aufgabe

1. **Vergleiche** jeden erkannten Anforderungs-Typ mit der Baseline - FAIR und OBJEKTIV
2. **Kategorisiere** in:
   - "availableFromBaseline": Standard-Features die wiederverwendet werden können
   - "newDevelopment": Custom-Features die neu entwickelt werden müssen
3. **Berechne** die Baseline-Abdeckung (Prozentsatz) - SEI REALISTISCH
4. **Schätze** Aufwandsersparnis durch Baseline vs. Neuentwicklung

## Kategorisierungslogik (technologie-agnostisch)

**Typische Baseline-Features (wiederverwendbar):**
- Standard-Datenstrukturen: Artikel, Seiten, News, Events, Personen, FAQ
- Standard-UI-Komponenten: Text, Bild, Galerie, CTA, Zitat, Akkordeon, Tabs
- Standard-Features: Suche, Kontaktformular, Sitemap, Breadcrumbs
- Standard-Integrationen: Analytics, Cookie-Consent, Newsletter

**Typische Neuentwicklung:**
- Branchenspezifische Strukturen (Produkte, Immobilien, Kurse, etc.)
- Komplexe Komponenten (Konfiguratoren, Rechner, Dashboards)
- Custom-Integrationen (ERP, CRM, spezifische APIs)
- Geschäftslogik und Workflows

## Stundenberechnung (FAIR)

- Baseline-Feature: 0 PT (bereits vorhanden)
- Einfaches Custom Feature: 8-16 PT
- Mittleres Custom Feature: 16-40 PT
- Komplexes Custom Feature: 40-80 PT

**WICHTIG:** Sei fair und objektiv. Überschätze die Baseline-Abdeckung NICHT.
Wenn etwas unklar ist, tendiere zur Neuentwicklung.

Antworte im vorgegebenen JSON-Schema.`,
    temperature: 0.3,
  });

  return object;
}
