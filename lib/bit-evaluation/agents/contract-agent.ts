import OpenAI from 'openai';

import { contractAnalysisSchema, type ContractAnalysis } from '../schema';

import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';

// Security: Prompt Injection Protection
import { wrapUserContent } from '@/lib/security/prompt-sanitizer';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface ContractAgentInput {
  extractedRequirements: any;
  quickScanResults?: any;
  useWebSearch?: boolean; // Web Search für Vertrags-Recherche
}

/**
 * DEA-7: Contract Agent
 * Detects contract type (T&M, Fixed Price, Framework) and identifies risk flags
 * Focuses on: contract type, budget, timeline, scope clarity, penalties, change process
 */
export async function runContractAgent(input: ContractAgentInput): Promise<ContractAnalysis> {
  // === Intelligent Research Phase ===
  let contractTypeInsights = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Contract Researcher' });

    try {
      const contractType = input.extractedRequirements?.contractType;
      const projectType =
        input.extractedRequirements?.projectType || input.extractedRequirements?.projectDescription;

      // Research contract type best practices and risks
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

          // Wrap web search results for prompt injection protection
          contractTypeInsights = `\n\n**Vertragsmodell-Insights (EXA):**\n${wrapUserContent(rawContractData, 'web')}`;
          console.log(`[Contract Agent] ${contractSearch.length} Vertragsmodell-Insights gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Contract Agent] Research fehlgeschlagen:', error);
    }
  }

  const completion = await openai.chat.completions.create({
    model: 'gemini-3-flash-preview',
    messages: [
      {
        role: 'system',
        content: `Du bist ein erfahrener Contract Analyst bei adesso SE.
Analysiere GRÜNDLICH den Vertragstyp und identifiziere Risiken dieser Opportunity.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG:
- Alle Begründungen und Texte auf Deutsch
- Sei konkret und präzise in den Risk Flags
- Nutze NLP für Keyword-Extraktion aus dem RFP-Text
- Erkenne Contract Type Indikatoren (z.B. "nach Aufwand" = T&M, "Pauschalpreis" = Fixed Price)`,
      },
      {
        role: 'user',
        content: `Analyze the contract model and identify risk flags for this project opportunity.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${
  input.quickScanResults
    ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
`
    : ''
}
${contractTypeInsights}

**Contract Type Detection Guidelines:**
- **T&M (Time & Material):** Keywords: "nach Aufwand", "Stundensätze", "agil", "Tagessatz", "Abrechnung nach Aufwand"
- **Fixed Price (Festpreis):** Keywords: "Pauschal", "Festpreis", "nicht zu überschreiten", "Gesamtpreis", "Budget: X€"
- **Framework (Rahmenvertrag):** Keywords: "Abruf", "Kontingent", "Rahmenvertrag", "Laufzeit X Jahre", "auf Abruf"
- **Hybrid:** Keywords: "Festpreis für Phase 1", "T&M für Phase 2", "gemischt"
- **SLA:** Keywords: "Service Level Agreement", "Verfügbarkeit", "Support", "Wartung"

**Risk Flag Detection:**
- **Timeline Risks:** Unrealistic deadlines, Go-Live < 3 months for complex projects, missing timeline
- **Scope Risks:** "und weitere Features", "nach Bedarf", "flexibel anpassbar", vague requirements
- **Budget Risks:** Budget 50% below market rate, missing budget, unrealistic budget/scope ratio
- **Legal Risks:** Unlimited liability, penalty clauses >10%, unclear exit clauses
- **Technical Risks:** Legacy integration, no API documentation, unclear tech requirements

**Change Request Process:**
- Good: "Änderungen nach Abstimmung", "Change Request Prozess", "agile Anpassungen"
- Bad: "Keine Änderungen", "Festpreis ohne CR", "Nachträge nur mit Genehmigung"

**Penalty Clauses:**
- Low Risk: <5% Verzugspönale, reasonable deadlines
- Medium: 5-10% penalties, tight deadlines
- High: >10% penalties, daily penalties, unrealistic milestones
- Critical: Unlimited penalties, cumulative penalties

Respond with JSON containing:
- contractType (string): One of: tm, fixed_price, framework, hybrid, sla, unknown
- contractTypeIndicators (array of strings): Text snippets that indicate the contract type
- budgetAnalysis (object):
  - hasBudget (boolean)
  - budgetValue (number, optional): Extracted budget amount
  - currency (string, optional): e.g., "EUR", "USD"
  - budgetType (string, optional): fixed, range, estimate, unknown
  - budgetRisks (array of strings): Budget risks in German
- riskFlags (array of objects):
  - category (string): timeline, scope, budget, legal, technical
  - severity (string): low, medium, high, critical
  - description (string): Risk description in German
  - mitigation (string, optional): Mitigation strategy in German
- changeRequestProcess (object):
  - hasProcess (boolean)
  - processDescription (string, optional)
  - isFlexible (boolean)
- penaltyClauses (object):
  - hasPenalties (boolean)
  - penaltyDescription (array of strings)
  - penaltyRiskLevel (string): low, medium, high, critical
- timelineAssessment (object):
  - isRealistic (boolean)
  - timelineRisks (array of strings)
  - deadlines (array of strings, optional)
- scopeClarity (object):
  - isClear (boolean)
  - unclearAreas (array of strings)
  - scopeRisks (array of strings)
- overallContractScore (number 0-100): Overall contract quality score
- confidence (number 0-100): Confidence in analysis
- reasoning (string): Detailed explanation in German (min. 3-4 sentences)
- criticalBlockers (array of strings): Critical contract blockers in German`,
      },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';
  const cleanedResponse = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const rawResult = JSON.parse(cleanedResponse);
  const cleanedResult = Object.fromEntries(
    Object.entries(rawResult).filter(([_, v]) => v !== null)
  );

  return contractAnalysisSchema.parse(cleanedResult);
}
