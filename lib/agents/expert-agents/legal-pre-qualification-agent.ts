/**
 * Legal Pre-Qualification Expert Agent
 *
 * Analyzes CONTRACTUAL/LEGAL requirements from Pre-Qualification documents.
 * NOT website legal compliance (that's legal-check-agent.ts).
 * Focuses on: liability, insurance, penalties, IP, contract terms, etc.
 */

import {
  queryRfpDocument,
  storeAgentResult,
  createAgentOutput,
  formatContextFromRAG,
} from './base';
import { LegalRfpAnalysisSchema, type LegalRfpAnalysis } from './legal-pre-qualification-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';

const LEGAL_Pre-Qualification_QUERIES = [
  'terms conditions contract agreement liability warranty',
  'GDPR privacy data protection compliance certification ISO SOC2',
  'insurance liability indemnification indemnity',
  'NDA confidentiality intellectual property IP ownership',
  'subcontractor subcontracting partner',
  'payment terms net invoice milestones',
  'penalty SLA service level agreement breach',
];

function buildSystemPrompt(): string {
  return `You are a Legal Pre-Qualification Expert Agent analyzing Pre-Qualification documents for contractual and legal requirements.

You work for adesso, an IT consultancy. Your analysis helps identify legal risks, required certifications, insurance requirements, and potential deal breakers in IT project/consulting contracts.

## Instructions

1. **Legal Requirements Extraction**:
   - Extract ALL legal/contractual requirements from the Pre-Qualification
   - Categorize each requirement:
     - contract_terms: Contract duration, termination, liability caps
     - compliance: GDPR, SOC2, ISO, industry-specific compliance
     - insurance: Required insurances (professional liability, cyber, etc.)
     - certification: Required certifications for the vendor
     - nda_ip: NDA requirements, IP ownership clauses
     - subcontracting: Rules about using subcontractors
     - payment_terms: Payment conditions, milestones, retainage
     - warranty: Warranty periods, SLA requirements
     - data_protection: Data handling, privacy, residency requirements
     - other: Other legal requirements
   - Mark each as mandatory or optional
   - Assess risk level (low/medium/high/critical)
   - Explain the implication for adesso

2. **Contract Details**:
   - Identify contract type (fixed-price, T&M, framework, etc.)
   - Extract contract duration if mentioned
   - Note termination notice periods
   - Identify liability limits or unlimited liability clauses
   - List any penalty clauses

3. **Required Certifications**:
   - List all certifications the vendor must have
   - Examples: ISO 27001, SOC2, industry-specific certs

4. **Required Insurance**:
   - List all required insurances with minimum amounts if specified
   - Examples: Professional liability, cyber insurance, general liability

5. **Risk Assessment**:
   - Determine overall risk level based on:
     - Unlimited liability clauses = CRITICAL
     - High penalty clauses = HIGH
     - Unusual IP ownership terms = HIGH
     - Strict compliance requirements = MEDIUM
     - Standard terms = LOW
   - List specific risk factors
   - Identify DEAL BREAKERS (conditions that may be unacceptable)

6. **Recommendations**:
   - Provide actionable recommendations for the legal team
   - Suggest negotiation points

7. **Questions for Legal**:
   - Generate specific questions the legal team should clarify

8. **Confidence**:
   - Set based on clarity and completeness of legal requirements found

Return valid JSON matching the schema.`;
}

export async function runLegalRfpAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<LegalRfpAnalysis>> {
  const { preQualificationId } = input;

  try {
    const ragResults = await Promise.all(
      LEGAL_Pre-Qualification_QUERIES.map(query => queryRfpDocument(preQualificationId, query, 5))
    );

    const allResults = ragResults.flat();

    if (allResults.length === 0) {
      return createAgentOutput<LegalRfpAnalysis>(
        {
          requirements: [],
          contractDetails: {},
          requiredCertifications: [],
          requiredInsurance: [],
          overallRiskLevel: 'low',
          riskFactors: ['No legal requirements found in Pre-Qualification document'],
          dealBreakers: [],
          recommendations: ['Review Pre-Qualification manually - no legal content detected'],
          questionsForLegal: [],
          confidence: 0,
        },
        0,
        'No legal information found in Pre-Qualification document'
      );
    }

    const uniqueResults = Array.from(new Map(allResults.map(r => [r.content, r])).values()).sort(
      (a, b) => b.similarity - a.similarity
    );

    const context = formatContextFromRAG(
      uniqueResults.slice(0, 15),
      'Pre-Qualification Legal/Contractual Requirements'
    );

    const analysis = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: LegalRfpAnalysisSchema,
      system: buildSystemPrompt(),
      prompt: `Analyze the following Pre-Qualification content and extract all legal and contractual requirements:\n\n${context}`,
      temperature: 0.2,
    });

    const summaryContent = buildSummaryForStorage(analysis);
    await storeAgentResult(preQualificationId, 'legal_rfp_expert', summaryContent, {
      overallRiskLevel: analysis.overallRiskLevel,
      requirementsCount: analysis.requirements.length,
      dealBreakersCount: analysis.dealBreakers.length,
      certificationsCount: analysis.requiredCertifications.length,
      insuranceCount: analysis.requiredInsurance.length,
    });

    return createAgentOutput(analysis, analysis.confidence);
  } catch (error) {
    console.error('[LegalRfpAgent] Error:', error);
    return createAgentOutput<LegalRfpAnalysis>(
      null,
      0,
      error instanceof Error ? error.message : 'Unknown error in Legal Pre-Qualification Agent'
    );
  }
}

function buildSummaryForStorage(analysis: LegalRfpAnalysis): string {
  const parts: string[] = ['Legal Pre-Qualification Analysis Summary:'];

  parts.push(`- Overall Risk Level: ${analysis.overallRiskLevel.toUpperCase()}`);

  if (analysis.dealBreakers.length > 0) {
    parts.push(`- DEAL BREAKERS (${analysis.dealBreakers.length}):`);
    analysis.dealBreakers.forEach(db => {
      parts.push(`  ⚠️ ${db}`);
    });
  }

  if (analysis.contractDetails.contractType) {
    parts.push(`- Contract Type: ${analysis.contractDetails.contractType}`);
  }
  if (analysis.contractDetails.duration) {
    parts.push(`- Duration: ${analysis.contractDetails.duration}`);
  }
  if (analysis.contractDetails.liabilityLimit) {
    parts.push(`- Liability Limit: ${analysis.contractDetails.liabilityLimit}`);
  }
  if (analysis.contractDetails.penaltyClauses?.length) {
    parts.push(`- Penalty Clauses: ${analysis.contractDetails.penaltyClauses.length}`);
  }

  const criticalReqs = analysis.requirements.filter(r => r.riskLevel === 'critical');
  const highReqs = analysis.requirements.filter(r => r.riskLevel === 'high');

  if (criticalReqs.length > 0) {
    parts.push(`- Critical Requirements (${criticalReqs.length}):`);
    criticalReqs.forEach(r => {
      parts.push(`  • ${r.requirement} [${r.category}]`);
    });
  }

  if (highReqs.length > 0) {
    parts.push(`- High Risk Requirements (${highReqs.length}):`);
    highReqs.forEach(r => {
      parts.push(`  • ${r.requirement} [${r.category}]`);
    });
  }

  if (analysis.requiredCertifications.length > 0) {
    parts.push(`- Required Certifications: ${analysis.requiredCertifications.join(', ')}`);
  }

  if (analysis.requiredInsurance.length > 0) {
    parts.push(`- Required Insurance:`);
    analysis.requiredInsurance.forEach(ins => {
      parts.push(`  • ${ins.type}${ins.minAmount ? ` (min: ${ins.minAmount})` : ''}`);
    });
  }

  if (analysis.riskFactors.length > 0) {
    parts.push(`- Risk Factors: ${analysis.riskFactors.join('; ')}`);
  }

  if (analysis.recommendations.length > 0) {
    parts.push(`- Recommendations (${analysis.recommendations.length}):`);
    analysis.recommendations.slice(0, 3).forEach(rec => {
      parts.push(`  → ${rec}`);
    });
  }

  if (analysis.questionsForLegal.length > 0) {
    parts.push(`- Questions for Legal Team: ${analysis.questionsForLegal.length}`);
  }

  return parts.join('\n');
}
