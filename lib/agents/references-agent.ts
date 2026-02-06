/**
 * References Agent (DEA-150)
 *
 * Recommends relevant reference projects for a lead based on industry and technology match.
 * Uses 2-factor scoring: industry similarity + technology overlap.
 *
 * Features:
 * - Database query for approved references
 * - 2-factor scoring algorithm
 * - AI-powered reasoning for recommendations
 * - RAG integration for storage
 */

import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { pitches, references, dealEmbeddings } from '@/lib/db/schema';
import { queryRagForLead, formatLeadContext } from '@/lib/rag/lead-retrieval-service';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reference recommendation schema
 */
export const ReferenceRecommendationSchema = z.object({
  referenceId: z.string(),
  projectName: z.string(),
  customerName: z.string(),
  industry: z.string(),
  technologies: z.array(z.string()),
  teamSize: z.number(),
  durationMonths: z.number(),
  budgetRange: z.string(),
  outcome: z.string(),
  highlights: z.array(z.string()).optional(),

  // Scoring
  industryScore: z.number().min(0).max(100).describe('Industry match score'),
  technologyScore: z.number().min(0).max(100).describe('Technology overlap score'),
  overallScore: z.number().min(0).max(100).describe('Combined relevance score'),

  // AI Reasoning
  matchReason: z.string().describe('Why this reference is a good match'),
  keyStrengths: z.array(z.string()).describe('Key strengths of this reference'),
  relevantAspects: z.array(z.string()).describe('Aspects relevant to the lead'),
});

export type ReferenceRecommendation = z.infer<typeof ReferenceRecommendationSchema>;

/**
 * References agent result schema
 */
export const ReferencesResultSchema = z.object({
  recommendations: z.array(ReferenceRecommendationSchema),
  totalReferencesScanned: z.number(),
  topMatchesCount: z.number(),
  avgMatchScore: z.number(),
  summary: z.string().describe('Executive summary of recommendations'),
  selectionCriteria: z.array(z.string()).describe('Criteria used for selection'),
});

export type ReferencesResult = z.infer<typeof ReferencesResultSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate industry match score
 * Uses exact match, partial match, and semantic similarity
 */
function calculateIndustryScore(leadIndustry: string | null, refIndustry: string): number {
  if (!leadIndustry) return 50; // Default score if no industry specified

  const leadNorm = leadIndustry.toLowerCase().trim();
  const refNorm = refIndustry.toLowerCase().trim();

  // Exact match
  if (leadNorm === refNorm) return 100;

  // Partial match (one contains the other)
  if (leadNorm.includes(refNorm) || refNorm.includes(leadNorm)) return 80;

  // Related industries
  const industryGroups: Record<string, string[]> = {
    tech: ['software', 'technology', 'it', 'digital', 'saas', 'tech'],
    finance: ['banking', 'finance', 'insurance', 'fintech', 'financial'],
    health: ['healthcare', 'medical', 'pharma', 'health', 'hospital'],
    retail: ['ecommerce', 'retail', 'commerce', 'shop', 'store'],
    education: ['education', 'edtech', 'university', 'school', 'learning'],
    government: ['government', 'public sector', 'municipality', 'city'],
  };

  for (const [_, industries] of Object.entries(industryGroups)) {
    const leadMatch = industries.some(i => leadNorm.includes(i));
    const refMatch = industries.some(i => refNorm.includes(i));
    if (leadMatch && refMatch) return 60;
  }

  return 30; // No match
}

/**
 * Calculate technology overlap score
 * Compares lead's required technologies with reference's technologies
 */
function calculateTechnologyScore(leadTechnologies: string[], refTechnologies: string[]): number {
  if (leadTechnologies.length === 0) return 50; // Default if no tech requirements
  if (refTechnologies.length === 0) return 30; // Reference has no tech info

  const leadNorm = new Set(leadTechnologies.map(t => t.toLowerCase().trim()));
  const refNorm = new Set(refTechnologies.map(t => t.toLowerCase().trim()));

  // Calculate Jaccard-like overlap
  let matches = 0;
  for (const tech of leadNorm) {
    // Check exact match or partial match
    for (const refTech of refNorm) {
      if (tech === refTech || tech.includes(refTech) || refTech.includes(tech)) {
        matches++;
        break;
      }
    }
  }

  // Score based on coverage
  const coverage = matches / leadNorm.size;
  return Math.round(coverage * 100);
}

/**
 * Calculate combined score with weighting
 */
function calculateOverallScore(industryScore: number, technologyScore: number): number {
  // Weight: 40% industry, 60% technology
  return Math.round(industryScore * 0.4 + technologyScore * 0.6);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run references recommendation agent for a lead
 *
 * Flow:
 * 1. Fetch lead data (industry, requirements)
 * 2. Query RAG for technology requirements
 * 3. Fetch all approved references from DB
 * 4. Score and rank references
 * 5. Generate AI reasoning for top matches
 * 6. Store results in RAG
 *
 * @param leadId - Lead ID to analyze
 * @param preQualificationId - Qualification ID for RAG storage
 * @returns Reference recommendations
 */
export async function runReferencesAgent(
  leadId: string,
  preQualificationId: string
): Promise<ReferencesResult> {
  console.error(`[References Agent] Starting analysis for lead ${leadId}`);

  try {
    // 1. Fetch lead data
    const leadData = await db
      .select({
        customerName: pitches.customerName,
        industry: pitches.industry,
        requirements: pitches.requirements,
      })
      .from(pitches)
      .where(eq(pitches.id, leadId));

    if (leadData.length === 0) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const lead = leadData[0];

    // 2. Query RAG for technology requirements
    const ragResults = await queryRagForLead({
      pitchId: leadId,
      question: 'Technology stack, technical requirements, CMS, frameworks, programming languages',
      agentNameFilter: ['technology', 'qualification_scan'],
      maxResults: 5,
    });

    const ragContext = formatLeadContext(ragResults, false);

    // Extract technologies from requirements and RAG context
    const leadTechnologies = extractTechnologies(lead.requirements, ragContext);

    console.error(`[References Agent] Lead industry: ${lead.industry}`);
    console.error(`[References Agent] Lead technologies: ${leadTechnologies.join(', ')}`);

    // 3. Fetch all approved references
    const approvedReferences = await db
      .select()
      .from(references)
      .where(and(eq(references.status, 'approved'), eq(references.isValidated, true)));

    console.error(`[References Agent] Found ${approvedReferences.length} approved references`);

    if (approvedReferences.length === 0) {
      return {
        recommendations: [],
        totalReferencesScanned: 0,
        topMatchesCount: 0,
        avgMatchScore: 0,
        summary: 'No approved reference projects available in the database.',
        selectionCriteria: ['Industry match', 'Technology overlap'],
      };
    }

    // 4. Score and rank references
    const scoredReferences = approvedReferences.map(ref => {
      const refTechnologies = parseJsonArray(ref.technologies);
      const industryScore = calculateIndustryScore(lead.industry, ref.industry);
      const technologyScore = calculateTechnologyScore(leadTechnologies, refTechnologies);
      const overallScore = calculateOverallScore(industryScore, technologyScore);

      return {
        ...ref,
        technologies: refTechnologies,
        highlights: parseJsonArray(ref.highlights),
        industryScore,
        technologyScore,
        overallScore,
      };
    });

    // Sort by overall score descending
    scoredReferences.sort((a, b) => b.overallScore - a.overallScore);

    // Take top 5 recommendations
    const topReferences = scoredReferences.slice(0, 5);

    // 5. Generate AI reasoning for top matches
    const recommendations = await generateRecommendationReasons(
      lead.customerName,
      lead.industry || 'general',
      leadTechnologies,
      topReferences
    );

    // Calculate summary stats
    const avgMatchScore =
      recommendations.length > 0
        ? Math.round(
            recommendations.reduce((sum, r) => sum + r.overallScore, 0) / recommendations.length
          )
        : 0;

    const result: ReferencesResult = {
      recommendations,
      totalReferencesScanned: approvedReferences.length,
      topMatchesCount: recommendations.length,
      avgMatchScore,
      summary: generateSummary(recommendations, lead.industry || 'general'),
      selectionCriteria: [
        'Industry similarity (40% weight)',
        'Technology stack overlap (60% weight)',
        'Project outcome and success',
        'Team size and duration relevance',
      ],
    };

    console.error(
      `[References Agent] Analysis complete. Top ${recommendations.length} matches, avg score: ${avgMatchScore}`
    );

    // 6. Store in RAG
    await storeInRAG(preQualificationId, leadId, result);

    return result;
  } catch (error) {
    console.error('[References Agent] Error:', error);
    throw error;
  }
}

/**
 * Extract technologies from requirements and RAG context
 */
function extractTechnologies(requirementsJson: string | null, ragContext: string): string[] {
  const technologies = new Set<string>();

  // Common technology keywords to look for
  const techKeywords = [
    'drupal',
    'wordpress',
    'typo3',
    'contentful',
    'strapi',
    'sanity',
    'react',
    'vue',
    'angular',
    'next.js',
    'nuxt',
    'svelte',
    'node.js',
    'python',
    'php',
    'java',
    'ruby',
    'go',
    'rust',
    'aws',
    'azure',
    'gcp',
    'vercel',
    'netlify',
    'postgresql',
    'mysql',
    'mongodb',
    'redis',
    'docker',
    'kubernetes',
    'terraform',
    'graphql',
    'rest',
    'api',
    'tailwind',
    'bootstrap',
    'sass',
    'css',
    'typescript',
    'javascript',
  ];

  // Parse requirements JSON
  if (requirementsJson) {
    try {
      const requirements: unknown = JSON.parse(requirementsJson);
      if (Array.isArray(requirements)) {
        (requirements as unknown[]).forEach(req => {
          if (typeof req === 'string') {
            const lower = req.toLowerCase();
            techKeywords.forEach(keyword => {
              if (lower.includes(keyword)) {
                technologies.add(keyword);
              }
            });
          }
        });
      }
    } catch {
      // Not valid JSON, treat as string
      const lower = requirementsJson.toLowerCase();
      techKeywords.forEach(keyword => {
        if (lower.includes(keyword)) {
          technologies.add(keyword);
        }
      });
    }
  }

  // Extract from RAG context
  if (ragContext) {
    const lower = ragContext.toLowerCase();
    techKeywords.forEach(keyword => {
      if (lower.includes(keyword)) {
        technologies.add(keyword);
      }
    });
  }

  return Array.from(technologies);
}

/**
 * Parse JSON array safely
 */
function parseJsonArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Generate AI reasoning for recommendations
 */
async function generateRecommendationReasons(
  leadCustomerName: string,
  leadIndustry: string,
  leadTechnologies: string[],
  topReferences: Array<{
    id: string;
    projectName: string;
    customerName: string;
    industry: string;
    technologies: string[];
    teamSize: number;
    durationMonths: number;
    budgetRange: string;
    outcome: string;
    highlights: string[];
    industryScore: number;
    technologyScore: number;
    overallScore: number;
  }>
): Promise<ReferenceRecommendation[]> {
  if (topReferences.length === 0) return [];

  const systemPrompt = `You are an expert at matching reference projects to new business opportunities.
For each reference project, explain why it's a good match and identify key strengths.

Be concise but specific. Focus on actionable insights.`;

  const referenceSummaries = topReferences
    .map(
      (ref, i) =>
        `Reference ${i + 1}: ${ref.projectName}
Customer: ${ref.customerName}
Industry: ${ref.industry}
Technologies: ${ref.technologies.join(', ')}
Team: ${ref.teamSize} people, ${ref.durationMonths} months
Budget: ${ref.budgetRange}
Outcome: ${ref.outcome}
Highlights: ${ref.highlights.join(', ') || 'None'}
Scores: Industry ${ref.industryScore}%, Tech ${ref.technologyScore}%, Overall ${ref.overallScore}%`
    )
    .join('\n\n');

  const userPrompt = `Generate match reasons for these reference projects for a new lead:

Lead Details:
- Customer: ${leadCustomerName}
- Industry: ${leadIndustry}
- Required Technologies: ${leadTechnologies.join(', ') || 'Not specified'}

${referenceSummaries}

For each reference, provide:
1. matchReason: Why this is a good match (1-2 sentences)
2. keyStrengths: 2-3 key strengths
3. relevantAspects: 2-3 aspects relevant to the lead`;

  const reasoningSchema = z.object({
    references: z.array(
      z.object({
        index: z.number(),
        matchReason: z.string(),
        keyStrengths: z.array(z.string()),
        relevantAspects: z.array(z.string()),
      })
    ),
  });

  try {
    const reasoning = await generateStructuredOutput({
      model: 'fast',
      schema: reasoningSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
    });

    // Merge reasoning with scored references
    return topReferences.map((ref, index) => {
      const reason = reasoning.references.find(r => r.index === index) || {
        matchReason: 'Good industry and technology match.',
        keyStrengths: ['Relevant experience', 'Proven outcomes'],
        relevantAspects: ['Similar project scope'],
      };

      return {
        referenceId: ref.id,
        projectName: ref.projectName,
        customerName: ref.customerName,
        industry: ref.industry,
        technologies: ref.technologies,
        teamSize: ref.teamSize,
        durationMonths: ref.durationMonths,
        budgetRange: ref.budgetRange,
        outcome: ref.outcome,
        highlights: ref.highlights,
        industryScore: ref.industryScore,
        technologyScore: ref.technologyScore,
        overallScore: ref.overallScore,
        matchReason: reason.matchReason,
        keyStrengths: reason.keyStrengths,
        relevantAspects: reason.relevantAspects,
      };
    });
  } catch (error) {
    console.error('[References Agent] AI reasoning failed:', error);
    // Return without AI reasoning
    return topReferences.map(ref => ({
      referenceId: ref.id,
      projectName: ref.projectName,
      customerName: ref.customerName,
      industry: ref.industry,
      technologies: ref.technologies,
      teamSize: ref.teamSize,
      durationMonths: ref.durationMonths,
      budgetRange: ref.budgetRange,
      outcome: ref.outcome,
      highlights: ref.highlights,
      industryScore: ref.industryScore,
      technologyScore: ref.technologyScore,
      overallScore: ref.overallScore,
      matchReason:
        `Good match based on ${ref.industryScore >= 60 ? 'industry similarity' : ''} ${ref.technologyScore >= 60 ? 'and technology overlap' : ''}.`.trim(),
      keyStrengths: ['Relevant experience'],
      relevantAspects: ['Similar project characteristics'],
    }));
  }
}

/**
 * Generate executive summary
 */
function generateSummary(recommendations: ReferenceRecommendation[], leadIndustry: string): string {
  if (recommendations.length === 0) {
    return `No matching reference projects found for the ${leadIndustry} industry.`;
  }

  const topMatch = recommendations[0];
  const avgScore = Math.round(
    recommendations.reduce((sum, r) => sum + r.overallScore, 0) / recommendations.length
  );

  return (
    `Found ${recommendations.length} relevant reference projects for ${leadIndustry}. ` +
    `Top recommendation: "${topMatch.projectName}" (${topMatch.customerName}) with ${topMatch.overallScore}% match score. ` +
    `Average match score across all recommendations: ${avgScore}%.`
  );
}

/**
 * Store references results in RAG
 */
async function storeInRAG(
  preQualificationId: string,
  leadId: string,
  result: ReferencesResult
): Promise<void> {
  try {
    const recommendationDetails = result.recommendations
      .map(
        (r, i) =>
          `${i + 1}. ${r.projectName} (${r.customerName})
   Industry: ${r.industry} (${r.industryScore}% match)
   Technologies: ${r.technologies.join(', ')} (${r.technologyScore}% match)
   Overall Score: ${r.overallScore}%
   Match Reason: ${r.matchReason}
   Key Strengths: ${r.keyStrengths.join(', ')}`
      )
      .join('\n\n');

    const chunkText = `Reference Project Recommendations

${result.summary}

Selection Criteria:
${result.selectionCriteria.map(c => `- ${c}`).join('\n')}

Total References Scanned: ${result.totalReferencesScanned}
Top Matches: ${result.topMatchesCount}
Average Match Score: ${result.avgMatchScore}%

Recommended References:
${recommendationDetails || 'No recommendations available.'}`;

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
        preQualificationId: preQualificationId,
        agentName: 'references',
        chunkType: 'analysis',
        chunkIndex: 0,
        content: chunkText,
        embedding: chunksWithEmbeddings[0].embedding,
        metadata: JSON.stringify({
          leadId,
          topMatchesCount: result.topMatchesCount,
          avgMatchScore: result.avgMatchScore,
          totalScanned: result.totalReferencesScanned,
        }),
      });

      console.error('[References Agent] Stored results in RAG');
    }
  } catch (error) {
    console.error('[References Agent] Failed to store in RAG:', error);
  }
}
