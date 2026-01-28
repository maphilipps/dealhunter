import { competitionCheckSchema, type CompetitionCheck } from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';
import { generateStructuredOutput } from '@/lib/ai/config';
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

export interface CompetitionAgentInput {
  extractedRequirements: any;
  quickScanResults?: any;
  useWebSearch?: boolean;
}

export async function runCompetitionAgent(input: CompetitionAgentInput): Promise<CompetitionCheck> {
  let competitorNews = '';
  let marketInsights = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Competition Researcher' });

    try {
      const industry =
        input.quickScanResults?.companyIntelligence?.basicInfo?.industry ||
        input.extractedRequirements?.industry ||
        '';
      const customerName = input.extractedRequirements?.customerName || '';

      if (industry) {
        const marketSearch = await intelligentTools.webSearch(
          `${industry} IT consulting competitors Germany 2024 digital transformation`,
          5
        );

        if (marketSearch && marketSearch.length > 0) {
          const rawMarketData = marketSearch
            .slice(0, 3)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          marketInsights = `\n\n### Aktuelle Markt-Insights\n${wrapUserContent(rawMarketData, 'web')}`;
          console.log(`[Competition Agent] ${marketSearch.length} Markt-Insights gefunden`);
        }
      }

      if (customerName) {
        const customerSearch = await intelligentTools.webSearch(
          `"${customerName}" IT projekt ausschreibung tender 2024`,
          3
        );

        if (customerSearch && customerSearch.length > 0) {
          const rawCustomerData = customerSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          competitorNews = `\n\n### Kunden-spezifische Insights\n${wrapUserContent(rawCustomerData, 'web')}`;
          console.log(`[Competition Agent] ${customerSearch.length} Kunden-Insights gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Competition Agent] Web Search fehlgeschlagen:', error);
    }
  }

  const systemPrompt = `Du bist ein Competitive Intelligence Analyst bei adesso SE.

## Deine Aufgabe
Analysiere die Wettbewerbssituation und schätze die Gewinnwahrscheinlichkeit ein.

## adesso Wettbewerbsposition

### Stärken
- **Drupal-Marktführer**: 20+ Jahre Expertise in Deutschland
- **Branchen-Expertise**: Banking, Insurance, Automotive
- **Qualität & Zuverlässigkeit**: Komplexe Enterprise-Projekte
- **Innovation**: Digital Transformation, Cloud, AI
- **Deutschland-Fokus**: Starke Präsenz und Netzwerk
- **Größe**: Groß genug für Enterprise, agil genug für Reaktionsfähigkeit

### Typische Wettbewerber nach Segment

| Segment | Wettbewerber |
|---------|--------------|
| Global System Integrators | Accenture, Capgemini, Deloitte |
| Deutsche IT-Beratung | CGI, msg, Sopra Steria |
| Drupal-Spezialisten | Drupalize.me Partner |
| Digital Agencies | DEPT, SinnerSchrader |
| Nischen-Player | Branchenspezifische Berater |

### Gewinn-Faktoren (erhöhen Win-Probability)
1. Bestehende Kundenbeziehung
2. Incumbent-Vorteil (wir betreuen aktuelles System)
3. Technologie-Match (Drupal oder unsere Kerntechnologien)
4. Branchen-Expertise (Banking, Insurance, Auto)
5. Komplexität (hohe Komplexität bevorzugt uns)
6. Deutscher Kunde + deutsche Anforderungen

### Wettbewerbslevel
- none: Keine erkennbaren Wettbewerber
- low: 1-2 Wettbewerber, klarer Vorteil für uns
- medium: 3-5 Wettbewerber, ausgeglichenes Feld
- high: 5+ Wettbewerber, starke Konkurrenz
- very_high: Viele starke Wettbewerber, Preiskampf erwartet

## Ausgabesprache
Alle Texte auf Deutsch.`;

  const userPrompt = `Analysiere die Wettbewerbssituation für diese Opportunity.

## Extrahierte Anforderungen
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.quickScanResults
    ? `## Quick Scan Ergebnisse
${JSON.stringify(input.quickScanResults, null, 2)}`
    : ''
}
${marketInsights}
${competitorNews}

## Deine Bewertung
Analysiere und bewerte:
1. Wettbewerbsanalyse (competitiveAnalysis: competitionLevel, knownCompetitors, ourDifferentiators, competitiveWeaknesses)
2. Gewinn-Faktoren (winProbabilityFactors: hasIncumbentAdvantage, hasExistingRelationship, hasUniqueCapability, pricingPosition)
3. Geschätzte Gewinnwahrscheinlichkeit (estimatedWinProbability 0-100)
4. Confidence, reasoning, criticalBlockers (auf Deutsch)`;

  return generateStructuredOutput({
    model: 'quality',
    schema: competitionCheckSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
}
