/**
 * Hosting Agent (Phase 2.4)
 *
 * Analyzes hosting infrastructure and recommends Azure options.
 *
 * Features:
 * - Current infrastructure detection
 * - Azure hosting recommendations
 * - Cost estimation for hosting
 * - Scalability assessment
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { pitches, leadScans, dealEmbeddings } from '@/lib/db/schema';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hosting recommendation schema
 */
export const HostingRecommendationSchema = z.object({
  provider: z.string().describe('Recommended hosting provider'),
  tier: z.string().describe('Recommended tier (e.g., Basic, Standard, Premium)'),
  services: z.array(z.string()).describe('Specific services/products'),
  estimatedMonthlyCost: z.number().describe('Estimated monthly cost in EUR'),
  scalability: z.enum(['limited', 'moderate', 'high', 'auto']).describe('Scalability level'),
  reasoning: z.string().describe('Why this recommendation'),
});

export type HostingRecommendation = z.infer<typeof HostingRecommendationSchema>;

/**
 * Hosting analysis result schema
 */
export const HostingAnalysisSchema = z.object({
  // Current Infrastructure
  currentInfrastructure: z.object({
    detectedProvider: z.string().nullable().describe('Current hosting provider'),
    detectedServices: z.array(z.string()).describe('Detected services'),
    estimatedTraffic: z.string().describe('Estimated traffic level'),
    currentArchitecture: z.string().describe('Current architecture type'),
  }),

  // Recommended Setup
  recommendation: HostingRecommendationSchema,

  // Alternative Options
  alternatives: z.array(HostingRecommendationSchema).describe('Alternative hosting options'),

  // Requirements
  requirements: z.object({
    minCPU: z.string().describe('Minimum CPU requirements'),
    minRAM: z.string().describe('Minimum RAM requirements'),
    storage: z.string().describe('Storage requirements'),
    cdn: z.boolean().describe('CDN needed'),
    ssl: z.boolean().describe('SSL certificate needed'),
    backup: z.string().describe('Backup requirements'),
  }),

  // Risk Assessment
  migrationRisk: z.object({
    level: z.enum(['low', 'medium', 'high']).describe('Migration risk level'),
    factors: z.array(z.string()).describe('Risk factors'),
    mitigation: z.array(z.string()).describe('Mitigation strategies'),
  }),

  // Confidence
  confidence: z.number().min(0).max(100).describe('Analysis confidence'),
});

export type HostingAnalysis = z.infer<typeof HostingAnalysisSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run hosting agent
 *
 * @param leadId - Lead ID
 * @param preQualificationId - Qualification ID
 * @returns Hosting analysis with recommendations
 */
export async function runHostingAgent(
  leadId: string,
  preQualificationId: string
): Promise<HostingAnalysis> {
  // 1. Fetch lead and Quick Scan data
  const [leadData] = await db
    .select({
      customerName: pitches.customerName,
      websiteUrl: pitches.websiteUrl,
      qualificationScanId: pitches.qualificationScanId,
    })
    .from(pitches)
    .where(eq(pitches.id, leadId))
    .limit(1);

  if (!leadData) {
    throw new Error(`Lead ${leadId} not found`);
  }

  // 2. Fetch Quick Scan data
  let qualificationScanData: {
    hosting: string | null;
    techStack: unknown;
    pageCount: number | null;
    performanceIndicators: unknown;
  } | null = null;

  if (leadData.qualificationScanId) {
    const [qs] = await db
      .select({
        hosting: leadScans.hosting,
        techStack: leadScans.techStack,
        pageCount: leadScans.pageCount,
        performanceIndicators: leadScans.performanceIndicators,
      })
      .from(leadScans)
      .where(eq(leadScans.id, leadData.qualificationScanId))
      .limit(1);

    if (qs) {
      qualificationScanData = {
        hosting: qs.hosting,
        techStack: safeParseJson(qs.techStack),
        pageCount: qs.pageCount,
        performanceIndicators: safeParseJson(qs.performanceIndicators),
      };
    }
  }

  // 3. Generate analysis with AI
  const system = `Du bist ein Cloud Infrastructure Analyst für adesso SE.
Analysiere die Hosting-Anforderungen und erstelle Azure-Empfehlungen.

KONTEXT:
- adesso ist Microsoft Azure Partner
- Primäre Empfehlung sollte Azure sein
- Alternativen können AWS, GCP oder andere sein

AZURE TIERS FÜR CMS:
- Basic: Azure App Service Basic (kleine Sites, <10k visits/mo) ~50-100€/mo
- Standard: Azure App Service Standard + Azure Database (mittelgroße Sites) ~150-300€/mo
- Premium: Azure App Service Premium + Redis + CDN (große Sites, >100k visits/mo) ~400-800€/mo
- Enterprise: AKS + Azure Database Premium + CDN + WAF (Enterprise Sites) ~1000-2500€/mo`;

  const prompt = `Analysiere die Hosting-Anforderungen für den folgenden Lead:

LEAD DATEN:
- Kunde: ${leadData.customerName}
- Website: ${leadData.websiteUrl || 'Nicht bekannt'}

QUICK SCAN DATEN:
- Erkanntes Hosting: ${qualificationScanData?.hosting || 'Unbekannt'}
- Tech Stack: ${JSON.stringify(qualificationScanData?.techStack, null, 2)}
- Seitenzahl: ${qualificationScanData?.pageCount || 'Unbekannt'}
- Performance: ${JSON.stringify(qualificationScanData?.performanceIndicators, null, 2)}

Erstelle eine Hosting-Analyse mit:
1. Aktuelle Infrastruktur Bewertung
2. Azure Empfehlung (primär)
3. 2-3 Alternativen
4. Technische Anforderungen
5. Migrations-Risikobewertung`;

  const result = await generateStructuredOutput({
    schema: HostingAnalysisSchema,
    system,
    prompt,
    temperature: 0.3,
  });

  // 4. Store in RAG
  const chunkText = `Hosting Analysis: ${leadData.customerName}

Current Infrastructure:
- Provider: ${result.currentInfrastructure.detectedProvider || 'Unknown'}
- Traffic: ${result.currentInfrastructure.estimatedTraffic}
- Architecture: ${result.currentInfrastructure.currentArchitecture}

Recommendation: ${result.recommendation.provider} (${result.recommendation.tier})
- Services: ${result.recommendation.services.join(', ')}
- Monthly Cost: ~${result.recommendation.estimatedMonthlyCost}€
- Scalability: ${result.recommendation.scalability}
- Reason: ${result.recommendation.reasoning}

Requirements:
- CPU: ${result.requirements.minCPU}
- RAM: ${result.requirements.minRAM}
- Storage: ${result.requirements.storage}
- CDN: ${result.requirements.cdn ? 'Required' : 'Optional'}

Migration Risk: ${result.migrationRisk.level}
${result.migrationRisk.factors.map(f => `- ${f}`).join('\n')}`;

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
      pitchId: leadId,
      preQualificationId: preQualificationId,
      agentName: 'hosting',
      chunkType: 'analysis',
      chunkIndex: 0,
      content: chunkText,
      embedding: chunksWithEmbeddings[0].embedding,
      metadata: JSON.stringify({
        recommendedProvider: result.recommendation.provider,
        monthlyEstimate: result.recommendation.estimatedMonthlyCost,
        migrationRisk: result.migrationRisk.level,
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
