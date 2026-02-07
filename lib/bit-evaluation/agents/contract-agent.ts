import { contractAnalysisSchema, type ContractAnalysis } from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';
import { generateStructuredOutput } from '@/lib/ai/config';
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

export interface ContractAgentInput {
  extractedRequirements: any;
  qualificationScanResults?: any;
  useWebSearch?: boolean;
}

export async function runContractAgent(input: ContractAgentInput): Promise<ContractAnalysis> {
  let contractTypeInsights = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Contract Researcher' });

    try {
      const contractType = input.extractedRequirements?.contractType;
      const projectType =
        input.extractedRequirements?.projectType || input.extractedRequirements?.projectDescription;

      if (contractType || projectType) {
        const searchQuery = contractType
          ? `${contractType} Vertrag IT-Projekt Risiken Best Practices Deutschland`
          : `IT-Projekt Vertragsmodell Festpreis Time Material Risiken`;

        const contractSearch = await intelligentTools.webSearch(searchQuery, 3);

        if (contractSearch && contractSearch.length > 0) {
          const rawContractData = contractSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n');

          contractTypeInsights = `\n\n### Vertragsmodell-Insights\n${wrapUserContent(rawContractData, 'web')}`;
          console.log(`[Contract Agent] ${contractSearch.length} Vertragsmodell-Insights gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Contract Agent] Research fehlgeschlagen:', error);
    }
  }

  const systemPrompt = `Du bist ein Contract Analyst bei adesso SE.

## Deine Aufgabe
Analysiere den Vertragstyp und identifiziere Risiken dieser Opportunity.

## Vertragstyp-Erkennung

| Typ | Keywords |
|-----|----------|
| tm | "nach Aufwand", "Stundensätze", "agil", "Tagessatz" |
| fixed_price | "Pauschal", "Festpreis", "nicht zu überschreiten", "Gesamtpreis" |
| framework | "Abruf", "Kontingent", "Rahmenvertrag", "Laufzeit X Jahre" |
| hybrid | "Festpreis für Phase 1", "T&M für Phase 2" |
| sla | "Service Level Agreement", "Verfügbarkeit", "Support" |

## Risk Flag Kategorien

| Kategorie | Beispiele |
|-----------|-----------|
| timeline | Unrealistische Deadlines, Go-Live <3 Monate |
| scope | "und weitere Features", "nach Bedarf", vage Requirements |
| budget | Budget 50% unter Markt, fehlendes Budget |
| legal | Unbegrenzte Haftung, Pönalen >10% |
| technical | Legacy Integration, keine API-Doku |

## Penalty Risk Levels
- low: <5% Verzugspönale
- medium: 5-10% Pönalen
- high: >10% Pönalen
- critical: Unbegrenzte oder kumulative Pönalen

## Change Request Bewertung
- Gut: "Änderungen nach Abstimmung", "CR-Prozess definiert"
- Schlecht: "Keine Änderungen", "Festpreis ohne CR"

## Ausgabesprache
Alle Texte auf Deutsch.`;

  const userPrompt = `Analysiere das Vertragsmodell und identifiziere Risiken.

## Extrahierte Anforderungen
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.qualificationScanResults
    ? `## Qualification Scan Ergebnisse
${JSON.stringify(input.qualificationScanResults, null, 2)}`
    : ''
}
${contractTypeInsights}

## Deine Analyse
Liefere:
1. Vertragstyp (contractType, contractTypeIndicators)
2. Budget-Analyse (budgetAnalysis)
3. Risk Flags (riskFlags mit category, severity, description, mitigation)
4. Change Request Prozess (changeRequestProcess)
5. Pönalen (penaltyClauses)
6. Timeline-Bewertung (timelineAssessment)
7. Scope-Klarheit (scopeClarity)
8. Gesamtbewertung (overallContractScore, confidence, reasoning, criticalBlockers)`;

  return generateStructuredOutput({
    model: 'quality',
    schema: contractAnalysisSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
}
