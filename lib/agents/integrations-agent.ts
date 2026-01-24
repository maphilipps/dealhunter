/**
 * Integrations Agent (Phase 2.5)
 *
 * Analyzes system integrations and their complexity.
 *
 * Features:
 * - Integration detection from Quick Scan
 * - Integration complexity assessment
 * - API requirements analysis
 * - Third-party system mapping
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { qualifications, quickScans, dealEmbeddings } from '@/lib/db/schema';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Integration schema
 */
export const IntegrationSchema = z.object({
  name: z.string().describe('Integration name'),
  type: z
    .enum(['crm', 'erp', 'marketing', 'analytics', 'payment', 'auth', 'search', 'cdn', 'other'])
    .describe('Integration type'),
  vendor: z.string().describe('Vendor/Product name'),
  complexity: z.enum(['low', 'medium', 'high']).describe('Integration complexity'),
  effort: z.number().describe('Estimated effort in hours'),
  apiType: z.enum(['rest', 'graphql', 'soap', 'webhook', 'sdk', 'custom']).describe('API type'),
  documentation: z.enum(['excellent', 'good', 'limited', 'poor']).describe('Documentation quality'),
  notes: z.string().describe('Implementation notes'),
});

export type Integration = z.infer<typeof IntegrationSchema>;

/**
 * System landscape schema
 */
export const SystemLandscapeSchema = z.object({
  primarySystems: z.array(z.string()).describe('Primary systems in use'),
  dataFlows: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        type: z.string(),
        frequency: z.string(),
      })
    )
    .describe('Data flows between systems'),
  authentication: z.object({
    method: z.string().describe('Authentication method'),
    sso: z.boolean().describe('SSO enabled'),
    provider: z.string().nullable().describe('Auth provider if any'),
  }),
});

export type SystemLandscape = z.infer<typeof SystemLandscapeSchema>;

/**
 * Integrations analysis result schema
 */
export const IntegrationsAnalysisSchema = z.object({
  // Detected Integrations
  integrations: z.array(IntegrationSchema).describe('List of integrations'),

  // System Landscape
  systemLandscape: SystemLandscapeSchema,

  // Summary
  summary: z.object({
    totalIntegrations: z.number(),
    totalEffort: z.number().describe('Total effort in hours'),
    highComplexityCount: z.number(),
    mediumComplexityCount: z.number(),
    lowComplexityCount: z.number(),
  }),

  // Risk Assessment
  integrationRisks: z.array(
    z.object({
      integration: z.string(),
      risk: z.string(),
      mitigation: z.string(),
    })
  ),

  // Recommendations
  recommendations: z.array(z.string()).describe('Integration recommendations'),

  // Confidence
  confidence: z.number().min(0).max(100).describe('Analysis confidence'),
});

export type IntegrationsAnalysis = z.infer<typeof IntegrationsAnalysisSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run integrations agent
 *
 * @param leadId - Lead ID
 * @param rfpId - RFP ID
 * @returns Integrations analysis
 */
export async function runIntegrationsAgent(
  leadId: string,
  rfpId: string
): Promise<IntegrationsAnalysis> {
  // 1. Fetch lead and Quick Scan data
  const [leadData] = await db
    .select({
      customerName: qualifications.customerName,
      industry: qualifications.industry,
      websiteUrl: qualifications.websiteUrl,
      quickScanId: qualifications.quickScanId,
    })
    .from(qualifications)
    .where(eq(qualifications.id, leadId))
    .limit(1);

  if (!leadData) {
    throw new Error(`Lead ${leadId} not found`);
  }

  // 2. Fetch Quick Scan data
  let quickScanData: {
    integrations: unknown;
    techStack: unknown;
    features: unknown;
  } | null = null;

  if (leadData.quickScanId) {
    const [qs] = await db
      .select({
        integrations: quickScans.integrations,
        techStack: quickScans.techStack,
        features: quickScans.features,
      })
      .from(quickScans)
      .where(eq(quickScans.id, leadData.quickScanId))
      .limit(1);

    if (qs) {
      quickScanData = {
        integrations: safeParseJson(qs.integrations),
        techStack: safeParseJson(qs.techStack),
        features: safeParseJson(qs.features),
      };
    }
  }

  // 3. Generate analysis with AI
  const system = `Du bist ein System Integration Analyst für adesso SE.
Analysiere die Integrationsanforderungen und schätze den Aufwand.

INTEGRATION COMPLEXITY GUIDELINES:
- Low: Standard API, gute Docs, SDK vorhanden (4-16h)
- Medium: Custom API, mäßige Docs, Mapping erforderlich (16-40h)
- High: Legacy System, schlechte Docs, Custom Entwicklung (40-100h)

COMMON INTEGRATION TYPES:
- CRM: Salesforce, HubSpot, Microsoft Dynamics (meist medium)
- ERP: SAP, Oracle, Microsoft (meist high)
- Marketing: Mailchimp, Marketo, Eloqua (meist low-medium)
- Analytics: GA, Adobe Analytics, Matomo (meist low)
- Payment: Stripe, PayPal, Adyen (meist medium)
- Auth: SAML, OAuth, LDAP (meist medium)
- Search: Elasticsearch, Algolia, Solr (meist medium)`;

  const prompt = `Analysiere die Integrationsanforderungen für den folgenden Lead:

LEAD DATEN:
- Kunde: ${leadData.customerName}
- Branche: ${leadData.industry || 'Unbekannt'}
- Website: ${leadData.websiteUrl || 'Nicht bekannt'}

QUICK SCAN DATEN:
- Erkannte Integrationen: ${JSON.stringify(quickScanData?.integrations, null, 2)}
- Tech Stack: ${JSON.stringify(quickScanData?.techStack, null, 2)}
- Features: ${JSON.stringify(quickScanData?.features, null, 2)}

Erstelle eine Integrations-Analyse mit:
1. Liste aller Integrationen mit Aufwand
2. System Landscape Übersicht
3. Summary mit Gesamtaufwand
4. Risikobewertung
5. Empfehlungen

Wenn keine Integrationen erkannt wurden, schätze basierend auf der Branche typische Integrationen.`;

  const result = await generateStructuredOutput({
    schema: IntegrationsAnalysisSchema,
    system,
    prompt,
    temperature: 0.3,
  });

  // 4. Store in RAG
  const chunkText = `Integrations Analysis: ${leadData.customerName}

Summary:
- Total Integrations: ${result.summary.totalIntegrations}
- Total Effort: ${result.summary.totalEffort}h
- High Complexity: ${result.summary.highComplexityCount}
- Medium Complexity: ${result.summary.mediumComplexityCount}
- Low Complexity: ${result.summary.lowComplexityCount}

Integrations:
${result.integrations.map(i => `- ${i.name} (${i.vendor}): ${i.complexity} complexity, ~${i.effort}h`).join('\n')}

System Landscape:
- Primary Systems: ${result.systemLandscape.primarySystems.join(', ')}
- Authentication: ${result.systemLandscape.authentication.method} ${result.systemLandscape.authentication.sso ? '(SSO)' : ''}

Risks:
${result.integrationRisks.map(r => `- ${r.integration}: ${r.risk}`).join('\n')}

Recommendations:
${result.recommendations.map(r => `- ${r}`).join('\n')}`;

  const chunks = [
    {
      chunkIndex: 0,
      content: chunkText,
      tokenCount: Math.ceil(chunkText.length / 4),
      metadata: {
        startPosition: 0,
        endPosition: chunkText.length,
        type: 'section' as const,
      },
    },
  ];

  const chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);

  if (chunksWithEmbeddings && chunksWithEmbeddings.length > 0) {
    await db.insert(dealEmbeddings).values({
      qualificationId: leadId,
      preQualificationId: rfpId,
      agentName: 'integrations',
      chunkType: 'analysis',
      chunkIndex: 0,
      content: chunkText,
      embedding: JSON.stringify(chunksWithEmbeddings[0].embedding),
      metadata: JSON.stringify({
        totalIntegrations: result.summary.totalIntegrations,
        totalEffort: result.summary.totalEffort,
        highComplexityCount: result.summary.highComplexityCount,
        confidence: result.confidence,
      }),
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely parse JSON string
 */
function safeParseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
