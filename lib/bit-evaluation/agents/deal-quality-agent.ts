import { dealQualitySchema, type DealQuality } from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';
import { generateStructuredOutput } from '@/lib/ai/config';
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

export interface DealQualityAgentInput {
  extractedRequirements: any;
  quickScanResults?: any;
  useWebSearch?: boolean;
}

export async function runDealQualityAgent(input: DealQualityAgentInput): Promise<DealQuality> {
  let marketInsights = '';
  let customerNews = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Deal Quality Researcher' });

    try {
      const customerName = input.extractedRequirements?.customerName;
      const projectType = input.extractedRequirements?.projectType || 'IT Projekt';

      if (customerName) {
        const newsSearch = await intelligentTools.webSearch(
          `"${customerName}" IT Projekt Ausschreibung digital 2024`,
          3
        );

        if (newsSearch && newsSearch.length > 0) {
          const rawNewsData = newsSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          customerNews = `\n\n### Aktuelle Kunden-News\n${wrapUserContent(rawNewsData, 'web')}`;
          console.log(`[Deal Quality Agent] ${newsSearch.length} Kunden-News gefunden`);
        }
      }

      const budgetSearch = await intelligentTools.webSearch(
        `${projectType} Budget Kosten Enterprise Deutschland 2024`,
        3
      );

      if (budgetSearch && budgetSearch.length > 0) {
        const rawBudgetData = budgetSearch
          .slice(0, 2)
          .map(r => `- ${r.title}: ${r.snippet}`)
          .join('\n');

        marketInsights = `\n\n### Markt-Benchmarks\n${wrapUserContent(rawBudgetData, 'web')}`;
        console.log(`[Deal Quality Agent] ${budgetSearch.length} Markt-Insights gefunden`);
      }
    } catch (error) {
      console.warn('[Deal Quality Agent] Research fehlgeschlagen:', error);
    }
  }

  const systemPrompt = `Du bist ein Business Development Experte bei adesso SE.

## Deine Aufgabe
Analysiere die Ausschreibung und beantworte die kritischen Fragen für die BIT/NO BIT Entscheidung.

## adesso Kommerzieller Kontext
- Stundensätze: €80-€150/h (Senior: €120+)
- Ziel-Margen: 25-35% Bruttomarge
- Mindest-Dealgrößen: €50k+ (präferiert: €150k+)
- Zahlungsziele: 30-60 Tage Standard

## Die 10 kritischen BIT-Fragen

1. **Kundenbeziehung**: Bekannte Ansprechpartner oder anonymes Portal?
2. **Budget**: Angemessen für den Scope?
3. **Timeline**: Realistisch? Shortlisting? Projektstart?
4. **Vertragsform**: EVB-IT, Dienstleistung, SLA? Risiken?
5. **Leistungsumfang**: Welche konkreten Leistungen?
6. **Referenzen**: Gefordert? Können wir erfüllen?
7. **Zuschlagskriterien**: Wie gewichtet?
8. **Team-Anforderungen**: Wie viele Leute? Komplexität?
9. **Herausforderungen**: Spezielle Risiken?
10. **Gewinnchancen**: Realistische Einschätzung?

## Bewertungskriterien

### Budget-Bewertung
- adequate: Budget passt zum Scope
- tight: Knapp aber machbar
- inadequate: Deutlich zu wenig

### Timeline-Bewertung
- realistic: Umsetzbar mit Puffer
- tight: Knapp aber machbar
- unrealistic: Nicht umsetzbar

### Profitabilität
- high: >25% Marge erwartet
- medium: 15-25% Marge
- low: <15% Marge

## Ausgabesprache
Alle Texte auf Deutsch.`;

  const userPrompt = `Analysiere diese Ausschreibung für die BIT/NO BIT Entscheidung.

## Extrahierte Anforderungen
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.quickScanResults
    ? `## Quick Scan Ergebnisse
${JSON.stringify(input.quickScanResults, null, 2)}`
    : ''
}
${customerNews}
${marketInsights}

## Deine Bewertung
Beantworte die 10 kritischen Fragen und liefere:
1. Budget-Analyse (budgetAdequacy, estimatedBudget, estimatedMargin, budgetRisks)
2. Timeline-Analyse (timelineRealism, projectStart, shortlistingDate, timelineRisks)
3. Vertrags-Analyse (contractType, contractRisks)
4. Kundenbeziehung (customerRelationship, relationshipDetails)
5. Anforderungen (requiredServices, requiredReferences, canFulfillReferences)
6. Zuschlagskriterien (awardCriteria)
7. Team (teamRequirements)
8. Herausforderungen (challenges)
9. Kommerzielle Bewertung (expectedRevenueRange, profitabilityRating, commercialRisks)
10. Gesamtbewertung (overallDealQualityScore, confidence, reasoning, criticalBlockers)`;

  return generateStructuredOutput({
    model: 'quality',
    schema: dealQualitySchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
}
