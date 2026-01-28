/**
 * TechStack Expert Agent
 *
 * Extracts technology requirements from Pre-Qualification documents via RAG.
 * This analyzes what the Pre-Qualification DOCUMENT says about technology requirements -
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
  return `Du bist ein TechStack Expert Agent bei adesso SE für die Analyse von Pre-Qualification-Dokumenten.

## Deine Rolle
Analysiere die technischen Anforderungen aus Pre-Qualification-Dokumenten.
Deine Bewertung bestimmt, ob adesso die passenden Technologien anbieten kann.

## adesso Technologie-Stärken
- **CMS**: Drupal (Platinum Partner), TYPO3, Adobe AEM, Contentful
- **Frontend**: React, Angular, Vue.js, Next.js
- **Backend**: Java/Spring, .NET, Python, Node.js
- **Cloud**: AWS, Azure, GCP (alle zertifiziert)
- **Integration**: SAP, Salesforce, Microsoft 365

## Anforderungs-Klassifikation

| Typ | Bedeutung | Beispiel |
|-----|-----------|----------|
| required | Kunde fordert explizit | "Muss Drupal 10 sein" |
| preferred | Kunde bevorzugt | "Bevorzugt Open-Source CMS" |
| excluded | Kunde schließt aus | "Keine Cloud-Lösungen" |
| mentioned | Erwähnt ohne Vorgabe | "Aktuell TYPO3 im Einsatz" |

## CMS-Flexibilität

| Level | Beschreibung | adesso-Implikation |
|-------|--------------|-------------------|
| rigid | Feste CMS-Vorgabe | Nur wenn adesso-Kompetenz vorhanden |
| preferred | Präferenz mit Alternativen | Argumentation für adesso-Stack möglich |
| flexible | Mehrere Optionen genannt | Freie Empfehlung möglich |
| open | Keine Vorgabe | Drupal/adesso-Stack empfehlen |

## Komplexitäts-Faktoren (Score 1-10)
- Anzahl Integrationen (SSO, ERP, CRM, etc.)
- Sicherheits-/Compliance-Anforderungen (ISO, SOC2)
- Infrastruktur-Einschränkungen (On-Premise, spezielle Cloud)
- Technologie-Einschränkungen

## Ausgabesprache
Alle Texte auf Deutsch.`;
}

export async function runTechStackAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<TechStackAnalysis>> {
  const { preQualificationId } = input;

  try {
    const ragResults = await Promise.all(
      TECHSTACK_QUERIES.map(query => queryRfpDocument(preQualificationId, query, 5))
    );

    const allResults = ragResults.flat();

    if (allResults.length === 0) {
      return createAgentOutput<TechStackAnalysis>(
        {
          requirements: [],
          cmsRequirements: {
            explicit: [],
            preferred: [],
            excluded: [],
            flexibility: 'open',
            headlessRequired: null,
            multilingualRequired: null,
          },
          integrations: {
            sso: [],
            erp: [],
            crm: [],
            payment: [],
            other: [],
          },
          infrastructure: {
            cloudProviders: [],
            hostingRequirements: null,
            securityCertifications: [],
            complianceRequirements: [],
          },
          complexityScore: 1,
          complexityFactors: ['No technical requirements found in Pre-Qualification'],
          confidence: 0,
        },
        0,
        'No technology information found in Pre-Qualification document'
      );
    }

    const uniqueResults = Array.from(new Map(allResults.map(r => [r.content, r])).values()).sort(
      (a, b) => b.similarity - a.similarity
    );

    const context = formatContextFromRAG(
      uniqueResults.slice(0, 15),
      'Pre-Qualification Technology Requirements'
    );

    const analysis = await generateStructuredOutput({
      model: 'quality',
      schema: TechStackAnalysisSchema,
      system: buildSystemPrompt(),
      prompt: `Analyze the following Pre-Qualification content and extract all technology requirements:\n\n${context}`,
      temperature: 0.2,
    });

    const summaryContent = buildSummaryForStorage(analysis);
    await storeAgentResult(preQualificationId, 'techstack_expert', summaryContent, {
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
