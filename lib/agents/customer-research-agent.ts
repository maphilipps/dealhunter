/**
 * Customer Research Agent (DEA-140 Phase 2.1)
 *
 * Deep customer analysis agent that enriches lead data with:
 * - Company profile from Quick Scan + web research
 * - Decision makers and their roles
 * - IT budget indicators and digital maturity
 * - Recent news and strategic initiatives
 *
 * Uses:
 * - Quick Scan data as baseline
 * - Exa API for web research (news, financials)
 * - RAG integration for storage and retrieval
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
 * Decision maker schema
 */
export const DecisionMakerSchema = z.object({
  name: z.string().describe('Full name'),
  role: z.string().describe('Job title/role'),
  department: z.string().optional().describe('Department (IT, Marketing, etc.)'),
  influence: z.enum(['high', 'medium', 'low']).describe('Influence on decision'),
  contactInfo: z
    .object({
      email: z.string().optional(),
      linkedin: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional().describe('Additional notes about this person'),
});

export type DecisionMaker = z.infer<typeof DecisionMakerSchema>;

/**
 * Company profile schema
 */
export const CompanyProfileSchema = z.object({
  name: z.string(),
  industry: z.string(),
  subIndustry: z.string().optional(),
  size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).describe('Company size'),
  employeeCount: z.string().optional().describe('Approximate employee count'),
  foundedYear: z.number().optional(),
  headquarters: z.string().optional(),
  description: z.string().describe('Brief company description'),
  website: z.string().optional(),
  parentCompany: z.string().optional(),
  subsidiaries: z.array(z.string()).optional(),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

/**
 * IT landscape and budget indicators
 */
export const ITLandscapeSchema = z.object({
  currentCMS: z.string().optional().describe('Current CMS system'),
  techStack: z.array(z.string()).describe('Known technologies'),
  cloudProvider: z.string().optional().describe('Primary cloud provider'),
  digitalMaturity: z
    .enum(['low', 'medium', 'high', 'advanced'])
    .describe('Digital transformation maturity'),
  budgetIndicators: z.object({
    estimatedITBudget: z.string().optional().describe('Estimated annual IT budget'),
    recentInvestments: z.array(z.string()).optional().describe('Recent IT investments'),
    budgetTrend: z.enum(['increasing', 'stable', 'decreasing', 'unknown']).optional(),
  }),
  painPoints: z.array(z.string()).describe('Identified IT pain points'),
  strategicInitiatives: z.array(z.string()).describe('Known digital initiatives'),
});

export type ITLandscape = z.infer<typeof ITLandscapeSchema>;

/**
 * News and recent developments
 */
export const CompanyNewsSchema = z.object({
  recentNews: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      date: z.string().optional(),
      source: z.string().optional(),
      relevance: z.enum(['high', 'medium', 'low']),
    })
  ),
  strategicMoves: z.array(z.string()).describe('Recent strategic moves'),
  marketPosition: z.string().optional().describe('Current market position assessment'),
});

export type CompanyNews = z.infer<typeof CompanyNewsSchema>;

/**
 * Full customer research result
 */
export const CustomerResearchResultSchema = z.object({
  companyProfile: CompanyProfileSchema,
  decisionMakers: z.array(DecisionMakerSchema),
  itLandscape: ITLandscapeSchema,
  news: CompanyNewsSchema,
  confidence: z.number().min(0).max(100).describe('Overall confidence score'),
  dataSources: z.array(z.string()).describe('Sources used for research'),
  summary: z.string().describe('Executive summary of customer research'),
  recommendedApproach: z.string().describe('Recommended sales approach'),
});

export type CustomerResearchResult = z.infer<typeof CustomerResearchResultSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// WEB RESEARCH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

interface ExaSearchResult {
  url: string;
  title: string;
  text?: string;
  highlights?: string[];
}

/**
 * Search for company information using Exa API
 */
async function searchCompanyInfo(
  companyName: string,
  query: string
): Promise<ExaSearchResult[] | null> {
  const exaApiKey = process.env.EXA_API_KEY;

  if (!exaApiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${exaApiKey}`,
      },
      body: JSON.stringify({
        query: `${companyName} ${query}`,
        numResults: 5,
        useAutoprompt: true,
        type: 'neural',
        contents: {
          text: true,
          highlights: true,
        },
      }),
    });

    if (!response.ok) {
      console.warn('[CustomerResearch] Exa API error:', response.status);
      return null;
    }

    const data = (await response.json()) as { results: ExaSearchResult[] };
    return data.results;
  } catch (error) {
    console.warn('[CustomerResearch] Exa search failed:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run customer research agent
 *
 * @param leadId - Lead ID
 * @param preQualificationId - Pre-Qualification ID
 * @returns Customer research results
 */
export async function runCustomerResearchAgent(
  leadId: string,
  preQualificationId: string
): Promise<CustomerResearchResult> {
  // 1. Fetch lead and quick scan data
  const [leadData] = await db
    .select({
      customerName: qualifications.customerName,
      industry: qualifications.industry,
      websiteUrl: qualifications.websiteUrl,
      projectDescription: qualifications.projectDescription,
      quickScanId: qualifications.quickScanId,
    })
    .from(qualifications)
    .where(eq(qualifications.id, leadId))
    .limit(1);

  if (!leadData) {
    throw new Error(`Lead ${leadId} not found`);
  }

  // 2. Get Quick Scan data if available
  let quickScanData: {
    companyIntelligence: string | null;
    decisionMakers: string | null;
    techStack: string | null;
    cms: string | null;
    migrationComplexity: string | null;
  } | null = null;

  if (leadData.quickScanId) {
    const [qs] = await db
      .select({
        companyIntelligence: quickScans.companyIntelligence,
        decisionMakers: quickScans.decisionMakers,
        techStack: quickScans.techStack,
        cms: quickScans.cms,
        migrationComplexity: quickScans.migrationComplexity,
      })
      .from(quickScans)
      .where(eq(quickScans.id, leadData.quickScanId))
      .limit(1);

    quickScanData = qs || null;
  }

  // 3. Perform web research in parallel
  const [newsResults, financialResults, techResults] = await Promise.all([
    searchCompanyInfo(leadData.customerName, 'news announcements 2024 2025'),
    searchCompanyInfo(leadData.customerName, 'IT budget digital transformation investment'),
    searchCompanyInfo(leadData.customerName, 'technology stack website CMS'),
  ]);

  // 4. Prepare context for AI synthesis
  const researchContext = {
    leadInfo: {
      customerName: leadData.customerName,
      industry: leadData.industry,
      websiteUrl: leadData.websiteUrl,
      projectDescription: leadData.projectDescription,
    },
    quickScan: quickScanData
      ? {
          companyIntelligence: safeParseJson(quickScanData.companyIntelligence),
          decisionMakers: safeParseJson(quickScanData.decisionMakers),
          techStack: safeParseJson(quickScanData.techStack),
          currentCMS: quickScanData.cms,
          migrationComplexity: safeParseJson(quickScanData.migrationComplexity),
        }
      : null,
    webResearch: {
      news:
        newsResults?.map(r => ({
          title: r.title,
          snippet: r.highlights?.[0] || r.text?.slice(0, 300),
        })) || [],
      financial:
        financialResults?.map(r => ({
          title: r.title,
          snippet: r.highlights?.[0] || r.text?.slice(0, 300),
        })) || [],
      tech:
        techResults?.map(r => ({
          title: r.title,
          snippet: r.highlights?.[0] || r.text?.slice(0, 300),
        })) || [],
    },
  };

  // 5. Generate structured output with AI
  const system = `Du bist ein Business Development Research Agent für adesso SE.
Deine Aufgabe ist es, Kundeninformationen zu analysieren und strukturiert aufzubereiten.

KONTEXT:
- adesso ist ein IT-Dienstleister mit Fokus auf CMS-Migrationen (vor allem Drupal)
- Du analysierst potenzielle Kunden für Projektanfragen
- Die Informationen werden für die Angebotserstellung verwendet

WICHTIG:
- Nutze nur Informationen aus den bereitgestellten Daten
- Bei fehlenden Daten: schätze basierend auf Branche und Größe
- Sei präzise bei Confidence-Scores
- Empfehle konkrete Sales-Ansätze`;

  const prompt = `Analysiere die folgenden Kundeninformationen und erstelle ein vollständiges Customer Research Profil:

KUNDENDATEN:
${JSON.stringify(researchContext, null, 2)}

Erstelle ein strukturiertes Profil mit:
1. Company Profile (Größe, Branche, Beschreibung)
2. Decision Makers (aus Quick Scan oder geschätzt nach Branche)
3. IT Landscape (Tech Stack, Budget-Indikatoren, Pain Points)
4. News & Strategic Moves
5. Recommended Sales Approach

Setze den Confidence-Score basierend auf Datenverfügbarkeit:
- 80-100: Umfassende Quick Scan + Web Research Daten
- 60-79: Gute Quick Scan ODER Web Research Daten
- 40-59: Nur Basisdaten verfügbar
- 0-39: Kaum Daten, hauptsächlich Schätzungen`;

  const result = await generateStructuredOutput({
    schema: CustomerResearchResultSchema,
    system,
    prompt,
    temperature: 0.3,
  });

  // 6. Store results in RAG
  const chunkText = `Customer Research: ${leadData.customerName}

${result.summary}

Company Profile:
- Industry: ${result.companyProfile.industry}
- Size: ${result.companyProfile.size}
- Description: ${result.companyProfile.description}

IT Landscape:
- Digital Maturity: ${result.itLandscape.digitalMaturity}
- Current CMS: ${result.itLandscape.currentCMS || 'Unknown'}
- Tech Stack: ${result.itLandscape.techStack.join(', ')}
- Pain Points: ${result.itLandscape.painPoints.join(', ')}

Decision Makers:
${result.decisionMakers.map(dm => `- ${dm.name} (${dm.role}) - Influence: ${dm.influence}`).join('\n')}

Recommended Approach: ${result.recommendedApproach}`;

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
      preQualificationId: preQualificationId,
      agentName: 'customer-research',
      chunkType: 'analysis',
      chunkIndex: 0,
      content: chunkText,
      embedding: chunksWithEmbeddings[0].embedding,
      metadata: JSON.stringify({
        confidence: result.confidence,
        dataSources: result.dataSources,
        companySize: result.companyProfile.size,
        digitalMaturity: result.itLandscape.digitalMaturity,
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
