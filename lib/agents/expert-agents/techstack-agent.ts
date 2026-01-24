/**
 * TechStack Expert Agent
 *
 * Extracts technology requirements from RFP documents via RAG.
 * This analyzes what the RFP DOCUMENT says about technology requirements -
 * the customer's explicit requirements, not what they currently use.
 */


import {
  queryRfpDocument,
  storeAgentResult,
  createAgentOutput,
  formatContextFromRAG,
} from './base';
import { TechStackAnalysisSchema, type TechStackAnalysis } from './techstack-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';

const TECHSTACK_QUERIES = [
  'technology stack platform CMS content management system Drupal WordPress',
  'SSO single sign-on authentication SAML OAuth integration',
  'ERP SAP Oracle integration CRM Salesforce HubSpot',
  'cloud AWS Azure GCP hosting infrastructure',
  'security certification ISO 27001 SOC2 GDPR compliance',
  'headless API REST GraphQL decoupled architecture',
  'multilingual internationalization i18n translation',
];

function buildSystemPrompt(): string {
  return `You are a TechStack Expert Agent analyzing RFP documents for technology requirements.

You work for adesso, an IT consultancy focused on CMS/Web projects. Your analysis helps determine if we can propose our preferred technology stack or must use the customer's specified technologies.

## Instructions

1. **Technology Requirements**:
   - Extract ALL mentioned technologies from the RFP
   - Distinguish between:
     - "required": Customer explicitly mandates this technology
     - "preferred": Customer prefers but allows alternatives
     - "excluded": Customer explicitly forbids this technology
     - "mentioned": Technology is referenced but not as a requirement
   - Provide context for WHY each technology is mentioned

2. **CMS Requirements** (highest priority for adesso):
   - Identify explicitly named CMS platforms
   - Determine flexibility level:
     - "rigid": Customer mandates specific CMS, no alternatives
     - "preferred": Customer prefers specific CMS but open to alternatives
     - "flexible": Customer mentions CMS options without strong preference
     - "open": No CMS specified, we can propose freely
   - Detect if headless/decoupled architecture is required
   - Detect if multilingual support is required

3. **Integration Requirements**:
   - Extract SSO providers (SAML, OAuth, Okta, Azure AD, etc.)
   - Extract ERP systems (SAP, Oracle, etc.)
   - Extract CRM systems (Salesforce, HubSpot, etc.)
   - Extract payment providers if mentioned
   - Other integrations

4. **Infrastructure Requirements**:
   - Cloud provider requirements or preferences
   - Hosting requirements (on-premise, cloud, hybrid)
   - Security certifications required (ISO 27001, SOC2)
   - Compliance requirements (GDPR, HIPAA, etc.)

5. **Complexity Assessment**:
   - Score from 1-10 based on:
     - Number of integrations required
     - Security/compliance requirements
     - Infrastructure constraints
     - Technology constraints
   - List specific complexity factors

6. **Confidence**:
   - Set based on clarity and completeness of technical requirements found

Return valid JSON matching the schema.`;
}

export async function runTechStackAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<TechStackAnalysis>> {
  const { rfpId } = input;

  try {
    const ragResults = await Promise.all(
      TECHSTACK_QUERIES.map(query => queryRfpDocument(rfpId, query, 5))
    );

    const allResults = ragResults.flat();

    if (allResults.length === 0) {
      return createAgentOutput<TechStackAnalysis>(
        {
          requirements: [],
          cmsRequirements: {
            flexibility: 'open',
          },
          integrations: {},
          infrastructure: {},
          complexityScore: 1,
          complexityFactors: ['No technical requirements found in RFP'],
          confidence: 0,
        },
        0,
        'No technology information found in RFP document'
      );
    }

    const uniqueResults = Array.from(new Map(allResults.map(r => [r.content, r])).values()).sort(
      (a, b) => b.similarity - a.similarity
    );

    const context = formatContextFromRAG(uniqueResults.slice(0, 15), 'RFP Technology Requirements');

    const analysis = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: TechStackAnalysisSchema,
      system: buildSystemPrompt(),
      prompt: `Analyze the following RFP content and extract all technology requirements:\n\n${context}`,
      temperature: 0.2,
    });

    const summaryContent = buildSummaryForStorage(analysis);
    await storeAgentResult(rfpId, 'techstack_expert', summaryContent, {
      cmsFlexibility: analysis.cmsRequirements.flexibility,
      complexityScore: analysis.complexityScore,
      requirementsCount: analysis.requirements.length,
      integrationsCount: countIntegrations(analysis),
    });

    return createAgentOutput(analysis, analysis.confidence);
  } catch (error) {
    console.error('[TechStackAgent] Error:', error);
    return createAgentOutput<TechStackAnalysis>(
      null,
      0,
      error instanceof Error ? error.message : 'Unknown error in TechStack Agent'
    );
  }
}

function countIntegrations(analysis: TechStackAnalysis): number {
  const { integrations } = analysis;
  return (
    (integrations.sso?.length || 0) +
    (integrations.erp?.length || 0) +
    (integrations.crm?.length || 0) +
    (integrations.payment?.length || 0) +
    (integrations.other?.length || 0)
  );
}

function buildSummaryForStorage(analysis: TechStackAnalysis): string {
  const parts: string[] = ['TechStack Analysis Summary:'];

  parts.push(`- CMS Flexibility: ${analysis.cmsRequirements.flexibility.toUpperCase()}`);

  if (analysis.cmsRequirements.explicit?.length) {
    parts.push(`- Explicit CMS: ${analysis.cmsRequirements.explicit.join(', ')}`);
  }

  if (analysis.cmsRequirements.headlessRequired) {
    parts.push('- Headless Architecture: REQUIRED');
  }

  if (analysis.cmsRequirements.multilingualRequired) {
    parts.push('- Multilingual: REQUIRED');
  }

  const requiredTech = analysis.requirements.filter(r => r.requirementType === 'required');
  if (requiredTech.length > 0) {
    parts.push(`- Required Technologies (${requiredTech.length}):`);
    requiredTech.forEach(t => {
      parts.push(`  • ${t.name} (${t.category})`);
    });
  }

  const integrationsCount = countIntegrations(analysis);
  if (integrationsCount > 0) {
    parts.push(`- Integrations Required: ${integrationsCount}`);
    if (analysis.integrations.sso?.length) {
      parts.push(`  • SSO: ${analysis.integrations.sso.join(', ')}`);
    }
    if (analysis.integrations.erp?.length) {
      parts.push(`  • ERP: ${analysis.integrations.erp.join(', ')}`);
    }
    if (analysis.integrations.crm?.length) {
      parts.push(`  • CRM: ${analysis.integrations.crm.join(', ')}`);
    }
  }

  if (analysis.infrastructure.securityCertifications?.length) {
    parts.push(
      `- Security Certifications: ${analysis.infrastructure.securityCertifications.join(', ')}`
    );
  }

  if (analysis.infrastructure.complianceRequirements?.length) {
    parts.push(`- Compliance: ${analysis.infrastructure.complianceRequirements.join(', ')}`);
  }

  parts.push(`- Complexity Score: ${analysis.complexityScore}/10`);
  if (analysis.complexityFactors.length > 0) {
    parts.push(`- Complexity Factors: ${analysis.complexityFactors.join('; ')}`);
  }

  return parts.join('\n');
}
