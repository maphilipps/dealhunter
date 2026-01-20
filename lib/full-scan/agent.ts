import { generateStructuredOutput } from '@/lib/ai/config';
import { z } from 'zod';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

/**
 * Full-Scan Agent
 *
 * Comprehensive website audit after BL assignment for detailed migration planning.
 * Duration: 10-30 minutes (background job)
 *
 * Analyzes:
 * - Component patterns and complexity
 * - UI patterns and variants
 * - Integration requirements
 * - Migration complexity scoring
 * - Content volume and structure
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const componentAnalysisSchema = z.object({
  patterns: z.array(z.object({
    name: z.string().describe('Component name (e.g., "Hero Banner", "Card Grid")'),
    frequency: z.number().describe('How often this pattern appears'),
    variants: z.number().describe('Number of variations found'),
    complexity: z.enum(['low', 'medium', 'high']).describe('Implementation complexity'),
    examples: z.array(z.string()).describe('Example URLs where pattern appears'),
  })),
  totalComponents: z.number().describe('Total unique component types identified'),
  estimatedComplexity: z.enum(['simple', 'moderate', 'complex', 'very-complex']),
});

const integrationAnalysisSchema = z.object({
  apis: z.array(z.object({
    type: z.string().describe('API type (REST, GraphQL, SOAP, etc.)'),
    purpose: z.string().describe('What this integration is used for'),
    complexity: z.enum(['low', 'medium', 'high']),
    migrationNotes: z.string().describe('Notes for migration'),
  })),
  thirdPartyServices: z.array(z.object({
    name: z.string().describe('Service name (e.g., "Google Analytics", "Stripe")'),
    category: z.string().describe('Category (Analytics, Payment, CRM, etc.)'),
    critical: z.boolean().describe('Is this service critical?'),
  })),
  totalIntegrations: z.number(),
});

const contentVolumeAnalysisSchema = z.object({
  totalPages: z.number().describe('Total number of pages found'),
  pagesByType: z.array(z.object({
    type: z.string().describe('Page type (e.g., "Product", "Article", "Landing Page")'),
    count: z.number().describe('Number of pages of this type'),
    sampleUrls: z.array(z.string()).describe('Example URLs'),
  })),
  contentTypes: z.number().describe('Number of distinct content types'),
  estimatedContentTypes: z.array(z.string()).describe('List of content type names'),
});

const migrationComplexityScoreSchema = z.object({
  score: z.number().min(0).max(100).describe('Migration complexity score (0-100)'),
  level: z.enum(['low', 'medium', 'high', 'very-high']),
  factors: z.array(z.object({
    factor: z.string().describe('Factor name'),
    impact: z.enum(['low', 'medium', 'high']),
    explanation: z.string(),
  })),
  recommendations: z.array(z.string()).describe('Migration recommendations'),
});

export const fullScanResultSchema = z.object({
  components: componentAnalysisSchema,
  integrations: integrationAnalysisSchema,
  contentVolume: contentVolumeAnalysisSchema,
  migrationComplexity: migrationComplexityScoreSchema,
  screenshots: z.array(z.object({
    url: z.string(),
    pageName: z.string(),
    capturedAt: z.string(),
  })).optional(),
  completedAt: z.string(),
  duration: z.number().describe('Scan duration in milliseconds'),
});

export type FullScanResult = z.infer<typeof fullScanResultSchema>;
export type ComponentAnalysis = z.infer<typeof componentAnalysisSchema>;
export type IntegrationAnalysis = z.infer<typeof integrationAnalysisSchema>;
export type ContentVolumeAnalysis = z.infer<typeof contentVolumeAnalysisSchema>;
export type MigrationComplexityScore = z.infer<typeof migrationComplexityScoreSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT INPUT/OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

export interface FullScanInput {
  websiteUrl: string;
  quickScanData?: {
    cms?: string;
    techStack?: string[];
    features?: string[];
  };
  targetCMS?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL-SCAN AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run Full-Scan Agent
 *
 * Performs comprehensive website analysis for migration planning.
 * This is a simulated implementation that prepares the structure for future integration
 * with the website-audit skill and MCP tools.
 *
 * @param input - Website URL and optional quick-scan data
 * @param emit - Optional event emitter for streaming updates
 * @returns Full scan results with component, integration, and complexity analysis
 */
export async function runFullScan(
  input: FullScanInput,
  emit?: EventEmitter
): Promise<FullScanResult> {
  const startTime = Date.now();

  const logProgress = (phase: string, message: string) => {
    console.log(`[FullScan] ${phase}: ${message}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'full-scan',
        message,
      },
    });
  };

  try {
    // Phase 1: Component Analysis (5-10 min)
    logProgress('component-analysis', 'Analyzing UI components and patterns');

    const components = await analyzeComponents(input.websiteUrl, logProgress);

    // Phase 2: Integration Analysis (3-5 min)
    logProgress('integration-analysis', 'Identifying external integrations and APIs');

    const integrations = await analyzeIntegrations(input.websiteUrl, logProgress);

    // Phase 3: Content Volume Analysis (2-4 min)
    logProgress('content-volume', 'Analyzing content structure and volume');

    const contentVolume = await analyzeContentVolume(input.websiteUrl, logProgress);

    // Phase 4: Migration Complexity Scoring (1-2 min)
    logProgress('complexity-scoring', 'Calculating migration complexity score');

    const migrationComplexity = await scoreMigrationComplexity({
      components,
      integrations,
      contentVolume,
      sourceCMS: input.quickScanData?.cms || 'Unknown',
      targetCMS: input.targetCMS || 'Drupal',
    }, logProgress);

    const duration = Date.now() - startTime;

    logProgress('complete', `Full scan completed in ${Math.round(duration / 1000)}s`);

    return {
      components,
      integrations,
      contentVolume,
      migrationComplexity,
      completedAt: new Date().toISOString(),
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FullScan] Error:', errorMessage);

    emit?.({
      type: AgentEventType.ERROR,
      data: {
        error: errorMessage,
        message: `Full scan failed: ${errorMessage}`,
      },
    });

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-AGENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze UI components and patterns
 *
 * In production, this would:
 * 1. Use Chrome DevTools MCP to navigate pages
 * 2. Take screenshots of key pages
 * 3. Analyze DOM structure for component patterns
 * 4. Use AI vision to identify UI patterns
 *
 * For now, this is a placeholder that returns structured data.
 */
async function analyzeComponents(
  websiteUrl: string,
  logProgress: (phase: string, message: string) => void
): Promise<ComponentAnalysis> {
  logProgress('component-analysis', 'Fetching website content');

  // TODO: Implement actual component analysis using MCP chrome-devtools
  // For now, return simulated data structure

  const result = await generateStructuredOutput({
    model: 'default',
    schema: componentAnalysisSchema,
    system: 'You are an expert website analyst specializing in UI component identification and complexity assessment.',
    prompt: `Analyze the website at ${websiteUrl} and identify common UI component patterns.

Based on typical website structures, estimate:
- Common component patterns (headers, footers, cards, grids, forms, etc.)
- Complexity levels
- Frequency of use

Provide a realistic component analysis for a ${websiteUrl} website.`,
  });

  return result;
}

/**
 * Analyze external integrations and APIs
 */
async function analyzeIntegrations(
  websiteUrl: string,
  logProgress: (phase: string, message: string) => void
): Promise<IntegrationAnalysis> {
  logProgress('integration-analysis', 'Scanning for external integrations');

  // TODO: Implement actual integration detection using network analysis

  const result = await generateStructuredOutput({
    model: 'default',
    schema: integrationAnalysisSchema,
    system: 'You are an expert in website integration analysis and third-party service identification.',
    prompt: `Analyze potential external integrations and third-party services for ${websiteUrl}.

Consider common integrations:
- Analytics (Google Analytics, Adobe Analytics)
- Payment processors (Stripe, PayPal)
- CRM systems
- Marketing automation
- Authentication services
- CDN services

Provide a realistic integration analysis.`,
  });

  return result;
}

/**
 * Analyze content volume and structure
 */
async function analyzeContentVolume(
  websiteUrl: string,
  logProgress: (phase: string, message: string) => void
): Promise<ContentVolumeAnalysis> {
  logProgress('content-volume', 'Analyzing content structure');

  // TODO: Implement sitemap parsing and content counting

  const result = await generateStructuredOutput({
    model: 'default',
    schema: contentVolumeAnalysisSchema,
    system: 'You are an expert in content architecture analysis and CMS migration planning.',
    prompt: `Analyze the content volume and structure for ${websiteUrl}.

Estimate:
- Total pages
- Page types (homepage, landing pages, articles, products, etc.)
- Content types needed for CMS migration

Provide a realistic content volume analysis.`,
  });

  return result;
}

/**
 * Calculate migration complexity score
 */
async function scoreMigrationComplexity(
  data: {
    components: ComponentAnalysis;
    integrations: IntegrationAnalysis;
    contentVolume: ContentVolumeAnalysis;
    sourceCMS: string;
    targetCMS: string;
  },
  logProgress: (phase: string, message: string) => void
): Promise<MigrationComplexityScore> {
  logProgress('complexity-scoring', 'Calculating migration complexity');

  const result = await generateStructuredOutput({
    model: 'default',
    schema: migrationComplexityScoreSchema,
    system: 'You are an expert in CMS migration complexity assessment and project planning.',
    prompt: `Calculate migration complexity score for migrating from ${data.sourceCMS} to ${data.targetCMS}.

Context:
- Total Components: ${data.components.totalComponents}
- Component Complexity: ${data.components.estimatedComplexity}
- Total Integrations: ${data.integrations.totalIntegrations}
- Content Pages: ${data.contentVolume.totalPages}
- Content Types: ${data.contentVolume.contentTypes}

Factors to consider:
1. Component Complexity (UI patterns, custom components)
2. Integration Complexity (API count, third-party services)
3. Content Volume (pages, content types)
4. CMS Migration Path (compatibility, data mapping)

Provide a score (0-100) where:
- 0-25: Low complexity (simple migration)
- 26-50: Medium complexity (standard migration)
- 51-75: High complexity (complex migration)
- 76-100: Very high complexity (challenging migration)

Include specific factors and actionable recommendations.`,
  });

  return result;
}
