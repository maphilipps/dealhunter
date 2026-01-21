import { generateStructuredOutput } from '@/lib/ai/config';
import { z } from 'zod';
import type { MigrationComplexity, TechStack, ContentTypeDistribution } from '../schema';

/**
 * Migration Analyzer Tool
 * Estimates migration complexity based on tech stack, content, and features
 */

// AI analysis result schema
const aiAnalysisResultSchema = z.object({
  score: z.number().min(0).max(100),
  recommendation: z.enum(['easy', 'moderate', 'complex', 'very_complex']),
  warnings: z.array(z.string()),
  opportunities: z.array(z.string()).optional(),
  estimatedEffort: z
    .object({
      minPT: z.number(),
      maxPT: z.number(),
      confidence: z.number().min(0).max(100),
    })
    .optional(),
});

type AIAnalysisResult = z.infer<typeof aiAnalysisResultSchema>;

interface MigrationAnalysisInput {
  techStack: Partial<TechStack>;
  pageCount: number;
  contentTypes?: ContentTypeDistribution;
  features?: {
    ecommerce: boolean;
    userAccounts: boolean;
    multiLanguage: boolean;
    search: boolean;
    forms: boolean;
    api: boolean;
  };
  html?: string;
}

// CMS Export Capabilities Database
const CMS_EXPORT_CAPABILITIES: Record<
  string,
  {
    hasRestApi: boolean;
    hasXmlExport: boolean;
    hasCli: boolean;
    exportScore: number;
    knownExportMethods: string[];
    notes?: string;
  }
> = {
  wordpress: {
    hasRestApi: true,
    hasXmlExport: true,
    hasCli: true,
    exportScore: 90,
    knownExportMethods: ['WP-CLI', 'REST API', 'XML Export', 'wp-json'],
    notes: 'WP-CLI und REST API verfügbar',
  },
  drupal: {
    hasRestApi: true,
    hasXmlExport: true,
    hasCli: true,
    exportScore: 95,
    knownExportMethods: ['Drush CLI', 'JSON:API', 'Views Data Export', 'Migrate API'],
    notes: 'Drush CLI und JSON:API verfügbar',
  },
  typo3: {
    hasRestApi: true,
    hasXmlExport: true,
    hasCli: true,
    exportScore: 85,
    knownExportMethods: ['T3 CLI', 'REST API', 'Backend Export'],
    notes: 'T3 CLI verfügbar, aber komplexere Struktur',
  },
  joomla: {
    hasRestApi: true,
    hasXmlExport: true,
    hasCli: false,
    exportScore: 70,
    knownExportMethods: ['REST API', 'Export Extensions'],
    notes: 'REST API vorhanden, kein CLI',
  },
  contao: {
    hasRestApi: false,
    hasXmlExport: true,
    hasCli: false,
    exportScore: 50,
    knownExportMethods: ['XML Export'],
    notes: 'Nur XML Export, begrenzte API',
  },
  shopify: {
    hasRestApi: true,
    hasXmlExport: false,
    hasCli: false,
    exportScore: 75,
    knownExportMethods: ['Shopify API', 'CSV Export', 'GraphQL'],
    notes: 'REST API gut, aber Vendor Lock-In',
  },
  wix: {
    hasRestApi: false,
    hasXmlExport: false,
    hasCli: false,
    exportScore: 20,
    knownExportMethods: ['Scraping'],
    notes: 'Kein Export möglich - Scraping erforderlich',
  },
  squarespace: {
    hasRestApi: false,
    hasXmlExport: false,
    hasCli: false,
    exportScore: 15,
    knownExportMethods: ['Scraping', 'Minimal XML'],
    notes: 'Minimaler Export - Scraping erforderlich',
  },
  sitecore: {
    hasRestApi: true,
    hasXmlExport: true,
    hasCli: true,
    exportScore: 80,
    knownExportMethods: ['Sitecore CLI', 'REST API', 'Serialization'],
    notes: 'Enterprise-Tools vorhanden, aber komplex',
  },
  'adobe aem': {
    hasRestApi: true,
    hasXmlExport: true,
    hasCli: true,
    exportScore: 75,
    knownExportMethods: ['AEM CLI', 'Content Packages', 'Sling API'],
    notes: 'Gute APIs, aber komplexe Struktur',
  },
  contentful: {
    hasRestApi: true,
    hasXmlExport: true,
    hasCli: true,
    exportScore: 95,
    knownExportMethods: ['Contentful CLI', 'Management API', 'Export Tool'],
    notes: 'Headless CMS - voller API-Zugriff',
  },
  strapi: {
    hasRestApi: true,
    hasXmlExport: true,
    hasCli: true,
    exportScore: 95,
    knownExportMethods: ['REST API', 'GraphQL', 'Strapi CLI'],
    notes: 'Headless CMS - voller API-Zugriff',
  },
  custom: {
    hasRestApi: false,
    hasXmlExport: false,
    hasCli: false,
    exportScore: 30,
    knownExportMethods: [],
    notes: 'Unbekanntes System - manuelle Analyse erforderlich',
  },
};

/**
 * Get CMS export capabilities
 */
function getCmsCapabilities(cmsName?: string): {
  hasRestApi: boolean;
  hasXmlExport: boolean;
  hasCli: boolean;
  score: number;
  knownExportMethods: string[];
  notes?: string;
} {
  if (!cmsName) {
    return {
      hasRestApi: false,
      hasXmlExport: false,
      hasCli: false,
      score: 30,
      knownExportMethods: [],
      notes: 'CMS nicht erkannt',
    };
  }

  const normalizedName = cmsName.toLowerCase();

  for (const [key, capabilities] of Object.entries(CMS_EXPORT_CAPABILITIES)) {
    if (normalizedName.includes(key)) {
      return {
        hasRestApi: capabilities.hasRestApi,
        hasXmlExport: capabilities.hasXmlExport,
        hasCli: capabilities.hasCli,
        score: capabilities.exportScore,
        knownExportMethods: capabilities.knownExportMethods,
        notes: capabilities.notes,
      };
    }
  }

  return {
    hasRestApi: false,
    hasXmlExport: false,
    hasCli: false,
    score: 30,
    knownExportMethods: [],
    notes: 'CMS nicht in Datenbank',
  };
}

/**
 * Estimate content complexity from features and page count
 */
function estimateContentComplexity(
  pageCount: number,
  features?: MigrationAnalysisInput['features'],
  contentTypes?: ContentTypeDistribution
): {
  score: number;
  embeddedMedia: boolean;
  complexLayouts: boolean;
  customFields?: number;
  richTextComplexity: 'simple' | 'moderate' | 'complex';
  notes?: string;
} {
  let score = 30; // Base score

  // Page count impact
  if (pageCount > 1000) score += 30;
  else if (pageCount > 500) score += 20;
  else if (pageCount > 100) score += 10;

  // Content type complexity
  const uniqueTypes = contentTypes?.estimatedContentTypes || 5;
  if (uniqueTypes > 10) score += 20;
  else if (uniqueTypes > 6) score += 10;

  // Feature impact
  const embeddedMedia = features?.ecommerce || false;
  const complexLayouts = features?.multiLanguage || false;

  if (embeddedMedia) score += 15;
  if (complexLayouts) score += 10;
  if (features?.forms) score += 5;

  // Determine rich text complexity based on features and content types
  let richTextComplexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (embeddedMedia || features?.forms || uniqueTypes > 8) {
    richTextComplexity = 'complex';
  } else if (complexLayouts || uniqueTypes > 5) {
    richTextComplexity = 'moderate';
  }

  return {
    score: Math.min(100, score),
    embeddedMedia,
    complexLayouts,
    customFields: contentTypes?.customFieldsNeeded,
    richTextComplexity,
    notes: score > 70 ? 'Hohe Komplexität - detaillierte Analyse empfohlen' : undefined,
  };
}

/**
 * Estimate integration complexity
 */
function estimateIntegrationComplexity(
  features?: MigrationAnalysisInput['features'],
  techStack?: Partial<TechStack>
): {
  score: number;
  externalApis: number;
  ssoRequired: boolean;
  thirdPartyPlugins?: number;
  integrationList: string[];
  notes?: string;
} {
  let score = 20; // Base score
  let externalApis = 0;
  const integrationList: string[] = [];

  // API usage
  if (features?.api) {
    externalApis++;
    score += 15;
    integrationList.push('Custom API');
  }

  // E-Commerce
  if (features?.ecommerce) {
    externalApis += 2; // Payment, Inventory
    score += 25;
    integrationList.push('Payment Gateway', 'Inventory System');
  }

  // SSO/User accounts
  const ssoRequired = features?.userAccounts || false;
  if (ssoRequired) {
    score += 20;
    integrationList.push('User Authentication/SSO');
  }

  // Search
  if (features?.search) {
    externalApis++;
    score += 5;
    integrationList.push('Search Service');
  }

  // Analytics tools
  const analyticsTools = techStack?.analytics || [];
  for (const tool of analyticsTools) {
    externalApis++;
    integrationList.push(`Analytics: ${tool}`);
  }

  // Marketing tools
  const marketingTools = techStack?.marketing || [];
  for (const tool of marketingTools) {
    externalApis++;
    integrationList.push(`Marketing: ${tool}`);
  }

  return {
    score: Math.min(100, score),
    externalApis,
    ssoRequired,
    thirdPartyPlugins: marketingTools.length + analyticsTools.length,
    integrationList: integrationList.slice(0, 15), // Limit to 15 entries
    notes: externalApis > 5 ? 'Viele externe Integrationen - API-Mapping erforderlich' : undefined,
  };
}

/**
 * Analyze migration complexity
 */
export async function analyzeMigrationComplexity(
  input: MigrationAnalysisInput
): Promise<MigrationComplexity> {
  // Get CMS capabilities
  const cmsCapabilities = getCmsCapabilities(input.techStack.cms);

  // Estimate data quality (simplified - would need more analysis)
  const cleanupRequired: 'minimal' | 'moderate' | 'significant' =
    cmsCapabilities.score > 70
      ? 'minimal'
      : cmsCapabilities.score > 40
        ? 'moderate'
        : 'significant';

  const dataQuality = {
    score: cmsCapabilities.score > 70 ? 80 : 50,
    inconsistentStructure: !cmsCapabilities.hasRestApi,
    cleanupRequired,
    notes: cmsCapabilities.score < 50 ? 'Keine strukturierte Exportmöglichkeit' : undefined,
  };

  // Estimate content complexity
  const contentComplexity = estimateContentComplexity(
    input.pageCount,
    input.features,
    input.contentTypes
  );

  // Estimate integration complexity
  const integrationComplexity = estimateIntegrationComplexity(input.features, input.techStack);

  // Calculate overall score
  const weights = {
    cmsExportability: 0.3,
    dataQuality: 0.2,
    contentComplexity: 0.3,
    integrationComplexity: 0.2,
  };

  // Invert CMS exportability score (higher export = lower complexity)
  const cmsComplexityScore = 100 - cmsCapabilities.score;

  const overallScore = Math.round(
    cmsComplexityScore * weights.cmsExportability +
      (100 - dataQuality.score) * weights.dataQuality +
      contentComplexity.score * weights.contentComplexity +
      integrationComplexity.score * weights.integrationComplexity
  );

  // Determine recommendation
  let recommendation: MigrationComplexity['recommendation'];
  if (overallScore < 30) recommendation = 'easy';
  else if (overallScore < 50) recommendation = 'moderate';
  else if (overallScore < 70) recommendation = 'complex';
  else recommendation = 'very_complex';

  // Generate warnings
  const warnings: string[] = [];

  if (!cmsCapabilities.hasRestApi) {
    warnings.push('Kein REST API erkannt - Scraping oder manueller Export erforderlich');
  }
  if (input.pageCount > 500 && !cmsCapabilities.hasCli) {
    warnings.push(`${input.pageCount} Seiten ohne CLI-Tool - zeitaufwändiger Export erwartet`);
  }
  if (integrationComplexity.ssoRequired) {
    warnings.push('Benutzerkonten vorhanden - SSO-Migration beachten');
  }
  if (input.features?.ecommerce) {
    warnings.push('E-Commerce-Integration - Zahlungsanbieter und Produktdaten migrieren');
  }
  if (input.features?.multiLanguage) {
    warnings.push('Mehrsprachige Website - Übersetzungsworkflow planen');
  }

  // Generate opportunities
  const opportunities: string[] = [];

  if (contentComplexity.score > 50) {
    opportunities.push('Content-Audit während Migration durchführen');
  }
  if (!input.features?.search) {
    opportunities.push('Suche mit modernem Such-Service verbessern');
  }
  if (cmsCapabilities.score < 70) {
    opportunities.push('Headless CMS-Architektur in Betracht ziehen');
  }

  // Estimate effort (rough PT calculation)
  const basePT = Math.ceil(input.pageCount / 20); // ~20 pages per PT
  const complexityMultiplier = 1 + overallScore / 100;
  const minPT = Math.max(5, Math.ceil(basePT * (complexityMultiplier - 0.2)));
  const maxPT = Math.ceil(basePT * (complexityMultiplier + 0.3));

  // Generate assumptions for effort estimation
  const assumptions: string[] = [
    `${input.pageCount} Seiten geschätzt`,
    `~20 Seiten pro PT als Basis`,
    `Komplexitätsfaktor: ${complexityMultiplier.toFixed(2)}`,
  ];
  if (input.features?.ecommerce) assumptions.push('E-Commerce-Migration inkludiert');
  if (input.features?.multiLanguage) assumptions.push('Mehrsprachige Inhalte inkludiert');
  if (cmsCapabilities.hasRestApi) assumptions.push('API-basierter Export möglich');
  else assumptions.push('Manueller/Scraping-Export angenommen');

  return {
    score: overallScore,
    recommendation,
    factors: {
      cmsExportability: {
        score: cmsCapabilities.score,
        hasRestApi: cmsCapabilities.hasRestApi,
        hasXmlExport: cmsCapabilities.hasXmlExport,
        hasCli: cmsCapabilities.hasCli,
        knownExportMethods: cmsCapabilities.knownExportMethods,
        notes: cmsCapabilities.notes,
      },
      dataQuality: {
        score: dataQuality.score,
        inconsistentStructure: dataQuality.inconsistentStructure,
        cleanupRequired: dataQuality.cleanupRequired,
        notes: dataQuality.notes,
      },
      contentComplexity: {
        score: contentComplexity.score,
        embeddedMedia: contentComplexity.embeddedMedia,
        customFields: contentComplexity.customFields,
        complexLayouts: contentComplexity.complexLayouts,
        richTextComplexity: contentComplexity.richTextComplexity,
        notes: contentComplexity.notes,
      },
      integrationComplexity: {
        score: integrationComplexity.score,
        externalApis: integrationComplexity.externalApis,
        ssoRequired: integrationComplexity.ssoRequired,
        thirdPartyPlugins: integrationComplexity.thirdPartyPlugins,
        integrationList: integrationComplexity.integrationList,
        notes: integrationComplexity.notes,
      },
    },
    warnings,
    opportunities,
    estimatedEffort: {
      minPT,
      maxPT,
      confidence: Math.max(30, 80 - overallScore / 2), // Lower confidence for complex projects
      assumptions,
    },
  };
}

/**
 * AI-powered deep migration analysis
 */
export async function analyzeWithAI(
  input: MigrationAnalysisInput & { html?: string }
): Promise<MigrationComplexity> {
  // First get basic analysis
  const basicAnalysis = await analyzeMigrationComplexity(input);

  // If we have HTML, enhance with AI
  if (!input.html) {
    return basicAnalysis;
  }

  const systemPrompt = `Du bist ein CMS-Migrations-Experte. Analysiere die Website und gib eine detaillierte Migrationseinschätzung.
Antworte mit validem JSON.`;

  const userPrompt = `Analysiere diese Website für eine CMS-Migration:

Tech Stack:
${JSON.stringify(input.techStack, null, 2)}

Seitenanzahl: ${input.pageCount}

Content-Typen:
${input.contentTypes ? JSON.stringify(input.contentTypes, null, 2) : 'Nicht klassifiziert'}

Features:
${input.features ? JSON.stringify(input.features, null, 2) : 'Nicht erkannt'}

HTML-Auszug (Homepage):
${input.html?.slice(0, 3000) || 'Nicht verfügbar'}

Vorläufige Analyse:
- Score: ${basicAnalysis.score}/100
- Empfehlung: ${basicAnalysis.recommendation}
- Warnings: ${basicAnalysis.warnings.join(', ')}

Verfeinere die Analyse und gib zurück:
- score: Komplexitäts-Score 0-100
- recommendation: easy|moderate|complex|very_complex
- warnings: Liste von Warnungen
- opportunities: Liste von Verbesserungsmöglichkeiten
- estimatedEffort: { minPT, maxPT, confidence }`;

  try {
    const aiAnalysis = await generateStructuredOutput<typeof aiAnalysisResultSchema>({
      schema: aiAnalysisResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Merge AI analysis with basic analysis
    return {
      ...basicAnalysis,
      score: Math.round((basicAnalysis.score + aiAnalysis.score) / 2),
      recommendation: aiAnalysis.recommendation,
      warnings: [...new Set([...basicAnalysis.warnings, ...aiAnalysis.warnings])],
      opportunities: aiAnalysis.opportunities || basicAnalysis.opportunities,
      estimatedEffort: aiAnalysis.estimatedEffort || basicAnalysis.estimatedEffort,
    };
  } catch (error) {
    console.error('AI migration analysis failed:', error);
    return basicAnalysis;
  }
}
