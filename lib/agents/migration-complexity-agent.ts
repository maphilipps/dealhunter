/**
 * Migration Complexity Agent
 *
 * Analyzes migration complexity based on tech stack and content volume.
 *
 * Complexity Factors:
 * - CMS Type (e.g., Custom CMS = higher complexity)
 * - Tech Stack Age (legacy tech = higher complexity)
 * - Content Volume (more pages = higher complexity)
 * - Custom Features (integrations, custom modules)
 * - Framework Complexity (modern SPA vs traditional)
 */

import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import type { ContentArchitectureResult } from './content-architecture-agent';
import { openai } from '../ai/providers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type MigrationComplexityCategory = 'low' | 'medium' | 'high' | 'very_high';

export interface MigrationRisk {
  category: 'technical' | 'content' | 'integration' | 'timeline' | 'business';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface ComplexityFactor {
  factor: string;
  impact: 'positive' | 'negative';
  score: number; // Contribution to total score
  description: string;
}

export interface MigrationComplexityResult {
  success: boolean;

  // Complexity Assessment
  complexityScore: number; // 0-100
  complexityCategory: MigrationComplexityCategory;

  // Contributing Factors
  factors: ComplexityFactor[];

  // Risks
  risks: MigrationRisk[];

  // Recommendations
  recommendations: string[];

  // Metadata
  analyzedAt: string;
  error?: string;
}

export interface AnalyzeMigrationComplexityInput {
  websiteUrl: string;
  techStack: {
    cms: string | null;
    cmsVersion: string | null;
    framework: string | null;
    backend: string | null;
    database: string | null;
    hosting: string | null;
    server: string | null;
    technologies: string[];
  };
  contentArchitecture: ContentArchitectureResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze migration complexity
 *
 * Uses tech stack and content volume to calculate complexity score and identify risks.
 *
 * @param input - Tech stack and content architecture data
 * @returns Migration complexity analysis
 */
export async function analyzeMigrationComplexity(
  input: AnalyzeMigrationComplexityInput
): Promise<MigrationComplexityResult> {
  console.error(`[Migration Complexity Agent] Starting analysis for ${input.websiteUrl}`);

  try {
    const { websiteUrl, techStack, contentArchitecture } = input;

    // Validate input
    if (!contentArchitecture.success) {
      return {
        success: false,
        complexityScore: 0,
        complexityCategory: 'low',
        factors: [],
        risks: [],
        recommendations: [],
        analyzedAt: new Date().toISOString(),
        error: 'Content architecture analysis failed',
      };
    }

    // Zod schema for AI analysis
    const MigrationComplexityAnalysisSchema = z.object({
      complexityFactors: z.array(
        z.object({
          factor: z.string(),
          impact: z.enum(['positive', 'negative']),
          score: z.number().min(-20).max(20).describe('Score contribution (-20 to +20)'),
          description: z.string(),
        })
      ),
      risks: z.array(
        z.object({
          category: z.enum(['technical', 'content', 'integration', 'timeline', 'business']),
          title: z.string(),
          description: z.string(),
          impact: z.enum(['low', 'medium', 'high']),
          mitigation: z.string(),
        })
      ),
      recommendations: z.array(z.string()).describe('Strategic recommendations for the migration'),
    });

    // Use AI to analyze complexity
    const { object: analysis } = await generateObject({
      model: openai('claude-sonnet-4') as unknown as LanguageModel,
      schema: MigrationComplexityAnalysisSchema,
      prompt: `Analyze the migration complexity for the following website migration.

Website: ${websiteUrl}

**Tech Stack:**
- CMS: ${techStack.cms || 'Unknown'}${techStack.cmsVersion ? ` (v${techStack.cmsVersion})` : ''}
- Framework: ${techStack.framework || 'None detected'}
- Backend: ${techStack.backend || 'Unknown'}
- Database: ${techStack.database || 'Unknown'}
- Hosting: ${techStack.hosting || 'Unknown'}
- Server: ${techStack.server || 'Unknown'}
- Technologies: ${techStack.technologies.join(', ') || 'None detected'}

**Content Architecture:**
- Page Count: ~${contentArchitecture.pageCount} pages
- Confidence: ${contentArchitecture.pageCountConfidence}
- Content Types: ${contentArchitecture.contentTypes.map(ct => `${ct.name} (~${ct.estimatedCount})`).join(', ')}
- Navigation Depth: ${contentArchitecture.navigationStructure.depth} levels
- Images: ~${contentArchitecture.contentVolume.images}
- Videos: ~${contentArchitecture.contentVolume.videos}
- Documents: ~${contentArchitecture.contentVolume.documents}

Target CMS: Drupal (modern headless-capable CMS)

**Analyze:**

1. **Complexity Factors** - Identify factors that affect migration complexity:
   - CMS Type (Custom CMS = higher complexity, standard CMS = lower)
   - Technology Age (Legacy tech = higher complexity)
   - Content Volume (more pages/assets = higher complexity)
   - Custom Features (integrations, custom modules)
   - Framework Complexity (SPA vs traditional)
   - Each factor should have a score contribution (-20 to +20)
   - Negative scores increase complexity
   - Positive scores decrease complexity

2. **Migration Risks** - Identify specific risks:
   - Technical risks (compatibility, data loss, etc.)
   - Content risks (content structure, media migration)
   - Integration risks (3rd-party systems, APIs)
   - Timeline risks (underestimation, scope creep)
   - Business risks (downtime, SEO impact)

3. **Recommendations** - Provide strategic recommendations:
   - Migration approach (Big Bang vs Phased)
   - Priority areas to focus on
   - Risk mitigation strategies
   - Timeline considerations

Be realistic and thorough in your analysis.`,
    });

    console.error('[Migration Complexity Agent] AI analysis completed', {
      factorsCount: analysis.complexityFactors.length,
      risksCount: analysis.risks.length,
    });

    // Calculate complexity score
    const { complexityScore, complexityCategory } = calculateComplexityScore(
      analysis.complexityFactors,
      contentArchitecture.pageCount
    );

    return {
      success: true,
      complexityScore,
      complexityCategory,
      factors: analysis.complexityFactors,
      risks: analysis.risks,
      recommendations: analysis.recommendations,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Migration Complexity Agent] Error:', error);

    return {
      success: false,
      complexityScore: 0,
      complexityCategory: 'low',
      factors: [],
      risks: [],
      recommendations: [],
      analyzedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate complexity score from factors
 *
 * Formula:
 * - Base score: 50 (medium complexity)
 * - Add factor scores (each factor contributes -20 to +20)
 * - Normalize to 0-100 range
 * - Apply page count multiplier for very large sites
 *
 * Score Ranges:
 * - 0-25: Low
 * - 26-50: Medium
 * - 51-75: High
 * - 76-100: Very High
 */
function calculateComplexityScore(
  factors: ComplexityFactor[],
  pageCount: number
): { complexityScore: number; complexityCategory: MigrationComplexityCategory } {
  // Base score (50 = medium complexity)
  let score = 50;

  // Add factor contributions
  for (const factor of factors) {
    score += factor.score;
  }

  // Page count multiplier for very large sites (>10,000 pages)
  if (pageCount > 10000) {
    score += 10; // Significant complexity increase
  } else if (pageCount > 5000) {
    score += 5; // Moderate complexity increase
  }

  // Normalize to 0-100 range
  score = Math.max(0, Math.min(100, score));

  // Determine category
  let complexityCategory: MigrationComplexityCategory;
  if (score <= 25) {
    complexityCategory = 'low';
  } else if (score <= 50) {
    complexityCategory = 'medium';
  } else if (score <= 75) {
    complexityCategory = 'high';
  } else {
    complexityCategory = 'very_high';
  }

  return { complexityScore: Math.round(score), complexityCategory };
}
