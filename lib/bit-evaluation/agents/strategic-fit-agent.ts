import { strategicFitSchema, type StrategicFit } from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';
import { generateStructuredOutput } from '@/lib/ai/config';
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

export interface StrategicFitAgentInput {
  extractedRequirements: any;
  qualificationScanResults?: any;
  useWebSearch?: boolean;
}

export async function runStrategicFitAgent(input: StrategicFitAgentInput): Promise<StrategicFit> {
  let customerInsights = '';
  let industryInsights = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Strategic Researcher' });

    try {
      const customerName =
        input.extractedRequirements?.customerName ||
        input.qualificationScanResults?.companyIntelligence?.basicInfo?.name;
      const industry =
        input.qualificationScanResults?.companyIntelligence?.basicInfo?.industry ||
        input.extractedRequirements?.industry;

      if (customerName) {
        const customerSearch = await intelligentTools.webSearch(
          `"${customerName}" Unternehmen Mitarbeiter Umsatz digital transformation`,
          3
        );

        if (customerSearch && customerSearch.length > 0) {
          const rawCustData = customerSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          customerInsights = `\n\n### Kunden-Intelligence\n${wrapUserContent(rawCustData, 'web')}`;
          console.log(`[Strategic Fit Agent] ${customerSearch.length} Kunden-Insights gefunden`);
        }
      }

      if (industry) {
        const industrySearch = await intelligentTools.webSearch(
          `${industry} digital transformation trends Germany 2024`,
          3
        );

        if (industrySearch && industrySearch.length > 0) {
          const rawIndData = industrySearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          industryInsights = `\n\n### Branchen-Trends\n${wrapUserContent(rawIndData, 'web')}`;
          console.log(`[Strategic Fit Agent] ${industrySearch.length} Branchen-Insights gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Strategic Fit Agent] Research fehlgeschlagen:', error);
    }
  }

  const systemPrompt = `Du bist ein Strategic Business Assessor bei adesso SE.

## Deine Aufgabe
Bewerte, wie gut diese Opportunity zur strategischen Ausrichtung und dem Zielkundenprofil von adesso passt.

## adesso Zielkundenprofil

### Kundentypen (nach Priorität)
1. **BEST FIT**: DAX/MDAX Unternehmen (1000+ MA)
2. **GOOD FIT**: Mittelstand (250-1000 MA)
3. **GOOD FIT**: Öffentlicher Sektor Deutschland
4. **LOW FIT**: Startups/KMU (außer strategisch wichtig)

### Zielbranchen (nach Priorität)
1. Banking & Financial Services (Kernkompetenz)
2. Insurance (Kernkompetenz)
3. Automotive (starke Präsenz)
4. Energy & Utilities (wachsend)
5. Retail & E-Commerce (etabliert)
6. Public Sector (stark in DE)
7. Healthcare (wachsend)
8. Manufacturing & Industry 4.0
9. Telecommunications

### Strategische Prioritäten
- Digital Transformation Projekte
- Cloud Migration & Modernisierung
- Drupal CMS (Marktführer in DE)
- Enterprise Architecture & Integration
- Data & Analytics / AI

### Strategischer Wert
- **Referenzprojekt-Potenzial**: Gut für Marketing
- **Neuer Markt**: Öffnet Türen zu neuen Branchen
- **Beziehungsausbau**: Vertieft bestehende Kundenbeziehung
- **Technologie-Leadership**: Positioniert uns als Innovator
- **Recurring Revenue**: Potential für Managed Services

## Ausgabesprache
Alle Texte auf Deutsch.`;

  const userPrompt = `Bewerte die strategische Passung dieser Opportunity.

## Extrahierte Anforderungen
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.qualificationScanResults
    ? `## Qualification Scan Ergebnisse
${JSON.stringify(input.qualificationScanResults, null, 2)}`
    : ''
}
${customerInsights}
${industryInsights}

## Deine Bewertung
Analysiere und bewerte:
1. Kundentyp-Analyse (customerTypeAssessment)
2. Branchen-Alignment (industryAlignment)
3. Strategischer Wert (strategicValue)
4. Gesamtbewertung (overallStrategicFitScore, confidence, reasoning, criticalBlockers)`;

  return generateStructuredOutput({
    model: 'quality',
    schema: strategicFitSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
}
