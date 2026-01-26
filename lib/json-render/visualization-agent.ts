import OpenAI from 'openai';

import { QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT } from './quick-scan-catalog';

import { buildQuestionsWithStatus } from '@/lib/bids/ten-questions';
import type { QuickScan } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import type { QuickScanResult } from '@/lib/quick-scan/agent';
import { parseJsonField } from '@/lib/quick-scan/utils';
import { AI_HUB_API_KEY, AI_HUB_BASE_URL } from '@/lib/ai/config';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: AI_HUB_API_KEY,
  baseURL: AI_HUB_BASE_URL,
});

interface JsonRenderTree {
  root: string | null;
  elements: Record<
    string,
    {
      key: string;
      type: string;
      props: Record<string, unknown>;
      children?: string[];
    }
  >;
}

/**
 * Parse JSONL patches into a tree structure
 */
function parseJsonlPatches(jsonl: string): JsonRenderTree {
  const tree: JsonRenderTree = {
    root: null,
    elements: {},
  };

  const lines = jsonl.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const patch = JSON.parse(line);

      if (patch.op === 'set' && patch.path === '/root') {
        tree.root = patch.value;
      } else if (patch.op === 'add' && patch.path.startsWith('/elements/')) {
        const key = patch.path.replace('/elements/', '');
        tree.elements[key] = patch.value;
      }
    } catch (_e) {
      // Skip invalid JSON lines
      console.warn('Failed to parse JSONL line:', line);
    }
  }

  return tree;
}

/**
 * Quick Scan Visualization Expert Agent
 * Converts Quick Scan results into a json-render tree for dynamic display
 */
export async function generateQuickScanVisualization(
  results: QuickScanResult
): Promise<JsonRenderTree> {
  const userPrompt = `Generate a visualization for these Quick Scan results:

BUSINESS LINE RECOMMENDATION:
- Primary: ${results.blRecommendation.primaryBusinessLine}
- Confidence: ${results.blRecommendation.confidence}%
- Reasoning: ${results.blRecommendation.reasoning}
${results.blRecommendation.alternativeBusinessLines?.length ? `- Alternatives: ${JSON.stringify(results.blRecommendation.alternativeBusinessLines)}` : ''}
${results.blRecommendation.requiredSkills?.length ? `- Required Skills: ${results.blRecommendation.requiredSkills.join(', ')}` : ''}

TECH STACK:
- CMS: ${results.techStack.cms || 'Not detected'} ${results.techStack.cmsVersion ? `v${results.techStack.cmsVersion}` : ''} (${results.techStack.cmsConfidence || 0}% confidence)
- Framework: ${results.techStack.framework || 'Not detected'}
- Backend: ${results.techStack.backend?.join(', ') || 'Not detected'}
- Hosting: ${results.techStack.hosting || 'Not detected'}
- Libraries: ${results.techStack.libraries?.slice(0, 5).join(', ') || 'None detected'}

CONTENT VOLUME:
- Estimated Pages: ${results.contentVolume.estimatedPageCount || 'Unknown'}
- Complexity: ${results.contentVolume.complexity || 'Unknown'}
- Languages: ${results.contentVolume.languages?.join(', ') || 'Unknown'}

FEATURES DETECTED:
- E-commerce: ${results.features.ecommerce ? 'Yes' : 'No'}
- User Accounts: ${results.features.userAccounts ? 'Yes' : 'No'}
- Search: ${results.features.search ? 'Yes' : 'No'}
- Multi-Language: ${results.features.multiLanguage ? 'Yes' : 'No'}
- Blog: ${results.features.blog ? 'Yes' : 'No'}
- Forms: ${results.features.forms ? 'Yes' : 'No'}
- API: ${results.features.api ? 'Yes' : 'No'}

Create a well-organized visualization with the business line recommendation prominently displayed, followed by tech stack, content stats, and features.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        { role: 'system', content: QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse JSONL response into tree
    const tree = parseJsonlPatches(responseText);

    // Validate tree has required structure
    if (!tree.root || Object.keys(tree.elements).length === 0) {
      throw new Error('Invalid visualization tree generated');
    }

    return tree;
  } catch (error) {
    console.error('Visualization agent error:', error);

    // Fallback: Generate a simple static visualization
    return generateFallbackVisualization(results);
  }
}

/**
 * Fallback visualization when AI generation fails
 */
function generateFallbackVisualization(results: QuickScanResult): JsonRenderTree {
  return {
    root: 'main-container',
    elements: {
      'main-container': {
        key: 'main-container',
        type: 'Grid',
        props: { columns: 1, gap: 'md' },
        children: ['recommendation-card', 'tech-card', 'content-card', 'features-card'],
      },
      'recommendation-card': {
        key: 'recommendation-card',
        type: 'ResultCard',
        props: {
          title: 'Empfohlene Business Line',
          variant: 'highlight',
          icon: 'recommendation',
        },
        children: ['recommendation'],
      },
      recommendation: {
        key: 'recommendation',
        type: 'Recommendation',
        props: {
          businessUnit: results.blRecommendation.primaryBusinessLine,
          confidence: results.blRecommendation.confidence,
          reasoning: results.blRecommendation.reasoning,
        },
      },
      'tech-card': {
        key: 'tech-card',
        type: 'ResultCard',
        props: {
          title: 'Tech Stack',
          icon: 'tech',
        },
        children: results.techStack.cms ? ['cms-badge'] : [],
      },
      ...(results.techStack.cms
        ? {
            'cms-badge': {
              key: 'cms-badge',
              type: 'TechBadge',
              props: {
                name: results.techStack.cms,
                version: results.techStack.cmsVersion,
                confidence: results.techStack.cmsConfidence,
                category: 'cms',
              },
            },
          }
        : {}),
      'content-card': {
        key: 'content-card',
        type: 'ResultCard',
        props: {
          title: 'Content & Volumen',
          icon: 'content',
        },
        children: ['content-stats'],
      },
      'content-stats': {
        key: 'content-stats',
        type: 'ContentStats',
        props: {
          pageCount: results.contentVolume.estimatedPageCount,
          complexity: results.contentVolume.complexity,
          languages: results.contentVolume.languages,
        },
      },
      'features-card': {
        key: 'features-card',
        type: 'ResultCard',
        props: {
          title: 'Erkannte Features',
          icon: 'features',
        },
        children: ['feature-list'],
      },
      'feature-list': {
        key: 'feature-list',
        type: 'FeatureList',
        props: {
          features: [
            { name: 'E-Commerce', detected: results.features.ecommerce },
            { name: 'User Accounts', detected: results.features.userAccounts },
            { name: 'Search', detected: results.features.search },
            { name: 'Multi-Language', detected: results.features.multiLanguage },
            { name: 'Blog/News', detected: results.features.blog },
            { name: 'Forms', detected: results.features.forms },
            { name: 'API Integration', detected: results.features.api },
          ],
        },
      },
    },
  };
}

/**
 * Stream visualization generation (for real-time updates)
 */
export async function* streamQuickScanVisualization(
  results: QuickScanResult
): AsyncGenerator<{ type: 'patch'; data: unknown } | { type: 'complete'; tree: JsonRenderTree }> {
  const userPrompt = `Generate a visualization for these Quick Scan results:

BUSINESS LINE RECOMMENDATION:
- Primary: ${results.blRecommendation.primaryBusinessLine}
- Confidence: ${results.blRecommendation.confidence}%
- Reasoning: ${results.blRecommendation.reasoning}

TECH STACK:
- CMS: ${results.techStack.cms || 'Not detected'} (${results.techStack.cmsConfidence || 0}% confidence)
- Framework: ${results.techStack.framework || 'Not detected'}

CONTENT VOLUME:
- Estimated Pages: ${results.contentVolume.estimatedPageCount || 'Unknown'}
- Complexity: ${results.contentVolume.complexity || 'Unknown'}

Create a well-organized visualization.`;

  const stream = await openai.chat.completions.create({
    model: 'gemini-3-flash-preview',
    messages: [
      { role: 'system', content: QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    stream: true,
  });

  const tree: JsonRenderTree = {
    root: null,
    elements: {},
  };

  let buffer = '';

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    buffer += content;

    // Try to parse complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const patch = JSON.parse(line);

        if (patch.op === 'set' && patch.path === '/root') {
          tree.root = patch.value;
        } else if (patch.op === 'add' && patch.path.startsWith('/elements/')) {
          const key = patch.path.replace('/elements/', '');
          tree.elements[key] = patch.value;
        }

        yield { type: 'patch', data: patch };
      } catch {
        // Skip invalid lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const patch = JSON.parse(buffer);
      if (patch.op === 'set' && patch.path === '/root') {
        tree.root = patch.value;
      } else if (patch.op === 'add' && patch.path.startsWith('/elements/')) {
        const key = patch.path.replace('/elements/', '');
        tree.elements[key] = patch.value;
      }
      yield { type: 'patch', data: patch };
    } catch {
      // Ignore
    }
  }

  yield { type: 'complete', tree };
}

// ========================================
// Facts Tab Visualization (Direct Tree Generation)
// ========================================

interface TechStackData {
  cms?: string;
  cmsVersion?: string;
  cmsConfidence?: number;
  framework?: string;
  cssFrameworks?: Array<{ name: string; confidence: number }>;
  javascriptFrameworks?: Array<{ name: string; confidence: number }>;
  analytics?: string[];
  cdn?: string;
  cdnProviders?: string[];
  serverSideRendering?: boolean;
  apiEndpoints?: { rest?: string[]; graphql?: boolean };
}

interface ContentVolumeData {
  estimatedPageCount?: number;
  complexity?: 'low' | 'medium' | 'high';
  languages?: string[];
  sitemapFound?: boolean;
  mediaAssets?: { images?: number; videos?: number; documents?: number };
}

interface FeaturesData {
  ecommerce?: boolean;
  userAccounts?: boolean;
  search?: boolean;
  multiLanguage?: boolean;
  blog?: boolean;
  forms?: boolean;
  api?: boolean;
  mobileApp?: boolean;
  customFeatures?: string[];
}

interface AccessibilityAuditData {
  score: number;
  level?: string;
  criticalIssues: number;
  seriousIssues: number;
  moderateIssues: number;
  minorIssues: number;
  checks?: {
    hasAltTexts?: boolean;
    hasAriaLabels?: boolean;
    hasProperHeadings?: boolean;
    hasSkipLinks?: boolean;
    languageAttribute?: boolean;
    colorContrast?: string;
  };
}

interface SEOAuditData {
  score?: number;
  checks?: {
    hasTitle?: boolean;
    hasMetaDescription?: boolean;
    hasCanonical?: boolean;
    hasRobotsTxt?: boolean;
    hasSitemap?: boolean;
    hasStructuredData?: boolean;
    hasOpenGraph?: boolean;
    mobileViewport?: boolean;
  };
}

interface LegalComplianceData {
  score: number;
  checks?: {
    hasImprint?: boolean;
    hasPrivacyPolicy?: boolean;
    hasCookieBanner?: boolean;
    hasTermsOfService?: boolean;
    hasAccessibilityStatement?: boolean;
  };
  gdprIndicators?: {
    cookieConsentTool?: string;
  };
}

interface PerformanceData {
  estimatedLoadTime?: 'fast' | 'medium' | 'slow';
  resourceCount?: { scripts?: number; stylesheets?: number; images?: number; fonts?: number };
  hasLazyLoading?: boolean;
  hasMinification?: boolean;
  hasCaching?: boolean;
}

interface NavigationData {
  totalItems?: number;
  maxDepth?: number;
  hasSearch?: boolean;
  hasBreadcrumbs?: boolean;
  hasMegaMenu?: boolean;
  mainNav?: Array<{ label: string }>;
}

interface ScreenshotsData {
  homepage?: { desktop?: string; mobile?: string };
  timestamp?: string;
}

interface CompanyIntelligenceData {
  basicInfo?: { name?: string; industry?: string };
  dataQuality?: { confidence?: number; sources?: string[] };
}

interface SiteTreeData {
  totalPages: number;
  maxDepth: number;
  sources?: { sitemap?: number; linkDiscovery?: number };
  sections?: Array<{
    path: string;
    count: number;
    children?: Array<{ path: string; count: number }>;
  }>;
}

interface ContentTypesData {
  estimatedContentTypes?: number;
  distribution?: Array<{ type: string; count: number; percentage: number }>;
  recommendations?: string[];
}

interface DecisionMakersData {
  decisionMakers?: Array<{
    name: string;
    role: string;
    email?: string;
    emailConfidence?: string;
    phone?: string;
    linkedInUrl?: string;
    source?: string;
  }>;
  researchQuality?: { linkedInFound?: number; emailsConfirmed?: number; emailsDerived?: number };
}

interface MigrationComplexityData {
  score: number;
  factors?: {
    cmsExportability?: { score: number; notes?: string };
    dataQuality?: { score: number; notes?: string };
    contentComplexity?: { score: number; notes?: string };
    integrationComplexity?: { score: number; notes?: string };
  };
  estimatedEffort?: { minPT: number; maxPT: number; confidence: number };
}

/**
 * Generate Facts Tab Visualization with AI Agent
 * AI has full creative freedom to design the layout and display ALL available data
 */
export async function generateFactsVisualizationWithAI(
  quickScan: QuickScan,
  extractedData?: ExtractedRequirements | null
): Promise<JsonRenderTree> {
  const techStack = parseJsonField<TechStackData>(quickScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(quickScan.contentVolume);
  const features = parseJsonField<FeaturesData>(quickScan.features);
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit);
  const seoAudit = parseJsonField<SEOAuditData>(quickScan.seoAudit);
  const legalCompliance = parseJsonField<LegalComplianceData>(quickScan.legalCompliance);
  const performanceIndicators = parseJsonField<PerformanceData>(quickScan.performanceIndicators);
  const navigationStructure = parseJsonField<NavigationData>(quickScan.navigationStructure);
  const screenshots = parseJsonField<ScreenshotsData>(quickScan.screenshots);
  const companyIntelligence = parseJsonField<CompanyIntelligenceData>(
    quickScan.companyIntelligence
  );
  const siteTree = parseJsonField<SiteTreeData>(quickScan.siteTree);
  const contentTypes = parseJsonField<ContentTypesData>(quickScan.contentTypes);
  const decisionMakers = parseJsonField<DecisionMakersData>(quickScan.decisionMakers);
  const migrationComplexity = parseJsonField<MigrationComplexityData>(
    quickScan.migrationComplexity
  );
  const questionsData = buildQuestionsWithStatus(quickScan, extractedData);

  // Build complete data prompt - give AI EVERYTHING
  const dataPrompt = `
Du hast VOLLE KREATIVE FREIHEIT für das Layout! Nutze Grid mit 2-3 Spalten, gruppiere sinnvoll, mache es visuell ansprechend.

ALLE VERFÜGBAREN DATEN (zeige ALLES an was Daten hat):

=== ÜBERSICHT ===
Website: ${quickScan.websiteUrl}
Empfohlene Business Unit: ${quickScan.recommendedBusinessUnit || 'Nicht bestimmt'}
Confidence: ${quickScan.confidence || 0}%
Status: ${quickScan.status}

=== 10 FRAGEN ===
Projekt-Typ: ${questionsData.projectType || 'unbekannt'}
Beantwortet: ${questionsData.summary.answered}/${questionsData.summary.total}
${questionsData.questions.map(q => `- [${q.answered ? '✓' : '○'}] ${q.question}${q.answer ? ` → ${q.answer}` : ''}`).join('\n')}

=== TECH STACK ===
${
  techStack
    ? `
CMS: ${techStack.cms || 'Nicht erkannt'}${techStack.cmsVersion ? ` v${techStack.cmsVersion}` : ''} (${techStack.cmsConfidence || 0}% confidence)
Framework: ${techStack.framework || 'Nicht erkannt'}
CSS Frameworks: ${techStack.cssFrameworks?.map(f => `${f.name} (${f.confidence}%)`).join(', ') || 'Keine'}
JS Frameworks: ${techStack.javascriptFrameworks?.map(f => `${f.name} (${f.confidence}%)`).join(', ') || 'Keine'}
Analytics: ${techStack.analytics?.join(', ') || 'Keine'}
CDN: ${techStack.cdn || techStack.cdnProviders?.join(', ') || 'Nicht erkannt'}
Server-Side Rendering: ${techStack.serverSideRendering !== undefined ? (techStack.serverSideRendering ? 'Ja' : 'Nein') : 'Unbekannt'}
API Endpoints: ${techStack.apiEndpoints?.rest?.length ? `${techStack.apiEndpoints.rest.length} REST` : ''} ${techStack.apiEndpoints?.graphql ? 'GraphQL' : ''}
`
    : 'Keine Tech-Stack Daten'
}

=== CONTENT & VOLUMEN ===
${
  contentVolume
    ? `
Geschätzte Seiten: ${contentVolume.estimatedPageCount || 'Unbekannt'}
Komplexität: ${contentVolume.complexity || 'Unbekannt'}
Sprachen: ${contentVolume.languages?.join(', ') || 'Nicht erkannt'}
Sitemap gefunden: ${contentVolume.sitemapFound ? 'Ja' : 'Nein'}
Media Assets: ${contentVolume.mediaAssets ? `${contentVolume.mediaAssets.images || 0} Bilder, ${contentVolume.mediaAssets.videos || 0} Videos, ${contentVolume.mediaAssets.documents || 0} Dokumente` : 'Unbekannt'}
`
    : 'Keine Content-Daten'
}

=== FEATURES ===
${
  features
    ? `
E-Commerce: ${features.ecommerce ? '✓' : '✗'}
User Accounts: ${features.userAccounts ? '✓' : '✗'}
Suche: ${features.search ? '✓' : '✗'}
Mehrsprachig: ${features.multiLanguage ? '✓' : '✗'}
Blog/News: ${features.blog ? '✓' : '✗'}
Formulare: ${features.forms ? '✓' : '✗'}
API: ${features.api ? '✓' : '✗'}
Mobile App: ${features.mobileApp ? '✓' : '✗'}
Custom Features: ${features.customFeatures?.join(', ') || 'Keine'}
`
    : 'Keine Feature-Daten'
}

=== ACCESSIBILITY AUDIT ===
${
  accessibilityAudit
    ? `
Score: ${accessibilityAudit.score}/100
WCAG Level: ${accessibilityAudit.level || 'Nicht bestimmt'}
Kritische Issues: ${accessibilityAudit.criticalIssues}
Schwerwiegende Issues: ${accessibilityAudit.seriousIssues}
Moderate Issues: ${accessibilityAudit.moderateIssues}
Geringe Issues: ${accessibilityAudit.minorIssues}
${accessibilityAudit.checks ? `Checks: Alt-Texte: ${accessibilityAudit.checks.hasAltTexts ? '✓' : '✗'}, ARIA: ${accessibilityAudit.checks.hasAriaLabels ? '✓' : '✗'}, Headings: ${accessibilityAudit.checks.hasProperHeadings ? '✓' : '✗'}, Skip Links: ${accessibilityAudit.checks.hasSkipLinks ? '✓' : '✗'}` : ''}
`
    : 'Kein Accessibility Audit'
}

=== SEO AUDIT ===
${
  seoAudit
    ? `
Score: ${seoAudit.score !== undefined ? `${seoAudit.score}/100` : 'Nicht berechnet'}
${
  seoAudit.checks
    ? `
Title: ${seoAudit.checks.hasTitle ? '✓' : '✗'}
Meta Description: ${seoAudit.checks.hasMetaDescription ? '✓' : '✗'}
Canonical: ${seoAudit.checks.hasCanonical ? '✓' : '✗'}
robots.txt: ${seoAudit.checks.hasRobotsTxt ? '✓' : '✗'}
Sitemap: ${seoAudit.checks.hasSitemap ? '✓' : '✗'}
Schema.org: ${seoAudit.checks.hasStructuredData ? '✓' : '✗'}
Open Graph: ${seoAudit.checks.hasOpenGraph ? '✓' : '✗'}
Mobile Viewport: ${seoAudit.checks.mobileViewport ? '✓' : '✗'}
`
    : ''
}
`
    : 'Kein SEO Audit'
}

=== LEGAL / DSGVO ===
${
  legalCompliance
    ? `
Score: ${legalCompliance.score}/100
${
  legalCompliance.checks
    ? `
Impressum: ${legalCompliance.checks.hasImprint ? '✓' : '✗'}
Datenschutz: ${legalCompliance.checks.hasPrivacyPolicy ? '✓' : '✗'}
Cookie Banner: ${legalCompliance.checks.hasCookieBanner ? '✓' : '✗'}
AGB: ${legalCompliance.checks.hasTermsOfService ? '✓' : '✗'}
Barrierefreiheit: ${legalCompliance.checks.hasAccessibilityStatement ? '✓' : '✗'}
`
    : ''
}
Cookie Tool: ${legalCompliance.gdprIndicators?.cookieConsentTool || 'Nicht erkannt'}
`
    : 'Keine Legal-Daten'
}

=== PERFORMANCE ===
${
  performanceIndicators
    ? `
Ladezeit: ${performanceIndicators.estimatedLoadTime || 'Unbekannt'}
Scripts: ${performanceIndicators.resourceCount?.scripts || 0}
Stylesheets: ${performanceIndicators.resourceCount?.stylesheets || 0}
Bilder: ${performanceIndicators.resourceCount?.images || 0}
Fonts: ${performanceIndicators.resourceCount?.fonts || 0}
Lazy Loading: ${performanceIndicators.hasLazyLoading !== undefined ? (performanceIndicators.hasLazyLoading ? '✓' : '✗') : '?'}
Minification: ${performanceIndicators.hasMinification !== undefined ? (performanceIndicators.hasMinification ? '✓' : '✗') : '?'}
Caching: ${performanceIndicators.hasCaching !== undefined ? (performanceIndicators.hasCaching ? '✓' : '✗') : '?'}
`
    : 'Keine Performance-Daten'
}

=== NAVIGATION ===
${
  navigationStructure
    ? `
Total Items: ${navigationStructure.totalItems || 0}
Max Tiefe: ${navigationStructure.maxDepth || 0}
Haupt-Navigation: ${navigationStructure.mainNav?.map(n => n.label).join(', ') || 'Nicht erkannt'}
Suche: ${navigationStructure.hasSearch ? '✓' : '✗'}
Breadcrumbs: ${navigationStructure.hasBreadcrumbs ? '✓' : '✗'}
Mega Menu: ${navigationStructure.hasMegaMenu ? '✓' : '✗'}
`
    : 'Keine Navigation-Daten'
}

=== SEITENSTRUKTUR (Site Tree) ===
${
  siteTree
    ? `
Gesamte Seiten: ${siteTree.totalPages}
Max Tiefe: ${siteTree.maxDepth}
Aus Sitemap: ${siteTree.sources?.sitemap || 0}
Entdeckt: ${siteTree.sources?.linkDiscovery || 0}
${siteTree.sections?.length ? `Sections:\n${siteTree.sections.map(s => `  ${s.path}: ${s.count} Seiten${s.children?.length ? ` (${s.children.length} Unterverzeichnisse)` : ''}`).join('\n')}` : ''}
`
    : 'Keine Seitenstruktur-Daten'
}

=== CONTENT-TYP-VERTEILUNG ===
${
  contentTypes
    ? `
Geschätzte Content Types: ${contentTypes.estimatedContentTypes || 0}
${contentTypes.distribution?.length ? `Verteilung:\n${contentTypes.distribution.map(d => `  ${d.type}: ${d.count} (${d.percentage}%)`).join('\n')}` : ''}
${contentTypes.recommendations?.length ? `Empfehlungen: ${contentTypes.recommendations.join(', ')}` : ''}
`
    : 'Keine Content-Typ-Daten'
}

=== ENTSCHEIDUNGSTRÄGER ===
${
  decisionMakers?.decisionMakers?.length
    ? `
Gefunden: ${decisionMakers.decisionMakers.length} Personen
${decisionMakers.decisionMakers.map(dm => `  ${dm.name} - ${dm.role}${dm.email ? ` | ${dm.email} (${dm.emailConfidence || 'unbekannt'})` : ''}${dm.linkedInUrl ? ' | LinkedIn' : ''}`).join('\n')}
Research Quality: ${decisionMakers.researchQuality?.linkedInFound || 0} LinkedIn, ${decisionMakers.researchQuality?.emailsConfirmed || 0} bestätigte Emails, ${decisionMakers.researchQuality?.emailsDerived || 0} abgeleitete
`
    : 'Keine Entscheidungsträger gefunden'
}

=== UNTERNEHMEN ===
${
  companyIntelligence?.basicInfo
    ? `
Name: ${companyIntelligence.basicInfo.name || extractedData?.customerName || 'Unbekannt'}
Branche: ${companyIntelligence.basicInfo.industry || extractedData?.industry || 'Unbekannt'}
`
    : 'Keine Unternehmens-Daten'
}

=== MIGRATIONS-KOMPLEXITÄT ===
${
  migrationComplexity
    ? `
Score: ${migrationComplexity.score}/100
Geschätzter Aufwand: ${migrationComplexity.estimatedEffort ? `${migrationComplexity.estimatedEffort.minPT}-${migrationComplexity.estimatedEffort.maxPT} PT (${migrationComplexity.estimatedEffort.confidence}% Confidence)` : 'Nicht geschätzt'}
${
  migrationComplexity.factors
    ? `Faktoren:
  CMS Export: ${migrationComplexity.factors.cmsExportability?.score || '?'}/100 ${migrationComplexity.factors.cmsExportability?.notes || ''}
  Datenqualität: ${migrationComplexity.factors.dataQuality?.score || '?'}/100 ${migrationComplexity.factors.dataQuality?.notes || ''}
  Content-Komplexität: ${migrationComplexity.factors.contentComplexity?.score || '?'}/100 ${migrationComplexity.factors.contentComplexity?.notes || ''}
  Integration-Komplexität: ${migrationComplexity.factors.integrationComplexity?.score || '?'}/100 ${migrationComplexity.factors.integrationComplexity?.notes || ''}`
    : ''
}
`
    : 'Keine Migrations-Daten'
}

=== SCREENSHOTS ===
${
  screenshots?.homepage
    ? `
Desktop: ${screenshots.homepage.desktop ? 'Vorhanden' : 'Nicht vorhanden'}
Mobile: ${screenshots.homepage.mobile ? 'Vorhanden' : 'Nicht vorhanden'}
Zeitstempel: ${screenshots.timestamp || 'Unbekannt'}
Desktop URL: ${screenshots.homepage.desktop || ''}
Mobile URL: ${screenshots.homepage.mobile || ''}
`
    : 'Keine Screenshots'
}

ANWEISUNGEN:
1. Nutze ALLE Komponenten kreativ: Grid (columns: 2-4), ResultCard (mit variants!), Metric, ScoreCard, FeatureList, TechStack, etc.
2. Mache mehrspaltige Layouts - NICHT alles untereinander!
3. Gruppiere zusammengehörige Daten (z.B. alle Audits in einer Row mit 3 Spalten)
4. Nutze die ResultCard variants: 'highlight' für Wichtiges, 'success'/'warning' für Scores
5. Zeige WIRKLICH ALLE Daten an die verfügbar sind!
6. Die Übersicht sollte die wichtigsten KPIs auf einen Blick zeigen (4-6 Metriken)
7. Screenshots gehören prominent platziert
8. Entscheidungsträger sind Business-kritisch - hervorheben!
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        { role: 'system', content: QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT },
        { role: 'user', content: dataPrompt },
      ],
      temperature: 0.7, // Higher creativity
      max_tokens: 8000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const tree = parseJsonlPatches(responseText);

    if (!tree.root || Object.keys(tree.elements).length === 0) {
      console.warn('AI visualization failed, using fallback');
      return generateFactsTabVisualization(quickScan, extractedData);
    }

    return tree;
  } catch (error) {
    console.error('AI Facts visualization error:', error);
    return generateFactsTabVisualization(quickScan, extractedData);
  }
}

/**
 * Generate Facts Tab Visualization Tree (Fallback - deterministic)
 * Creates a complete json-render tree for the Facts Tab using QuickScan data
 *
 * DASHBOARD LAYOUT:
 * ┌──────────────────────────────────────────────────────────────┐
 * │ ÜBERSICHT (4 Metriken: BL, Seiten, Tech, Komplexität)       │
 * └──────────────────────────────────────────────────────────────┘
 * ┌─────────────────────────┐ ┌─────────────────────────────────┐
 * │ 10 FRAGEN               │ │ SCREENSHOTS                      │
 * └─────────────────────────┘ └─────────────────────────────────┘
 * ┌─────────────────────────┐ ┌─────────────────────────────────┐
 * │ TECH STACK              │ │ ENTSCHEIDUNGSTRÄGER             │
 * └─────────────────────────┘ └─────────────────────────────────┘
 * ┌───────────────────┐ ┌────────────────────┐ ┌─────────────────┐
 * │ ACCESSIBILITY     │ │ SEO                │ │ LEGAL           │
 * └───────────────────┘ └────────────────────┘ └─────────────────┘
 * ┌─────────────────────────┐ ┌─────────────────────────────────┐
 * │ CONTENT & FEATURES      │ │ NAVIGATION                       │
 * └─────────────────────────┘ └─────────────────────────────────┘
 * ┌─────────────────────────┐ ┌─────────────────────────────────┐
 * │ SITE TREE               │ │ CONTENT TYPES                    │
 * └─────────────────────────┘ └─────────────────────────────────┘
 * ┌──────────────────────────────────────────────────────────────┐
 * │ PERFORMANCE + MIGRATION                                      │
 * └──────────────────────────────────────────────────────────────┘
 */
export function generateFactsTabVisualization(
  quickScan: QuickScan,
  extractedData?: ExtractedRequirements | null
): JsonRenderTree {
  const techStack = parseJsonField<TechStackData>(quickScan.techStack);
  const contentVolume = parseJsonField<ContentVolumeData>(quickScan.contentVolume);
  const features = parseJsonField<FeaturesData>(quickScan.features);
  const accessibilityAudit = parseJsonField<AccessibilityAuditData>(quickScan.accessibilityAudit);
  const seoAudit = parseJsonField<SEOAuditData>(quickScan.seoAudit);
  const legalCompliance = parseJsonField<LegalComplianceData>(quickScan.legalCompliance);
  const performanceIndicators = parseJsonField<PerformanceData>(quickScan.performanceIndicators);
  const navigationStructure = parseJsonField<NavigationData>(quickScan.navigationStructure);
  const screenshots = parseJsonField<ScreenshotsData>(quickScan.screenshots);
  const companyIntelligence = parseJsonField<CompanyIntelligenceData>(
    quickScan.companyIntelligence
  );
  const siteTree = parseJsonField<SiteTreeData>(quickScan.siteTree);
  const contentTypes = parseJsonField<ContentTypesData>(quickScan.contentTypes);
  const decisionMakers = parseJsonField<DecisionMakersData>(quickScan.decisionMakers);
  const migrationComplexity = parseJsonField<MigrationComplexityData>(
    quickScan.migrationComplexity
  );

  // Get 10 questions data
  const questionsData = buildQuestionsWithStatus(quickScan, extractedData);

  // Build active features list
  const activeFeatures: Array<{ name: string; detected: boolean; details?: string }> = [];
  if (features) {
    activeFeatures.push({ name: 'E-Commerce', detected: !!features.ecommerce });
    activeFeatures.push({ name: 'User Accounts', detected: !!features.userAccounts });
    activeFeatures.push({ name: 'Suche', detected: !!features.search });
    activeFeatures.push({ name: 'Mehrsprachig', detected: !!features.multiLanguage });
    activeFeatures.push({ name: 'Blog/News', detected: !!features.blog });
    activeFeatures.push({ name: 'Formulare', detected: !!features.forms });
    activeFeatures.push({ name: 'API', detected: !!features.api });
    if (features.mobileApp) activeFeatures.push({ name: 'Mobile App', detected: true });
    if (features.customFeatures?.length) {
      features.customFeatures.forEach(f => activeFeatures.push({ name: f, detected: true }));
    }
  }

  const elements: JsonRenderTree['elements'] = {};

  // ========================================
  // ROW 1: Overview (full width)
  // ========================================
  elements['overview-card'] = {
    key: 'overview-card',
    type: 'ResultCard',
    props: {
      title: 'Übersicht',
      variant: 'highlight',
      icon: 'recommendation',
    },
    children: ['overview-grid'],
  };

  const overviewMetrics: string[] = [
    'metric-bl',
    'metric-pages',
    'metric-tech',
    'metric-complexity',
  ];
  if (migrationComplexity?.estimatedEffort) {
    overviewMetrics.push('metric-effort');
  }
  if (accessibilityAudit) {
    overviewMetrics.push('metric-a11y');
  }

  elements['overview-grid'] = {
    key: 'overview-grid',
    type: 'Grid',
    props: { columns: overviewMetrics.length > 4 ? 6 : 4, gap: 'md' },
    children: overviewMetrics,
  };
  elements['metric-bl'] = {
    key: 'metric-bl',
    type: 'Metric',
    props: {
      label: 'Empfohlene BL',
      value: quickScan.recommendedBusinessUnit || '-',
      subValue: quickScan.confidence ? `${quickScan.confidence}% Confidence` : undefined,
    },
  };
  elements['metric-pages'] = {
    key: 'metric-pages',
    type: 'Metric',
    props: {
      label: 'Seiten',
      value: String(siteTree?.totalPages || contentVolume?.estimatedPageCount || '-'),
      subValue: siteTree?.maxDepth ? `${siteTree.maxDepth} Ebenen tief` : undefined,
    },
  };
  elements['metric-tech'] = {
    key: 'metric-tech',
    type: 'Metric',
    props: {
      label: 'CMS / Tech',
      value: techStack?.cms || techStack?.framework || '-',
      subValue: techStack?.cmsVersion ? `v${techStack.cmsVersion}` : undefined,
    },
  };
  elements['metric-complexity'] = {
    key: 'metric-complexity',
    type: 'Metric',
    props: {
      label: 'Komplexität',
      value: contentVolume?.complexity?.toUpperCase() || '-',
      subValue: contentVolume?.languages?.length
        ? `${contentVolume.languages.length} Sprachen`
        : undefined,
    },
  };
  if (migrationComplexity?.estimatedEffort) {
    elements['metric-effort'] = {
      key: 'metric-effort',
      type: 'Metric',
      props: {
        label: 'Aufwand',
        value: `${migrationComplexity.estimatedEffort.minPT}-${migrationComplexity.estimatedEffort.maxPT} PT`,
        subValue: `${migrationComplexity.estimatedEffort.confidence}% Confidence`,
      },
    };
  }
  if (accessibilityAudit) {
    elements['metric-a11y'] = {
      key: 'metric-a11y',
      type: 'Metric',
      props: {
        label: 'Accessibility',
        value: `${accessibilityAudit.score}%`,
        subValue: accessibilityAudit.level ? `WCAG ${accessibilityAudit.level}` : undefined,
        trend:
          accessibilityAudit.score >= 70
            ? 'up'
            : accessibilityAudit.score >= 50
              ? 'neutral'
              : 'down',
      },
    };
  }

  // ========================================
  // ROW 2: Questions + Screenshots (2 columns)
  // ========================================
  const row2Children: string[] = ['questions-card'];
  if (screenshots?.homepage) {
    row2Children.push('screenshots-card');
  }

  elements['row-2'] = {
    key: 'row-2',
    type: 'Grid',
    props: { columns: row2Children.length > 1 ? 2 : 1, gap: 'md' },
    children: row2Children,
  };

  elements['questions-card'] = {
    key: 'questions-card',
    type: 'ResultCard',
    props: {
      title: '10 Fragen',
      icon: 'questions',
    },
    children: ['questions-checklist'],
  };
  elements['questions-checklist'] = {
    key: 'questions-checklist',
    type: 'QuestionChecklist',
    props: {
      projectType: questionsData.projectType,
      questions: questionsData.questions,
      summary: questionsData.summary,
    },
  };

  if (screenshots?.homepage) {
    elements['screenshots-card'] = {
      key: 'screenshots-card',
      type: 'ResultCard',
      props: {
        title: 'Screenshots',
        icon: 'screenshots',
      },
      children: ['screenshots'],
    };
    elements['screenshots'] = {
      key: 'screenshots',
      type: 'Screenshots',
      props: {
        desktop: screenshots.homepage.desktop,
        mobile: screenshots.homepage.mobile,
        timestamp: screenshots.timestamp,
      },
    };
  }

  // ========================================
  // ROW 3: Tech Stack + Decision Makers (2 columns)
  // ========================================
  const row3Children: string[] = [];

  if (techStack) {
    row3Children.push('tech-card');
    const techChildren: string[] = [];

    if (techStack.cms) {
      techChildren.push('tech-cms');
      elements['tech-cms'] = {
        key: 'tech-cms',
        type: 'TechBadge',
        props: {
          name: techStack.cms,
          version: techStack.cmsVersion,
          confidence: techStack.cmsConfidence,
          category: 'cms',
        },
      };
    }

    if (techStack.cssFrameworks?.length) {
      techChildren.push('tech-css');
      elements['tech-css'] = {
        key: 'tech-css',
        type: 'TechStack',
        props: {
          title: 'CSS Frameworks',
          technologies: techStack.cssFrameworks.map(f => ({
            name: f.name,
            confidence: f.confidence,
            category: 'framework',
          })),
        },
      };
    }

    if (techStack.javascriptFrameworks?.length) {
      techChildren.push('tech-js');
      elements['tech-js'] = {
        key: 'tech-js',
        type: 'TechStack',
        props: {
          title: 'JavaScript Frameworks',
          technologies: techStack.javascriptFrameworks.map(f => ({
            name: f.name,
            confidence: f.confidence,
            category: 'framework',
          })),
        },
      };
    }

    if (techStack.analytics?.length) {
      techChildren.push('tech-analytics');
      elements['tech-analytics'] = {
        key: 'tech-analytics',
        type: 'TechStack',
        props: {
          title: 'Analytics',
          technologies: techStack.analytics.map(a => ({
            name: a,
            category: 'analytics',
          })),
        },
      };
    }

    if (techStack.cdn || techStack.cdnProviders?.length) {
      techChildren.push('tech-cdn');
      elements['tech-cdn'] = {
        key: 'tech-cdn',
        type: 'TechStack',
        props: {
          title: 'CDN',
          technologies: techStack.cdnProviders?.map(c => ({ name: c, category: 'cdn' })) || [
            { name: techStack.cdn || 'Unknown', category: 'cdn' },
          ],
        },
      };
    }

    elements['tech-card'] = {
      key: 'tech-card',
      type: 'ResultCard',
      props: {
        title: 'Tech Stack',
        icon: 'tech',
      },
      children: techChildren,
    };
  }

  if (decisionMakers?.decisionMakers && decisionMakers.decisionMakers.length > 0) {
    row3Children.push('decision-makers-card');
    elements['decision-makers-card'] = {
      key: 'decision-makers-card',
      type: 'ResultCard',
      props: {
        title: 'Entscheidungsträger',
        icon: 'decisionMakers',
      },
      children: ['decision-makers-list'],
    };
    elements['decision-makers-list'] = {
      key: 'decision-makers-list',
      type: 'DecisionMakersList',
      props: {
        decisionMakers: decisionMakers.decisionMakers.map(dm => ({
          name: dm.name,
          role: dm.role,
          email: dm.email,
          emailConfidence: dm.emailConfidence as 'confirmed' | 'likely' | 'derived' | undefined,
          phone: dm.phone,
          linkedInUrl: dm.linkedInUrl,
          source: dm.source,
        })),
        researchQuality: decisionMakers.researchQuality,
      },
    };
  } else if (companyIntelligence?.basicInfo) {
    row3Children.push('company-card');
    elements['company-card'] = {
      key: 'company-card',
      type: 'ResultCard',
      props: {
        title: 'Unternehmen',
        icon: 'company',
      },
      children: ['company-info'],
    };
    elements['company-info'] = {
      key: 'company-info',
      type: 'CompanyCard',
      props: {
        name: companyIntelligence.basicInfo.name || extractedData?.customerName || '-',
        industry: companyIntelligence.basicInfo.industry || extractedData?.industry,
      },
    };
  }

  if (row3Children.length > 0) {
    elements['row-3'] = {
      key: 'row-3',
      type: 'Grid',
      props: { columns: row3Children.length > 1 ? 2 : 1, gap: 'md' },
      children: row3Children,
    };
  }

  // ========================================
  // ROW 4: Audits (3 columns: A11y, SEO, Legal)
  // ========================================
  const row4Children: string[] = [];

  if (accessibilityAudit) {
    row4Children.push('accessibility-card');
    elements['accessibility-card'] = {
      key: 'accessibility-card',
      type: 'ResultCard',
      props: {
        title: 'Accessibility',
        icon: 'accessibility',
        variant:
          accessibilityAudit.score >= 70
            ? 'success'
            : accessibilityAudit.score >= 50
              ? 'warning'
              : 'default',
      },
      children: ['accessibility-score', 'accessibility-issues'],
    };
    elements['accessibility-score'] = {
      key: 'accessibility-score',
      type: 'ScoreCard',
      props: {
        label: `WCAG ${accessibilityAudit.level || '2.1'}`,
        score: accessibilityAudit.score,
        maxScore: 100,
        variant:
          accessibilityAudit.score >= 70
            ? 'success'
            : accessibilityAudit.score >= 50
              ? 'warning'
              : 'danger',
        showProgress: true,
      },
    };
    elements['accessibility-issues'] = {
      key: 'accessibility-issues',
      type: 'FeatureList',
      props: {
        features: [
          {
            name: `${accessibilityAudit.criticalIssues} Kritisch`,
            detected: accessibilityAudit.criticalIssues === 0,
          },
          {
            name: `${accessibilityAudit.seriousIssues} Schwerwiegend`,
            detected: accessibilityAudit.seriousIssues === 0,
          },
          {
            name: `${accessibilityAudit.moderateIssues} Moderat`,
            detected: accessibilityAudit.moderateIssues === 0,
          },
          {
            name: `${accessibilityAudit.minorIssues} Gering`,
            detected: accessibilityAudit.minorIssues === 0,
          },
        ],
      },
    };
  }

  if (seoAudit) {
    row4Children.push('seo-card');
    const seoChecks: Array<{ name: string; detected: boolean }> = [];
    if (seoAudit.checks) {
      seoChecks.push({ name: 'Title', detected: !!seoAudit.checks.hasTitle });
      seoChecks.push({ name: 'Meta Description', detected: !!seoAudit.checks.hasMetaDescription });
      seoChecks.push({ name: 'Canonical', detected: !!seoAudit.checks.hasCanonical });
      seoChecks.push({ name: 'robots.txt', detected: !!seoAudit.checks.hasRobotsTxt });
      seoChecks.push({ name: 'Sitemap', detected: !!seoAudit.checks.hasSitemap });
      seoChecks.push({ name: 'Schema.org', detected: !!seoAudit.checks.hasStructuredData });
      seoChecks.push({ name: 'Open Graph', detected: !!seoAudit.checks.hasOpenGraph });
    }
    const seoVariant =
      seoAudit.score !== undefined
        ? seoAudit.score >= 70
          ? 'success'
          : seoAudit.score >= 50
            ? 'warning'
            : 'default'
        : 'default';
    elements['seo-card'] = {
      key: 'seo-card',
      type: 'ResultCard',
      props: {
        title: 'SEO',
        icon: 'seo',
        variant: seoVariant,
      },
      children: seoAudit.score !== undefined ? ['seo-score', 'seo-checks'] : ['seo-checks'],
    };
    if (seoAudit.score !== undefined) {
      elements['seo-score'] = {
        key: 'seo-score',
        type: 'ScoreCard',
        props: {
          label: 'SEO Score',
          score: seoAudit.score,
          maxScore: 100,
          variant: seoAudit.score >= 70 ? 'success' : seoAudit.score >= 50 ? 'warning' : 'danger',
          showProgress: true,
        },
      };
    }
    elements['seo-checks'] = {
      key: 'seo-checks',
      type: 'FeatureList',
      props: { features: seoChecks },
    };
  }

  if (legalCompliance) {
    row4Children.push('legal-card');
    const legalChecks: Array<{ name: string; detected: boolean }> = [];
    if (legalCompliance.checks) {
      legalChecks.push({ name: 'Impressum', detected: !!legalCompliance.checks.hasImprint });
      legalChecks.push({
        name: 'Datenschutz',
        detected: !!legalCompliance.checks.hasPrivacyPolicy,
      });
      legalChecks.push({
        name: 'Cookie Banner',
        detected: !!legalCompliance.checks.hasCookieBanner,
      });
      legalChecks.push({ name: 'AGB', detected: !!legalCompliance.checks.hasTermsOfService });
      legalChecks.push({
        name: 'Barrierefreiheit',
        detected: !!legalCompliance.checks.hasAccessibilityStatement,
      });
    }
    const legalVariant =
      legalCompliance.score >= 70 ? 'success' : legalCompliance.score >= 50 ? 'warning' : 'default';
    elements['legal-card'] = {
      key: 'legal-card',
      type: 'ResultCard',
      props: {
        title: 'Legal / DSGVO',
        icon: 'legal',
        variant: legalVariant,
      },
      children: ['legal-score', 'legal-checks'],
    };
    elements['legal-score'] = {
      key: 'legal-score',
      type: 'ScoreCard',
      props: {
        label: 'DSGVO Compliance',
        score: legalCompliance.score,
        maxScore: 100,
        variant:
          legalCompliance.score >= 70
            ? 'success'
            : legalCompliance.score >= 50
              ? 'warning'
              : 'danger',
        showProgress: true,
      },
    };
    if (legalCompliance.gdprIndicators?.cookieConsentTool) {
      legalChecks.push({
        name: `Tool: ${legalCompliance.gdprIndicators.cookieConsentTool}`,
        detected: true,
      });
    }
    elements['legal-checks'] = {
      key: 'legal-checks',
      type: 'FeatureList',
      props: { features: legalChecks },
    };
  }

  if (row4Children.length > 0) {
    elements['row-4'] = {
      key: 'row-4',
      type: 'Grid',
      props: { columns: row4Children.length >= 3 ? 3 : row4Children.length, gap: 'md' },
      children: row4Children,
    };
  }

  // ========================================
  // ROW 5: Content/Features + Navigation (2 columns)
  // ========================================
  const row5Children: string[] = ['content-card'];

  elements['content-card'] = {
    key: 'content-card',
    type: 'ResultCard',
    props: {
      title: 'Content & Features',
      icon: 'content',
    },
    children: ['content-stats', 'feature-list'],
  };
  elements['content-stats'] = {
    key: 'content-stats',
    type: 'ContentStats',
    props: {
      pageCount: contentVolume?.estimatedPageCount,
      complexity: contentVolume?.complexity,
      languages: contentVolume?.languages,
      media: contentVolume?.mediaAssets,
    },
  };
  elements['feature-list'] = {
    key: 'feature-list',
    type: 'FeatureList',
    props: {
      title: 'Erkannte Features',
      features: activeFeatures,
    },
  };

  if (
    navigationStructure &&
    (navigationStructure.totalItems || navigationStructure.mainNav?.length)
  ) {
    row5Children.push('navigation-card');
    elements['navigation-card'] = {
      key: 'navigation-card',
      type: 'ResultCard',
      props: {
        title: 'Navigation',
        icon: 'navigation',
      },
      children: ['navigation-stats'],
    };
    elements['navigation-stats'] = {
      key: 'navigation-stats',
      type: 'NavigationStats',
      props: {
        totalItems: navigationStructure.totalItems,
        maxDepth: navigationStructure.maxDepth,
        mainNav: navigationStructure.mainNav,
        features: {
          hasSearch: navigationStructure.hasSearch,
          hasBreadcrumbs: navigationStructure.hasBreadcrumbs,
          hasMegaMenu: navigationStructure.hasMegaMenu,
        },
      },
    };
  }

  elements['row-5'] = {
    key: 'row-5',
    type: 'Grid',
    props: { columns: row5Children.length > 1 ? 2 : 1, gap: 'md' },
    children: row5Children,
  };

  // ========================================
  // ROW 6: Site Tree + Content Types (2 columns)
  // ========================================
  const row6Children: string[] = [];

  if (siteTree && siteTree.totalPages > 0) {
    row6Children.push('site-tree-card');
    elements['site-tree-card'] = {
      key: 'site-tree-card',
      type: 'ResultCard',
      props: {
        title: 'Seitenstruktur',
        icon: 'siteTree',
      },
      children: ['site-tree'],
    };
    elements['site-tree'] = {
      key: 'site-tree',
      type: 'SiteTree',
      props: {
        totalPages: siteTree.totalPages,
        maxDepth: siteTree.maxDepth,
        sources: siteTree.sources,
        sections: siteTree.sections,
      },
    };
  }

  if (contentTypes?.distribution && contentTypes.distribution.length > 0) {
    row6Children.push('content-types-card');
    elements['content-types-card'] = {
      key: 'content-types-card',
      type: 'ResultCard',
      props: {
        title: 'Content-Typ-Verteilung',
        icon: 'contentTypes',
      },
      children: ['content-type-distribution'],
    };
    elements['content-type-distribution'] = {
      key: 'content-type-distribution',
      type: 'ContentTypeDistribution',
      props: {
        estimatedContentTypes: contentTypes.estimatedContentTypes,
        distribution: contentTypes.distribution,
        recommendations: contentTypes.recommendations,
      },
    };
  }

  if (row6Children.length > 0) {
    elements['row-6'] = {
      key: 'row-6',
      type: 'Grid',
      props: { columns: row6Children.length > 1 ? 2 : 1, gap: 'md' },
      children: row6Children,
    };
  }

  // ========================================
  // ROW 7: Performance + Migration (2 columns)
  // ========================================
  const row7Children: string[] = [];

  if (performanceIndicators) {
    row7Children.push('performance-card');
    const perfChecks: Array<{ name: string; detected: boolean }> = [];
    if (performanceIndicators.hasLazyLoading !== undefined) {
      perfChecks.push({ name: 'Lazy Loading', detected: performanceIndicators.hasLazyLoading });
    }
    if (performanceIndicators.hasMinification !== undefined) {
      perfChecks.push({ name: 'Minification', detected: performanceIndicators.hasMinification });
    }
    if (performanceIndicators.hasCaching !== undefined) {
      perfChecks.push({ name: 'Caching', detected: performanceIndicators.hasCaching });
    }
    if (techStack?.serverSideRendering !== undefined) {
      perfChecks.push({ name: 'Server-Side Rendering', detected: techStack.serverSideRendering });
    }

    elements['performance-card'] = {
      key: 'performance-card',
      type: 'ResultCard',
      props: {
        title: 'Performance',
        icon: 'performance',
      },
      children: ['perf-grid', ...(perfChecks.length > 0 ? ['perf-checks'] : [])],
    };
    elements['perf-grid'] = {
      key: 'perf-grid',
      type: 'Grid',
      props: { columns: 4, gap: 'sm' },
      children: ['perf-scripts', 'perf-styles', 'perf-images', 'perf-fonts'],
    };
    elements['perf-scripts'] = {
      key: 'perf-scripts',
      type: 'Metric',
      props: {
        label: 'Scripts',
        value: String(performanceIndicators.resourceCount?.scripts || 0),
      },
    };
    elements['perf-styles'] = {
      key: 'perf-styles',
      type: 'Metric',
      props: {
        label: 'Styles',
        value: String(performanceIndicators.resourceCount?.stylesheets || 0),
      },
    };
    elements['perf-images'] = {
      key: 'perf-images',
      type: 'Metric',
      props: {
        label: 'Bilder',
        value: String(performanceIndicators.resourceCount?.images || 0),
      },
    };
    elements['perf-fonts'] = {
      key: 'perf-fonts',
      type: 'Metric',
      props: {
        label: 'Fonts',
        value: String(performanceIndicators.resourceCount?.fonts || 0),
      },
    };
    if (perfChecks.length > 0) {
      elements['perf-checks'] = {
        key: 'perf-checks',
        type: 'FeatureList',
        props: { features: perfChecks },
      };
    }
  }

  if (migrationComplexity) {
    row7Children.push('migration-card');
    const migrationChildren = ['migration-score'];

    if (migrationComplexity.factors) {
      migrationChildren.push('migration-factors');
    }

    elements['migration-card'] = {
      key: 'migration-card',
      type: 'ResultCard',
      props: {
        title: 'Migrations-Komplexität',
        icon: 'migration',
        variant:
          migrationComplexity.score < 40
            ? 'success'
            : migrationComplexity.score < 60
              ? 'warning'
              : 'default',
      },
      children: migrationChildren,
    };
    elements['migration-score'] = {
      key: 'migration-score',
      type: 'ScoreCard',
      props: {
        label: 'Komplexitäts-Score',
        score: migrationComplexity.score,
        maxScore: 100,
        variant:
          migrationComplexity.score < 40
            ? 'success'
            : migrationComplexity.score < 60
              ? 'warning'
              : 'danger',
        showProgress: true,
      },
    };
    if (migrationComplexity.factors) {
      const factorFeatures: Array<{ name: string; detected: boolean; details?: string }> = [];
      if (migrationComplexity.factors.cmsExportability) {
        factorFeatures.push({
          name: `CMS Export: ${migrationComplexity.factors.cmsExportability.score}/100`,
          detected: migrationComplexity.factors.cmsExportability.score >= 50,
          details: migrationComplexity.factors.cmsExportability.notes,
        });
      }
      if (migrationComplexity.factors.dataQuality) {
        factorFeatures.push({
          name: `Datenqualität: ${migrationComplexity.factors.dataQuality.score}/100`,
          detected: migrationComplexity.factors.dataQuality.score >= 50,
          details: migrationComplexity.factors.dataQuality.notes,
        });
      }
      if (migrationComplexity.factors.contentComplexity) {
        factorFeatures.push({
          name: `Content-Komplexität: ${migrationComplexity.factors.contentComplexity.score}/100`,
          detected: migrationComplexity.factors.contentComplexity.score < 50,
          details: migrationComplexity.factors.contentComplexity.notes,
        });
      }
      if (migrationComplexity.factors.integrationComplexity) {
        factorFeatures.push({
          name: `Integrations-Komplexität: ${migrationComplexity.factors.integrationComplexity.score}/100`,
          detected: migrationComplexity.factors.integrationComplexity.score < 50,
          details: migrationComplexity.factors.integrationComplexity.notes,
        });
      }
      elements['migration-factors'] = {
        key: 'migration-factors',
        type: 'FeatureList',
        props: {
          title: 'Faktoren',
          features: factorFeatures,
        },
      };
    }
  }

  if (row7Children.length > 0) {
    elements['row-7'] = {
      key: 'row-7',
      type: 'Grid',
      props: { columns: row7Children.length > 1 ? 2 : 1, gap: 'md' },
      children: row7Children,
    };
  }

  // ========================================
  // Build main container with all rows
  // ========================================
  const mainChildren: string[] = ['overview-card', 'row-2'];
  if (row3Children.length > 0) mainChildren.push('row-3');
  if (row4Children.length > 0) mainChildren.push('row-4');
  mainChildren.push('row-5');
  if (row6Children.length > 0) mainChildren.push('row-6');
  if (row7Children.length > 0) mainChildren.push('row-7');

  elements['main-container'] = {
    key: 'main-container',
    type: 'Grid',
    props: { columns: 1, gap: 'lg' },
    children: mainChildren,
  };

  return {
    root: 'main-container',
    elements,
  };
}
