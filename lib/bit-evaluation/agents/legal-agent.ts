import OpenAI from 'openai';
import { legalAssessmentSchema, type LegalAssessment } from '../schema';
import { createIntelligentTools } from '@/lib/agent-tools/intelligent-tools';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

export interface LegalAgentInput {
  extractedRequirements: any;
  quickScanResults?: any;
  useWebSearch?: boolean; // Web Search für Vertrags-Recherche
}

/**
 * BIT-006: Legal Assessment Agent
 * Evaluates legal and contractual risks
 * UPGRADED: Mit Web Search für Vertrags- und Compliance-Recherche
 */
export async function runLegalAgent(input: LegalAgentInput): Promise<LegalAssessment> {
  // === Intelligent Research Phase ===
  let contractInsights = '';
  let complianceInsights = '';

  if (input.useWebSearch !== false) {
    const intelligentTools = createIntelligentTools({ agentName: 'Legal Researcher' });

    try {
      const contractType = input.extractedRequirements?.contractType;
      const industry = input.quickScanResults?.companyIntelligence?.basicInfo?.industry;

      // EVB-IT / Vertragstyp Recherche
      if (contractType && contractType.toLowerCase().includes('evb')) {
        const evbSearch = await intelligentTools.webSearch(
          `EVB-IT ${contractType} Vertrag Risiken Konditionen IT-Dienstleistung`,
          3
        );

        if (evbSearch && evbSearch.length > 0) {
          contractInsights = `\n\n**EVB-IT Vertrags-Insights (EXA):**\n${evbSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n')}`;
          console.log(`[Legal Agent] ${evbSearch.length} Vertrags-Insights gefunden`);
        }
      }

      // Branchenspezifische Compliance-Anforderungen
      if (industry) {
        const complianceSearch = await intelligentTools.webSearch(
          `${industry} IT compliance DSGVO Anforderungen Deutschland 2024`,
          3
        );

        if (complianceSearch && complianceSearch.length > 0) {
          complianceInsights = `\n\n**Branchenspezifische Compliance (EXA):**\n${complianceSearch
            .slice(0, 2)
            .map(r => `- ${r.title}: ${r.snippet}`)
            .join('\n')}`;
          console.log(`[Legal Agent] ${complianceSearch.length} Compliance-Insights gefunden`);
        }
      }
    } catch (error) {
      console.warn('[Legal Agent] Research fehlgeschlagen:', error);
    }
  }

  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist ein erfahrener Legal Risk Assessor bei adesso SE.
Bewerte GRÜNDLICH die rechtlichen und vertraglichen Risiken dieser Opportunity.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Gib immer eine fundierte Einschätzung ab. Alle Begründungen und Texte auf Deutsch.`,
      },
      {
        role: 'user',
        content: `Evaluate the legal and contractual risks for this project opportunity.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `
Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}
` : ''}
${contractInsights}
${complianceInsights}

adesso's Standard Legal Position:
- **Contract Types:** Preferred T&M or hybrid models; Fixed Price only with clear scope
- **Payment Terms:** Standard 30 days net; milestone-based acceptable
- **Liability:** Standard caps at contract value or lower; no unlimited liability
- **IP:** Retain IP for reusable components; customer-specific deliverables transfer acceptable
- **Compliance:** GDPR compliant; SOC2/ISO27001 certification available
- **Exit:** Reasonable notice periods (30-90 days); mutual termination rights

Respond with JSON containing:
- contractTypeAssessment (object):
  - contractType (string): Type of contract (fixed price, T&M, outcome-based, etc.)
  - isAcceptable (boolean): Is this contract type acceptable for adesso?
  - contractRisks (array of strings): Risks related to contract type
- paymentRiskAssessment (object):
  - paymentTerms (string): Payment terms description (e.g., "30 days net")
  - paymentRiskLevel (string: "low", "medium", or "high"): Risk level
  - paymentRisks (array of strings): Payment-related risks
- liabilityAssessment (object):
  - hasUnlimitedLiability (boolean): Does contract require unlimited liability?
  - liabilityCaps (string): Description of liability caps if any
  - liabilityRisks (array of strings): Liability-related risks
- ipAndLicenseAssessment (object):
  - ipTransferRequired (boolean): Is IP transfer to customer required?
  - licenseRequirements (array of strings): License requirements or restrictions
  - ipRisks (array of strings): IP and licensing risks
- complianceAssessment (object):
  - hasSpecialCompliance (boolean): Are there special compliance requirements?
  - complianceRequirements (array of strings): Compliance requirements (GDPR, SOC2, etc.)
  - complianceRisks (array of strings): Compliance-related risks
- exitClauseAssessment (object):
  - hasReasonableExit (boolean): Are exit clauses reasonable?
  - exitConditions (array of strings): Exit conditions in contract
  - exitRisks (array of strings): Exit-related risks
- overallLegalScore (number 0-100): Gesamt Legal Score
- confidence (number 0-100): Confidence der Bewertung
- reasoning (string): Ausführliche Begründung auf Deutsch (min. 2-3 Sätze)
- criticalBlockers (array of strings): Kritische rechtliche Blocker auf Deutsch`,
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

  return legalAssessmentSchema.parse(cleanedResult);
}
