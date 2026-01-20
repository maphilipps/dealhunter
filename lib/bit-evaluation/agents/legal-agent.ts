import OpenAI from 'openai';
import { legalAssessmentSchema, type LegalAssessment, legalQuickCheckSchema, type LegalQuickCheck } from '../schema';
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
  level?: 'quick' | 'full'; // DEA-8: Quick Check (BD) vs Full Check (BL)
}

/**
 * DEA-8: Legal Quick Check (BD-Level)
 * Fast risk assessment focusing on critical red flags
 */
export async function runLegalQuickCheck(input: LegalAgentInput): Promise<LegalQuickCheck> {
  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist ein erfahrener Legal Risk Assessor bei adesso SE.
Führe einen SCHNELLEN Legal Quick Check durch - fokussiere auf KRITISCHE Red Flags.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Alle Texte auf Deutsch.`,
      },
      {
        role: 'user',
        content: `Perform a QUICK legal risk check for this project. Focus on CRITICAL red flags only.

Extracted Requirements:
${JSON.stringify(input.extractedRequirements, null, 2)}

${input.quickScanResults ? `Quick Scan Results:
${JSON.stringify(input.quickScanResults, null, 2)}` : ''}

Critical Red Flag Categories to check:
- **liability**: Unbegrenzte Haftung, unfaire Haftungsklauseln
- **penalty**: Unrealistische Pönalen (>10% Budget)
- **ip**: Problematische IP-Übertragungsklauseln
- **warranty**: Überzogene Gewährleistungsanforderungen
- **termination**: Unfaire Kündigungsklauseln
- **jurisdiction**: Problematische Gerichtsstände

Respond with JSON containing:
- criticalFlags (array): List of critical red flags found with category, severity, description (German), and clauseReference
- complianceHints (array of strings): Hints about compliance topics that need attention (German)
- requiresDetailedReview (boolean): Whether full legal review is required
- quickRiskScore (number 1-10): Quick risk score (1=low, 10=critical)
- confidence (number 0-100): Confidence in this quick check
- reasoning (string): Quick assessment reasoning (German, 2-3 sentences)`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';
  const cleanedResponse = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const rawResult = JSON.parse(cleanedResponse);
  return legalQuickCheckSchema.parse(rawResult);
}

/**
 * BIT-006: Legal Assessment Agent (DEA-8 Enhanced)
 * Evaluates legal and contractual risks with two-level support
 * UPGRADED: Mit Web Search für Vertrags- und Compliance-Recherche
 */
export async function runLegalAgent(input: LegalAgentInput): Promise<LegalAssessment> {
  // DEA-8: Support quick check or full check
  const level = input.level || 'full';

  // Always run quick check first
  const quickCheck = level === 'quick' ? await runLegalQuickCheck(input) : undefined;
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

  // DEA-8: For full check, run comprehensive analysis
  let fullCheck = undefined;
  if (level === 'full') {
    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content: `Du bist ein erfahrener Legal Risk Assessor bei adesso SE.
Bewerte GRÜNDLICH die rechtlichen und vertraglichen Risiken dieser Opportunity.
Führe eine VOLLSTÄNDIGE Compliance-Prüfung durch (Vergaberecht, Rahmenverträge, Subunternehmer).
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Gib immer eine fundierte Einschätzung ab. Alle Begründungen und Texte auf Deutsch.`,
        },
        {
          role: 'user',
          content: `Evaluate the legal and contractual risks for this project opportunity comprehensively.

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

Respond with JSON containing a "fullCheck" object with:
- contractTypeAssessment (object):
  - contractType (string): Type of contract (fixed price, T&M, outcome-based, etc.)
  - isAcceptable (boolean): Is this contract type acceptable for adesso?
  - contractRisks (array of strings): Risks related to contract type (German)
- paymentRiskAssessment (object):
  - paymentTerms (string): Payment terms description (e.g., "30 days net") (German)
  - paymentRiskLevel (string: "low", "medium", or "high"): Risk level
  - paymentRisks (array of strings): Payment-related risks (German)
- liabilityAssessment (object):
  - hasUnlimitedLiability (boolean): Does contract require unlimited liability?
  - liabilityCaps (string): Description of liability caps if any (German)
  - liabilityRisks (array of strings): Liability-related risks (German)
- ipAndLicenseAssessment (object):
  - ipTransferRequired (boolean): Is IP transfer to customer required?
  - licenseRequirements (array of strings): License requirements or restrictions (German)
  - ipRisks (array of strings): IP and licensing risks (German)
- complianceCheck (object):
  - procurementLaw (object):
    - applicable (boolean): Is procurement law applicable?
    - type (string: "vob", "vgv", "uvgo", "eu_threshold", or "none"): Type of procurement law
    - requirements (array of strings): Procurement requirements (German)
    - deadlines (array of objects with name and date): Procurement deadlines (German)
  - frameworkAgreement (object):
    - isFramework (boolean): Is this a framework agreement?
    - existingFramework (string, optional): Name of existing framework (German)
    - callOffRules (array of strings): Call-off rules (German)
  - subcontractor (object):
    - allowed (boolean): Are subcontractors allowed?
    - restrictions (array of strings): Restrictions on subcontractors (German)
    - reportingRequirements (array of strings): Reporting requirements (German)
- exitClauseAssessment (object):
  - hasReasonableExit (boolean): Are exit clauses reasonable?
  - exitConditions (array of strings): Exit conditions in contract (German)
  - exitRisks (array of strings): Exit-related risks (German)
- allRedFlags (array): All identified red flags with category ("liability", "penalty", "ip", "warranty", "termination", "jurisdiction"), severity ("critical" or "warning"), description (German), and optional clauseReference`,
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
    fullCheck = rawResult.fullCheck || rawResult;
  }

  // Calculate overall scores
  const legalRiskScore = quickCheck?.quickRiskScore ||
    (fullCheck ? Math.round((100 - (fullCheck.overallLegalScore || 50)) / 10) : 5);
  const overallLegalScore = quickCheck
    ? Math.max(0, 100 - (quickCheck.quickRiskScore * 10))
    : (fullCheck?.overallLegalScore || 50);

  // Combine results
  const finalCompletion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist Legal Risk Assessor. Erstelle eine finale Zusammenfassung.
Antworte mit validem JSON ohne Markdown-Code-Blöcke.`,
      },
      {
        role: 'user',
        content: `Create final legal assessment summary based on:

${quickCheck ? `Quick Check Results:
${JSON.stringify(quickCheck, null, 2)}` : ''}

${fullCheck ? `Full Check Results:
${JSON.stringify(fullCheck, null, 2)}` : ''}

Provide:
- overallLegalScore (number 0-100): ${overallLegalScore}
- legalRiskScore (number 1-10): ${legalRiskScore}
- confidence (number 0-100): Confidence level
- reasoning (string): Detailed reasoning in German (min 3-4 sentences)
- criticalBlockers (array of strings): Critical blockers in German`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const finalResponseText = finalCompletion.choices[0]?.message?.content || '{}';
  const finalCleanedResponse = finalResponseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const finalResult = JSON.parse(finalCleanedResponse);

  // DEA-8: Construct the full legal assessment with two-level support
  const result: LegalAssessment = {
    quickCheck: quickCheck,
    fullCheck: fullCheck,
    overallLegalScore: finalResult.overallLegalScore || overallLegalScore,
    legalRiskScore: finalResult.legalRiskScore || legalRiskScore,
    confidence: finalResult.confidence || (quickCheck?.confidence || 50),
    reasoning: finalResult.reasoning || 'Rechtliche Analyse durchgeführt.',
    criticalBlockers: finalResult.criticalBlockers || [],
  };

  return legalAssessmentSchema.parse(result);
}
