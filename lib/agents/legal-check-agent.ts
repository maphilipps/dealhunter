/**
 * Legal Check Agent (DEA-149)
 *
 * Performs industry-specific legal compliance analysis for leads.
 * Checks for GDPR, Cookie Consent, Impressum, Privacy Policy and other requirements.
 *
 * Features:
 * - Single-pass analysis with generateObject for efficiency
 * - Industry-specific compliance rules
 * - RAG integration for context
 * - Structured output with confidence scores
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { leads, dealEmbeddings } from '@/lib/db/schema';
import { queryRagForLead, formatLeadContext } from '@/lib/rag/lead-retrieval-service';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Individual compliance item schema
 */
export const ComplianceItemSchema = z.object({
  requirement: z.string().describe('Name of the legal requirement'),
  status: z.enum(['compliant', 'non_compliant', 'unknown', 'not_applicable']),
  evidence: z.string().optional().describe('Evidence or URL where found'),
  recommendation: z.string().optional().describe('Improvement suggestion if non-compliant'),
});

export type ComplianceItem = z.infer<typeof ComplianceItemSchema>;

/**
 * Legal check result schema - used with generateObject
 */
export const LegalCheckResultSchema = z.object({
  // GDPR Compliance
  gdprCompliance: z.object({
    hasPrivacyPolicy: ComplianceItemSchema,
    hasCookieConsent: ComplianceItemSchema,
    dataProcessingAgreement: ComplianceItemSchema,
    rightToErasure: ComplianceItemSchema,
    dataPortability: ComplianceItemSchema,
  }),

  // German Legal Requirements
  germanLaw: z.object({
    hasImpressum: ComplianceItemSchema,
    impressumComplete: ComplianceItemSchema,
    agbAvailable: ComplianceItemSchema,
    widerrufsbelehrung: ComplianceItemSchema,
  }),

  // Industry-Specific
  industrySpecific: z.array(ComplianceItemSchema).describe('Industry-specific requirements'),

  // Summary
  overallRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  complianceScore: z.number().min(0).max(100),
  criticalIssues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type LegalCheckResult = z.infer<typeof LegalCheckResultSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// INDUSTRY RULES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Industry-specific compliance requirements
 */
const INDUSTRY_REQUIREMENTS: Record<string, string[]> = {
  healthcare: [
    'HIPAA compliance (if US data)',
    'Patient data protection',
    'Medical device regulations',
    'Telemedicine licensing',
  ],
  finance: [
    'PCI-DSS for payment data',
    'KYC/AML requirements',
    'Financial reporting standards',
    'Investment advice disclaimers',
  ],
  ecommerce: [
    'Consumer protection laws',
    'Return/refund policy',
    'Price transparency',
    'Product safety compliance',
  ],
  education: [
    'Student data protection (FERPA if US)',
    'Accessibility requirements',
    'Content licensing',
    'Age-appropriate content policies',
  ],
  government: [
    'WCAG 2.1 AA accessibility',
    'Public records compliance',
    'Security standards (BSI)',
    'Transparency requirements',
  ],
  default: ['General business compliance', 'Consumer protection', 'Data protection basics'],
};

/**
 * Get industry-specific requirements
 */
function getIndustryRequirements(industry: string | null): string[] {
  if (!industry) return INDUSTRY_REQUIREMENTS.default;

  const normalizedIndustry = industry.toLowerCase();

  // Check for exact or partial matches
  for (const [key, requirements] of Object.entries(INDUSTRY_REQUIREMENTS)) {
    if (normalizedIndustry.includes(key) || key.includes(normalizedIndustry)) {
      return requirements;
    }
  }

  return INDUSTRY_REQUIREMENTS.default;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run legal check analysis for a lead
 *
 * Flow:
 * 1. Fetch lead data (industry, website URL)
 * 2. Query RAG for existing website analysis
 * 3. Generate structured legal compliance report
 * 4. Store results in RAG
 *
 * @param leadId - Lead ID to analyze
 * @param rfpId - RFP ID for RAG storage
 * @returns Legal check results
 */
export async function runLegalCheckAgent(leadId: string, rfpId: string): Promise<LegalCheckResult> {
  console.error(`[Legal Check Agent] Starting analysis for lead ${leadId}`);

  try {
    // 1. Fetch lead data
    const leadData = await db
      .select({
        customerName: leads.customerName,
        websiteUrl: leads.websiteUrl,
        industry: leads.industry,
      })
      .from(leads)
      .where(eq(leads.id, leadId));

    if (leadData.length === 0) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const lead = leadData[0];
    const industry = lead.industry || 'general';
    const industryRequirements = getIndustryRequirements(industry);

    console.error(`[Legal Check Agent] Industry: ${industry}`);
    console.error(`[Legal Check Agent] Industry requirements: ${industryRequirements.join(', ')}`);

    // 2. Query RAG for existing website analysis
    const ragResults = await queryRagForLead({
      leadId,
      question:
        'Website legal compliance: privacy policy, cookie consent, impressum, terms of service, GDPR, data protection',
      agentNameFilter: ['website-analysis', 'deep-scan-website-analysis', 'component_library'],
      maxResults: 10,
    });

    const ragContext = formatLeadContext(ragResults, true);

    // 3. Build prompt with context
    const systemPrompt = `You are a legal compliance expert specializing in German and EU law.
Analyze the provided website information and assess legal compliance.

IMPORTANT RULES:
- Be thorough but practical
- Flag missing critical elements as "non_compliant"
- If information is insufficient, mark as "unknown"
- Consider the specific industry: ${industry}
- Focus on German legal requirements (Impressum, GDPR, etc.)

Industry-specific requirements to check:
${industryRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;

    const userPrompt = `Analyze the legal compliance for this company's website:

Company: ${lead.customerName || 'Unknown'}
Website: ${lead.websiteUrl || 'Not provided'}
Industry: ${industry}

${ragContext ? `\n--- Existing Website Analysis ---\n${ragContext}` : '\n--- No existing website analysis available ---'}

Please provide a comprehensive legal compliance assessment including:
1. GDPR compliance (privacy policy, cookie consent, data protection)
2. German legal requirements (Impressum, AGB, Widerrufsbelehrung)
3. Industry-specific requirements for ${industry}
4. Overall risk assessment and recommendations`;

    // 4. Generate structured output
    const result = await generateStructuredOutput({
      model: 'quality',
      schema: LegalCheckResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
    });

    console.error(
      `[Legal Check Agent] Analysis complete. Risk level: ${result.overallRiskLevel}, Score: ${result.complianceScore}`
    );

    // 5. Store in RAG
    await storeInRAG(rfpId, leadId, result);

    return result;
  } catch (error) {
    console.error('[Legal Check Agent] Error:', error);
    throw error;
  }
}

/**
 * Store legal check results in RAG
 */
async function storeInRAG(rfpId: string, leadId: string, result: LegalCheckResult): Promise<void> {
  try {
    // Build searchable content
    const criticalIssuesText =
      result.criticalIssues.length > 0
        ? `Critical Issues:\n${result.criticalIssues.map(i => `- ${i}`).join('\n')}`
        : 'No critical issues found.';

    const recommendationsText =
      result.recommendations.length > 0
        ? `Recommendations:\n${result.recommendations.map(r => `- ${r}`).join('\n')}`
        : 'No specific recommendations.';

    const gdprStatus = Object.entries(result.gdprCompliance)
      .map(([key, item]) => `- ${key}: ${item.status}`)
      .join('\n');

    const germanLawStatus = Object.entries(result.germanLaw)
      .map(([key, item]) => `- ${key}: ${item.status}`)
      .join('\n');

    const industryStatus = result.industrySpecific
      .map(item => `- ${item.requirement}: ${item.status}`)
      .join('\n');

    const chunkText = `Legal Compliance Analysis

Overall Risk Level: ${result.overallRiskLevel.toUpperCase()}
Compliance Score: ${result.complianceScore}/100

GDPR Compliance:
${gdprStatus}

German Legal Requirements:
${germanLawStatus}

Industry-Specific Compliance:
${industryStatus || 'No industry-specific checks performed.'}

${criticalIssuesText}

${recommendationsText}`;

    // Generate embedding
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
        rfpId,
        agentName: 'legal_check',
        chunkType: 'analysis',
        chunkIndex: 0,
        content: chunkText,
        embedding: JSON.stringify(chunksWithEmbeddings[0].embedding),
        metadata: JSON.stringify({
          leadId,
          riskLevel: result.overallRiskLevel,
          complianceScore: result.complianceScore,
          criticalIssuesCount: result.criticalIssues.length,
        }),
      });

      console.error('[Legal Check Agent] Stored results in RAG');
    }
  } catch (error) {
    console.error('[Legal Check Agent] Failed to store in RAG:', error);
    // Don't throw - analysis still succeeded
  }
}

/**
 * Get a simple risk summary for display
 */
export function getLegalRiskSummary(result: LegalCheckResult): {
  riskLevel: string;
  riskColor: string;
  score: number;
  criticalCount: number;
} {
  const riskColors: Record<string, string> = {
    low: 'green',
    medium: 'yellow',
    high: 'orange',
    critical: 'red',
  };

  return {
    riskLevel: result.overallRiskLevel,
    riskColor: riskColors[result.overallRiskLevel] || 'gray',
    score: result.complianceScore,
    criticalCount: result.criticalIssues.length,
  };
}
