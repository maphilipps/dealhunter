/**
 * CMS Evaluation Agent
 *
 * Läuft nach dem Qualification Scan und evaluiert die erkannten Anforderungen
 * gegen die verfügbaren CMS/Technologien aus der Baseline.
 *
 * Workflow 1: Qualification Scan -> CMS Evaluation -> BL Entscheidung
 */

import { eq } from 'drizzle-orm';

import { type CMSMatchingResult, type RequirementMatch, cmsMatchingResultSchema } from './schema';

// Intelligent Agent Framework - NEW
import { quickEvaluate, CMS_MATCHING_EVALUATION_SCHEMA } from '@/lib/agent-tools/evaluator';
import { createIntelligentTools, KNOWN_GITHUB_REPOS } from '@/lib/agent-tools/intelligent-tools';
import { optimizeCMSMatchingResults } from '@/lib/agent-tools/optimizer';
import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';
import { searchAndContents } from '@/lib/search/web-search';

interface QualificationScanData {
  techStack?: {
    cms?: string;
    framework?: string;
    javascriptFrameworks?: Array<{ name: string; confidence: number }>;
    cssFrameworks?: Array<{ name: string; confidence: number }>;
    serverSideRendering?: boolean;
    apiEndpoints?: { rest?: string[]; graphql?: boolean };
  };
  features?: {
    ecommerce?: boolean;
    userAccounts?: boolean;
    search?: boolean;
    multiLanguage?: boolean;
    blog?: boolean;
    forms?: boolean;
    api?: boolean;
    mobileApp?: boolean;
    customFeatures?: string[];
  };
  contentVolume?: {
    estimatedPageCount?: number;
    languages?: string[];
    complexity?: 'low' | 'medium' | 'high';
  };
  accessibilityAudit?: {
    score: number;
    level?: string;
  };
  legalCompliance?: {
    score: number;
    checks?: {
      hasCookieBanner?: boolean;
      hasPrivacyPolicy?: boolean;
    };
  };
  performanceIndicators?: {
    estimatedLoadTime?: 'fast' | 'medium' | 'slow';
  };
}

interface ExtractedRequirements {
  technologies?: string[];
  integrations?: string[];
  requirements?: string[];
  budget?: string;
  timeline?: string;
}

export interface CMSEvaluationInput {
  qualificationScanData: QualificationScanData;
  extractedRequirements?: ExtractedRequirements;
  businessUnitId?: string; // Optional: Filter Technologien nach BU
  useWebSearch?: boolean; // Web Search für aktuelle Infos nutzen
}

/**
 * Extrahiert Anforderungen aus Qualification Scan Daten
 */
function extractRequirementsFromQualificationScan(data: QualificationScanData): Array<{
  requirement: string;
  category: RequirementMatch['category'];
  priority: RequirementMatch['priority'];
  source: RequirementMatch['source'];
}> {
  const requirements: Array<{
    requirement: string;
    category: RequirementMatch['category'];
    priority: RequirementMatch['priority'];
    source: RequirementMatch['source'];
  }> = [];

  // Features -> Funktionale Anforderungen
  if (data.features) {
    if (data.features.ecommerce) {
      requirements.push({
        requirement: 'E-Commerce Funktionalität',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (data.features.multiLanguage) {
      requirements.push({
        requirement: 'Mehrsprachigkeit',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (data.features.search) {
      requirements.push({
        requirement: 'Suchfunktion',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (data.features.blog) {
      requirements.push({
        requirement: 'Blog/News Bereich',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (data.features.forms) {
      requirements.push({
        requirement: 'Formulare',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (data.features.userAccounts) {
      requirements.push({
        requirement: 'Benutzerkonten/Login',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (data.features.api) {
      requirements.push({
        requirement: 'API-Schnittstelle',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (data.features.customFeatures?.length) {
      data.features.customFeatures.forEach(feature => {
        requirements.push({
          requirement: feature,
          category: 'functional',
          priority: 'nice-to-have',
          source: 'detected',
        });
      });
    }
  }

  // Tech Stack -> Technische Anforderungen
  if (data.techStack) {
    if (data.techStack.serverSideRendering) {
      requirements.push({
        requirement: 'Server-Side Rendering (SSR)',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (data.techStack.apiEndpoints?.graphql) {
      requirements.push({
        requirement: 'GraphQL API',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (data.techStack.apiEndpoints?.rest?.length) {
      requirements.push({
        requirement: 'REST API',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
  }

  // Content Volume -> Skalierbarkeit
  if (data.contentVolume) {
    if (data.contentVolume.estimatedPageCount && data.contentVolume.estimatedPageCount > 500) {
      requirements.push({
        requirement: 'Enterprise-Skalierbarkeit (>500 Seiten)',
        category: 'scalability',
        priority: 'must-have',
        source: 'inferred',
      });
    }
    if (data.contentVolume.languages && data.contentVolume.languages.length > 3) {
      requirements.push({
        requirement: 'Multi-Site / Multi-Domain',
        category: 'scalability',
        priority: 'should-have',
        source: 'inferred',
      });
    }
    if (data.contentVolume.complexity === 'high') {
      requirements.push({
        requirement: 'Komplexe Content-Strukturen',
        category: 'functional',
        priority: 'must-have',
        source: 'inferred',
      });
    }
  }

  // Accessibility
  if (data.accessibilityAudit) {
    if (data.accessibilityAudit.level === 'AA' || data.accessibilityAudit.level === 'AAA') {
      requirements.push({
        requirement: `WCAG ${data.accessibilityAudit.level} Konformität`,
        category: 'compliance',
        priority: 'must-have',
        source: 'detected',
      });
    } else {
      requirements.push({
        requirement: 'Barrierefreiheit (WCAG)',
        category: 'compliance',
        priority: 'should-have',
        source: 'inferred',
      });
    }
  }

  // Legal Compliance
  if (data.legalCompliance) {
    requirements.push({
      requirement: 'DSGVO-Konformität',
      category: 'compliance',
      priority: 'must-have',
      source: 'inferred',
    });
  }

  // Performance
  if (data.performanceIndicators?.estimatedLoadTime === 'fast') {
    requirements.push({
      requirement: 'High Performance (schnelle Ladezeiten)',
      category: 'performance',
      priority: 'should-have',
      source: 'detected',
    });
  }

  return requirements;
}

/**
 * Lädt verfügbare Technologien aus der Datenbank
 */
async function loadBaselineTechnologies(businessUnitId?: string) {
  let query = db.select().from(technologies);

  if (businessUnitId) {
    query = query.where(eq(technologies.businessUnitId, businessUnitId)) as typeof query;
  }

  const techs = await query;

  return techs.filter(t => t.category === 'CMS' || t.category === 'Framework');
}

export interface FeatureResearchResult {
  score: number;
  confidence: number;
  notes: string;
  supported: boolean;
  researchedAt: string;
  /** Art der Unterstützung: nativ, über Modul, Extension, etc. */
  supportType?:
    | 'native'
    | 'module'
    | 'extension'
    | 'contrib'
    | 'third-party'
    | 'custom'
    | 'unknown';
  /** Name des Moduls/Plugins falls zutreffend */
  moduleName?: string;
  /** Quell-URLs der Recherche */
  sourceUrls?: string[];
  /** Begründung/Evidence für den Score */
  reasoning?: string;
}

/**
 * Generiert spezifische Suchanfragen basierend auf Anforderungstyp
 */
function generateSearchQueries(cmsName: string, requirement: string): string[] {
  const normalizedReq = requirement.toLowerCase();
  const queries: string[] = [];

  // Basis-Query mit Site-Einschränkung auf offizielle Docs
  const officialSites =
    cmsName.toLowerCase() === 'drupal'
      ? 'site:drupal.org OR site:drupal.com'
      : cmsName.toLowerCase() === 'wordpress'
        ? 'site:wordpress.org OR site:developer.wordpress.com'
        : cmsName.toLowerCase() === 'contentful'
          ? 'site:contentful.com'
          : cmsName.toLowerCase() === 'strapi'
            ? 'site:strapi.io OR site:docs.strapi.io'
            : '';

  // Spezifische Queries je nach Feature-Typ
  if (
    normalizedReq.includes('mehrsprach') ||
    normalizedReq.includes('multi-lang') ||
    normalizedReq.includes('i18n')
  ) {
    queries.push(`${cmsName} multilingual internationalization i18n support`);
    queries.push(`${cmsName} translation module documentation`);
  } else if (normalizedReq.includes('e-commerce') || normalizedReq.includes('shop')) {
    queries.push(`${cmsName} e-commerce integration shop module`);
    queries.push(`${cmsName} commerce payment checkout`);
  } else if (normalizedReq.includes('ssr') || normalizedReq.includes('server-side')) {
    queries.push(`${cmsName} server-side rendering SSR support`);
    queries.push(`${cmsName} headless decoupled architecture`);
  } else if (normalizedReq.includes('graphql')) {
    queries.push(`${cmsName} GraphQL API support module`);
  } else if (normalizedReq.includes('rest') || normalizedReq.includes('api')) {
    queries.push(`${cmsName} REST API documentation endpoints`);
  } else if (
    normalizedReq.includes('wcag') ||
    normalizedReq.includes('barrierefrei') ||
    normalizedReq.includes('a11y')
  ) {
    queries.push(`${cmsName} WCAG accessibility compliance 2.1`);
    queries.push(`${cmsName} accessible themes aria`);
  } else if (
    normalizedReq.includes('dsgvo') ||
    normalizedReq.includes('gdpr') ||
    normalizedReq.includes('datenschutz')
  ) {
    queries.push(`${cmsName} GDPR DSGVO privacy compliance module`);
  } else if (normalizedReq.includes('enterprise') || normalizedReq.includes('skalier')) {
    queries.push(`${cmsName} enterprise scalability high traffic performance`);
  } else if (normalizedReq.includes('suche') || normalizedReq.includes('search')) {
    queries.push(`${cmsName} search functionality elasticsearch solr`);
  } else if (normalizedReq.includes('workflow') || normalizedReq.includes('redaktion')) {
    queries.push(`${cmsName} editorial workflow content moderation approval`);
  } else if (
    normalizedReq.includes('benutzer') ||
    normalizedReq.includes('login') ||
    normalizedReq.includes('account')
  ) {
    queries.push(`${cmsName} user authentication login registration`);
  } else {
    // Generische Query
    queries.push(`${cmsName} ${requirement} feature documentation`);
  }

  // Offizielle Docs Query hinzufügen wenn Site bekannt
  if (officialSites) {
    queries.push(`${cmsName} ${requirement} ${officialSites}`);
  }

  return queries;
}

/**
 * Bekannte Feature-zu-Modul Mappings für gängige CMS
 * Diese werden bevorzugt verwendet wenn das Feature erkannt wird
 */
const KNOWN_FEATURE_MODULES: Record<
  string,
  Record<string, { module: string; type: 'native' | 'contrib' | 'extension' }>
> = {
  drupal: {
    // Formulare
    formular: { module: 'webform', type: 'contrib' },
    formulare: { module: 'webform', type: 'contrib' },
    forms: { module: 'webform', type: 'contrib' },
    form: { module: 'webform', type: 'contrib' },
    'contact form': { module: 'webform', type: 'contrib' },
    kontaktformular: { module: 'webform', type: 'contrib' },
    // Mehrsprachigkeit
    mehrsprachigkeit: { module: 'content_translation', type: 'native' },
    multilingual: { module: 'content_translation', type: 'native' },
    i18n: { module: 'content_translation', type: 'native' },
    übersetzung: { module: 'content_translation', type: 'native' },
    // E-Commerce
    'e-commerce': { module: 'commerce', type: 'contrib' },
    ecommerce: { module: 'commerce', type: 'contrib' },
    shop: { module: 'commerce', type: 'contrib' },
    webshop: { module: 'commerce', type: 'contrib' },
    // Suche
    suche: { module: 'search_api', type: 'contrib' },
    search: { module: 'search_api', type: 'contrib' },
    volltextsuche: { module: 'search_api_solr', type: 'contrib' },
    // Media
    media: { module: 'media', type: 'native' },
    medienverwaltung: { module: 'media', type: 'native' },
    bilder: { module: 'media', type: 'native' },
    // Workflow
    workflow: { module: 'workflows', type: 'native' },
    redaktionsworkflow: { module: 'content_moderation', type: 'native' },
    // Views
    listen: { module: 'views', type: 'native' },
    ansichten: { module: 'views', type: 'native' },
    // Layout
    layout: { module: 'layout_builder', type: 'native' },
    'page builder': { module: 'layout_builder', type: 'native' },
    // API
    'rest api': { module: 'rest', type: 'native' },
    'json api': { module: 'jsonapi', type: 'native' },
    graphql: { module: 'graphql', type: 'contrib' },
    // SEO
    seo: { module: 'metatag', type: 'contrib' },
    'meta tags': { module: 'metatag', type: 'contrib' },
    // Paragraphs
    paragraphs: { module: 'paragraphs', type: 'contrib' },
    'content components': { module: 'paragraphs', type: 'contrib' },
    // Video/Media
    video: { module: 'media', type: 'native' },
    'video content': { module: 'media', type: 'native' },
    'video einbettung': { module: 'video_embed_field', type: 'contrib' },
    'video embed': { module: 'video_embed_field', type: 'contrib' },
    youtube: { module: 'video_embed_field', type: 'contrib' },
    vimeo: { module: 'video_embed_field', type: 'contrib' },
    // Barrierefreiheit
    barrierefreiheit: { module: 'editoria11y', type: 'contrib' },
    wcag: { module: 'editoria11y', type: 'contrib' },
    accessibility: { module: 'editoria11y', type: 'contrib' },
    a11y: { module: 'editoria11y', type: 'contrib' },
  },
  wordpress: {
    // Formulare
    formular: { module: 'contact-form-7', type: 'extension' },
    formulare: { module: 'contact-form-7', type: 'extension' },
    forms: { module: 'contact-form-7', type: 'extension' },
    'contact form': { module: 'contact-form-7', type: 'extension' },
    // E-Commerce
    'e-commerce': { module: 'woocommerce', type: 'extension' },
    ecommerce: { module: 'woocommerce', type: 'extension' },
    shop: { module: 'woocommerce', type: 'extension' },
    // Mehrsprachigkeit
    mehrsprachigkeit: { module: 'wpml', type: 'extension' },
    multilingual: { module: 'wpml', type: 'extension' },
    // SEO
    seo: { module: 'yoast-seo', type: 'extension' },
    // Page Builder
    'page builder': { module: 'elementor', type: 'extension' },
    layout: { module: 'elementor', type: 'extension' },
  },
};

/**
 * Bekannte Drupal-Module die in drupal.org/project/ URLs vorkommen
 * Wird verwendet um falsche Matches zu filtern
 */
const KNOWN_DRUPAL_MODULES = new Set([
  'webform',
  'commerce',
  'search_api',
  'search_api_solr',
  'metatag',
  'pathauto',
  'paragraphs',
  'entity_reference_revisions',
  'admin_toolbar',
  'token',
  'ctools',
  'views',
  'devel',
  'redirect',
  'simple_sitemap',
  'google_analytics',
  'captcha',
  'recaptcha',
  'honeypot',
  'antibot',
  'field_group',
  'inline_entity_form',
  'entity_browser',
  'media_entity',
  'video_embed_field',
  'colorbox',
  'slick',
  'blazy',
  'responsive_image',
  'focal_point',
  'crop',
  'file_entity',
  'twig_tweak',
  'libraries',
  'components',
  'ui_patterns',
  'layout_paragraphs',
  'graphql',
  'jsonapi_extras',
  'consumers',
  'simple_oauth',
  'decoupled_router',
  'next',
  'subrequests',
  'jsonapi_menu_items',
  'jsonapi_views',
  'jsonapi_search_api',
  // Video/Media Module
  'video',
  'video_embed_field',
  'media',
  'media_library',
  'file_entity',
  'remote_video',
  'video_embed_media',
  'oembed_providers',
]);

/**
 * Blacklist für drupal.org/project/ URLs die KEINE Module sind
 * (Sprachen, Themes, Distributionen, etc.)
 */
const DRUPAL_PROJECT_BLACKLIST = new Set([
  // Sprachen (ISO 639-1 Codes)
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'pt',
  'ru',
  'zh',
  'ja',
  'ko',
  'ar',
  'no',
  'sv',
  'da',
  'fi',
  'pl',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'el',
  'tr',
  'he',
  'uk',
  'vi',
  'th',
  'id',
  'ms',
  'hi',
  'bn',
  'ta',
  'te',
  'mr',
  'gu',
  // Generische/kurze Namen die oft falsch gematcht werden
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'your',
  'you',
  'are',
  'was',
  'were',
  'been',
  'have',
  'has',
  'had',
  'will',
  'would',
  'can',
  'could',
  'may',
  'might',
  'must',
  'shall',
  'should',
  'need',
  'use',
  'used',
  'using',
  'make',
  'made',
  'get',
  'got',
  'set',
  'add',
  'all',
  'any',
  'some',
  'one',
  'two',
  'new',
  'old',
  'big',
  'small',
  // Drupal-spezifische Nicht-Module
  'drupal',
  'core',
  'docs',
  'documentation',
  'issues',
  'download',
  'authors',
  'maintainers',
  'releases',
  'usage',
  'security',
]);

/**
 * Erkennt die Art der Unterstützung (nativ, Modul, Extension, etc.)
 * Nutzt bekannte Feature-Mappings und analysiert den Content kontextbezogen
 */
function detectSupportType(
  content: string,
  cmsName: string,
  requirement?: string
): {
  type: 'native' | 'module' | 'extension' | 'contrib' | 'third-party' | 'custom' | 'unknown';
  moduleName?: string;
} {
  const lowerContent = content.toLowerCase();
  const lowerCms = cmsName.toLowerCase();
  const lowerReq = (requirement || '').toLowerCase();

  // 1. Zuerst bekannte Feature-Mappings prüfen
  const cmsModules = KNOWN_FEATURE_MODULES[lowerCms];
  if (cmsModules) {
    for (const [feature, info] of Object.entries(cmsModules)) {
      if (lowerReq.includes(feature) || feature.includes(lowerReq)) {
        return { type: info.type, moduleName: info.module };
      }
    }
  }

  // 2. Drupal-spezifische Erkennung
  if (lowerCms === 'drupal') {
    // Suche nach drupal.org/project/ URLs
    const projectMatches = lowerContent.matchAll(/drupal\.org\/project\/([a-z][a-z0-9_]*)/gi);
    for (const match of projectMatches) {
      const moduleName = match[1].toLowerCase();
      // Filter: Mindestlänge 3, nicht auf Blacklist, idealerweise bekannt
      if (moduleName.length >= 3 && !DRUPAL_PROJECT_BLACKLIST.has(moduleName)) {
        // Bekannte Module bevorzugen, aber auch unbekannte akzeptieren wenn plausibel
        if (KNOWN_DRUPAL_MODULES.has(moduleName)) {
          return { type: 'contrib', moduleName };
        }
        // Unbekannte Module nur wenn sie plausibel aussehen (Unterstrich oder > 5 Zeichen)
        if (moduleName.includes('_') || moduleName.length > 5) {
          return { type: 'contrib', moduleName };
        }
      }
    }

    // Core-Module Erkennung
    if (/drupal core|core module|built.?in|included in drupal/i.test(lowerContent)) {
      return { type: 'native' };
    }

    // Contrib-Modul mit expliziter Nennung
    const explicitModule = lowerContent.match(
      /(?:using|install|enable)\s+(?:the\s+)?([a-z][a-z0-9_]+)\s+module/i
    );
    if (explicitModule) {
      const modName = explicitModule[1].toLowerCase();
      if (
        modName.length >= 3 &&
        !DRUPAL_PROJECT_BLACKLIST.has(modName) &&
        (KNOWN_DRUPAL_MODULES.has(modName) || modName.includes('_') || modName.length > 5)
      ) {
        return { type: 'contrib', moduleName: modName };
      }
    }

    if (/contrib|contributed module/i.test(lowerContent)) {
      return { type: 'contrib' };
    }
  }

  // 3. WordPress-spezifisch
  if (lowerCms === 'wordpress') {
    // wordpress.org/plugins/ URLs
    const pluginMatch = lowerContent.match(/wordpress\.org\/plugins\/([a-z0-9-]+)/i);
    if (pluginMatch) {
      return { type: 'extension', moduleName: pluginMatch[1] };
    }

    // Bekannte Plugin-Namen
    const knownPlugins = [
      'woocommerce',
      'yoast',
      'elementor',
      'wpml',
      'contact-form-7',
      'gravity-forms',
    ];
    for (const plugin of knownPlugins) {
      if (lowerContent.includes(plugin)) {
        return { type: 'extension', moduleName: plugin };
      }
    }

    if (/built.?in|core feature|native|wordpress core/i.test(lowerContent)) {
      return { type: 'native' };
    }
  }

  // 4. Generische Patterns
  if (/built.?in|native|out of the box|core feature|included by default/i.test(lowerContent)) {
    return { type: 'native' };
  }
  if (/third.?party|external|separate service/i.test(lowerContent)) {
    return { type: 'third-party' };
  }
  if (
    /custom development|custom code|selbst entwickeln|custom implementation/i.test(lowerContent)
  ) {
    return { type: 'custom' };
  }

  // 5. Fallback: Module/Plugin erwähnt aber kein spezifischer Name
  if (/module|modul/i.test(lowerContent) && lowerCms === 'drupal') {
    return { type: 'contrib' };
  }
  if (/plugin|extension|add.?on/i.test(lowerContent)) {
    return { type: 'extension' };
  }

  return { type: 'unknown' };
}

/**
 * Analysiert Suchergebnisse auf Feature-Unterstützung
 */
function analyzeSearchResults(
  content: string,
  cmsName: string,
  requirement: string
): {
  score: number;
  confidence: number;
  supported: boolean;
  evidence: string;
  supportType: 'native' | 'module' | 'extension' | 'contrib' | 'third-party' | 'custom' | 'unknown';
  moduleName?: string;
} {
  const lowerContent = content.toLowerCase();
  const lowerCms = cmsName.toLowerCase();

  // Positive Indikatoren (gewichtet)
  const positiveSignals = [
    { pattern: /built-in|out of the box|native support/i, weight: 3 },
    { pattern: /module|plugin|extension available/i, weight: 2 },
    { pattern: /fully support|comprehensive support/i, weight: 3 },
    { pattern: /easy to|simple to implement/i, weight: 1 },
    { pattern: /documentation|guide|tutorial/i, weight: 1 },
    { pattern: /enterprise|production-ready/i, weight: 2 },
    { pattern: new RegExp(`${lowerCms}.*support.*${requirement.split(' ')[0]}`, 'i'), weight: 2 },
  ];

  // Negative Indikatoren (gewichtet)
  const negativeSignals = [
    { pattern: /not support|doesn't support|does not support/i, weight: 3 },
    { pattern: /limited|partial|basic only/i, weight: 2 },
    { pattern: /workaround|hack|manual/i, weight: 1 },
    { pattern: /deprecated|outdated|legacy/i, weight: 2 },
    { pattern: /third-party required|external service/i, weight: 1 },
    { pattern: /complex|difficult|challenging/i, weight: 1 },
  ];

  let positiveScore = 0;
  let negativeScore = 0;
  const foundEvidence: string[] = [];

  for (const signal of positiveSignals) {
    if (signal.pattern.test(lowerContent)) {
      positiveScore += signal.weight;
      const match = lowerContent.match(signal.pattern);
      if (match) foundEvidence.push(`✓ "${match[0]}"`);
    }
  }

  for (const signal of negativeSignals) {
    if (signal.pattern.test(lowerContent)) {
      negativeScore += signal.weight;
      const match = lowerContent.match(signal.pattern);
      if (match) foundEvidence.push(`✗ "${match[0]}"`);
    }
  }

  // Support-Typ erkennen (mit Requirement-Kontext für bessere Modul-Erkennung)
  const supportInfo = detectSupportType(content, cmsName, requirement);

  // Score berechnen
  const totalSignals = positiveScore + negativeScore;
  let score: number;
  let confidence: number;
  let supported: boolean;

  if (totalSignals === 0) {
    // Keine klaren Signale gefunden
    score = 50;
    confidence = 25;
    supported = false;
  } else if (positiveScore > negativeScore * 2) {
    // Klare positive Unterstützung
    score = Math.min(95, 70 + positiveScore * 5);
    confidence = Math.min(85, 50 + totalSignals * 5);
    supported = true;
  } else if (negativeScore > positiveScore * 2) {
    // Klare fehlende Unterstützung
    score = Math.max(10, 30 - negativeScore * 5);
    confidence = Math.min(85, 50 + totalSignals * 5);
    supported = false;
  } else {
    // Gemischte Signale - wahrscheinlich teilweise unterstützt
    score = 50 + (positiveScore - negativeScore) * 5;
    confidence = Math.min(70, 40 + totalSignals * 3);
    supported = positiveScore > negativeScore;
  }

  return {
    score: Math.round(score),
    confidence: Math.round(confidence),
    supported,
    evidence: foundEvidence.slice(0, 3).join(', ') || 'Keine klaren Indikatoren',
    supportType: supportInfo.type,
    moduleName: supportInfo.moduleName,
  };
}

/**
 * Exportierte Funktion für einzelne Requirement-Recherche
 * Prüft zuerst den Cache (nur wenn gute Daten), dann Web-Recherche, speichert Ergebnis als Feature
 */
export async function researchSingleRequirement(
  cmsName: string,
  requirement: string,
  technologyId?: string
): Promise<FeatureResearchResult> {
  // Caching deaktiviert - immer frisch recherchieren
  console.log(`[CMS Research] Web search for "${cmsName} ${requirement}"...`);
  const result = await researchCMSFeatures(cmsName, requirement);

  // Ergebnis als Feature speichern (falls technologyId vorhanden)
  if (technologyId) {
    await saveTechnologyFeature(technologyId, requirement, result);
    console.log(`[CMS Research] Saved feature "${requirement}" for ${cmsName}: ${result.score}%`);
  }

  return {
    score: result.score,
    confidence: result.confidence,
    notes: result.notes,
    supported: result.supported,
    researchedAt: result.researchedAt,
    supportType: result.supportType,
    moduleName: result.moduleName,
    sourceUrls: result.sourceUrls,
    reasoning: result.reasoning,
  };
}

/**
 * Formatiert den Support-Typ als lesbare deutsche Beschreibung
 */
function formatSupportType(supportType: string, moduleName?: string, cmsName?: string): string {
  const cmsLower = (cmsName || '').toLowerCase();

  switch (supportType) {
    case 'native':
      return 'Nativ unterstützt (Core-Feature)';
    case 'module':
      return moduleName ? `Über Modul "${moduleName}"` : 'Über Modul verfügbar';
    case 'contrib':
      // Drupal-spezifisch
      if (moduleName) {
        const moduleUrl = `https://drupal.org/project/${moduleName}`;
        return `Über Contrib-Modul "${moduleName}" (${moduleUrl})`;
      }
      return 'Über Contrib-Modul verfügbar';
    case 'extension':
      // WordPress-spezifisch oder generisch
      if (moduleName) {
        const pluginUrl =
          cmsLower === 'wordpress'
            ? `https://wordpress.org/plugins/${moduleName.toLowerCase().replace(/\s+/g, '-')}/`
            : null;
        return pluginUrl
          ? `Über Plugin "${moduleName}" (${pluginUrl})`
          : `Über Extension "${moduleName}"`;
      }
      return 'Über Plugin/Extension verfügbar';
    case 'third-party':
      return 'Über Drittanbieter-Lösung';
    case 'custom':
      return 'Erfordert Custom-Entwicklung';
    default:
      return 'Unterstützung unklar';
  }
}

/**
 * Web Search für CMS-Feature-Informationen
 * Verwendet spezifische Suchanfragen und analysiert Ergebnisse auf Feature-Support
 */
async function researchCMSFeatures(
  cmsName: string,
  requirement: string
): Promise<FeatureResearchResult> {
  const now = new Date().toISOString();

  try {
    const queries = generateSearchQueries(cmsName, requirement);
    let allContent = '';
    const collectedUrls: string[] = [];

    // Mehrere Queries ausprobieren
    for (const query of queries.slice(0, 2)) {
      // Max 2 Queries um API-Limits zu schonen
      try {
        console.log(`[CMS Research] Searching: "${query}"`);
        const results = await searchAndContents(query, { numResults: 3 });

        if (results.results.length === 0) continue;

        // Inhalte und URLs sammeln
        for (const r of results.results) {
          const content = `${r.title || ''} ${r.text || ''}`;
          allContent += content + ' ';

          // URL sammeln (dedupliziert)
          if (r.url && !collectedUrls.includes(r.url)) {
            collectedUrls.push(r.url);
          }
        }
      } catch (searchError) {
        console.warn(`[CMS Research] Query failed: "${query}"`, searchError);
      }
    }

    if (!allContent.trim()) {
      return {
        score: 50,
        confidence: 20,
        notes: `Recherche ohne Ergebnisse — Feature-Support für "${requirement}" in ${cmsName} konnte nicht verifiziert werden.`,
        supported: false,
        researchedAt: now,
        supportType: 'unknown',
        sourceUrls: [],
        reasoning:
          'Keine relevanten Suchergebnisse gefunden - Feature-Support konnte nicht verifiziert werden',
      };
    }

    // Ergebnisse analysieren
    const analysis = analyzeSearchResults(allContent, cmsName, requirement);

    // Notes mit Support-Typ formatieren
    const supportDescription = formatSupportType(
      analysis.supportType,
      analysis.moduleName,
      cmsName
    );

    const notes = analysis.supported ? `✓ ${supportDescription}` : `✗ ${supportDescription}`;

    // Reasoning separat speichern (die Evidence aus der Analyse)
    const reasoning =
      analysis.evidence && analysis.evidence !== 'Keine klaren Indikatoren'
        ? analysis.evidence
        : `Score basiert auf ${analysis.supported ? 'positiven' : 'gemischten/negativen'} Signalen in den Suchergebnissen`;

    const result: FeatureResearchResult = {
      score: analysis.score,
      confidence: analysis.confidence,
      notes,
      supported: analysis.supported,
      researchedAt: now,
      supportType: analysis.supportType,
      moduleName: analysis.moduleName,
      sourceUrls: collectedUrls,
      reasoning,
    };

    console.log(
      `[CMS Research] ${cmsName} + "${requirement}" => Score: ${result.score}, Confidence: ${result.confidence}, Type: ${analysis.supportType}`
    );

    return result;
  } catch (error) {
    console.error('[CMS Research] Error:', error);
    return {
      score: 50,
      confidence: 15,
      notes: 'Web Search fehlgeschlagen - Basis-Bewertung',
      supported: false,
      researchedAt: now,
      supportType: 'unknown',
      sourceUrls: [],
      reasoning: 'Web-Recherche fehlgeschlagen - technischer Fehler bei der Suche',
    };
  }
}

/**
 * Speichert recherchierte Features in der Technology-Datenbank
 */
async function saveTechnologyFeature(
  technologyId: string,
  featureName: string,
  research: FeatureResearchResult
): Promise<void> {
  try {
    // Aktuelle Features laden
    const tech = await db
      .select({ features: technologies.features })
      .from(technologies)
      .where(eq(technologies.id, technologyId))
      .limit(1);

    if (!tech.length) return;

    // Features parsen oder initialisieren
    const currentFeatures: Record<string, FeatureResearchResult> = tech[0].features
      ? JSON.parse(tech[0].features)
      : {};

    // Neues Feature hinzufügen
    currentFeatures[featureName] = research;

    // In DB speichern
    await db
      .update(technologies)
      .set({
        features: JSON.stringify(currentFeatures),
        lastResearchedAt: new Date(),
        researchStatus: 'completed',
      })
      .where(eq(technologies.id, technologyId));
  } catch (error) {
    console.error('Error saving technology feature:', error);
  }
}

/**
 * Prüft ob ein Feature bereits in der Technology-DB recherchiert wurde
 */
async function getCachedFeature(
  technologyId: string,
  featureName: string
): Promise<FeatureResearchResult | null> {
  try {
    const tech = await db
      .select({ features: technologies.features })
      .from(technologies)
      .where(eq(technologies.id, technologyId))
      .limit(1);

    if (!tech.length || !tech[0].features) return null;

    const features: Record<string, FeatureResearchResult> = JSON.parse(tech[0].features);
    return features[featureName] || null;
  } catch {
    return null;
  }
}

/**
 * Hauptfunktion: CMS Evaluation
 */
export async function runCMSEvaluation(input: CMSEvaluationInput): Promise<CMSMatchingResult> {
  // 1. Anforderungen aus Qualification Scan extrahieren
  const detectedRequirements = extractRequirementsFromQualificationScan(
    input.qualificationScanData
  );

  // 2. Anforderungen aus Extracted Requirements hinzufügen
  if (input.extractedRequirements?.requirements) {
    input.extractedRequirements.requirements.forEach(req => {
      detectedRequirements.push({
        requirement: req,
        category: 'functional',
        priority: 'should-have',
        source: 'extracted',
      });
    });
  }

  // 3. Baseline-Technologien laden
  const baselineTechs = await loadBaselineTechnologies(input.businessUnitId);

  // Fallback wenn keine Technologien in der DB
  // WICHTIG: Nur adesso-Baseline-Technologien vergleichen!
  const cmsOptions =
    baselineTechs.length > 0
      ? baselineTechs.map(t => ({ id: t.id, name: t.name, isBaseline: t.isDefault }))
      : [
          { id: 'drupal', name: 'Drupal', isBaseline: true },
          { id: 'ibexa', name: 'Ibexa', isBaseline: true },
          { id: 'magnolia', name: 'Magnolia', isBaseline: true },
          { id: 'firstspirit', name: 'FirstSpirit', isBaseline: true },
          { id: 'sulu', name: 'Sulu', isBaseline: true },
        ];

  // 4. Für jede Anforderung: Scores pro CMS berechnen (PARALLEL für alle CMS)
  // AUTO-RESEARCH: Wenn useWebSearch=true oder Confidence niedrig, automatisch recherchieren
  const requirementsWithScores: RequirementMatch[] = await Promise.all(
    detectedRequirements.map(async req => {
      // Alle CMS-Optionen parallel verarbeiten (statt sequentiell mit for-loop)
      const cmsPromises = cmsOptions.map(async cms => {
        // Basis-Score (kann durch Web Search ergänzt werden)
        let score = 50;
        let confidence = 40;
        let notes = 'Basis-Bewertung';
        let webSearchUsed = false;

        // Prüfe zuerst den Cache (bereits recherchierte Features)
        const cachedFeature = await getCachedFeature(cms.id, req.requirement);
        if (cachedFeature) {
          score = cachedFeature.score;
          confidence = cachedFeature.confidence;
          notes = cachedFeature.notes + ' (cached)';
          webSearchUsed = true;
        }
        // AUTO-RESEARCH: Wenn useWebSearch=true ODER wenn Basis-Bewertung unsicher ist
        // Bei Must-Have Anforderungen immer recherchieren wenn keine Cache-Daten
        else if (input.useWebSearch || (req.priority === 'must-have' && confidence < 60)) {
          const research = await researchCMSFeatures(cms.name, req.requirement);
          score = research.score;
          confidence = research.confidence;
          notes = research.notes;
          webSearchUsed = true;

          // Feature in DB speichern für zukünftige Evaluierungen
          await saveTechnologyFeature(cms.id, req.requirement, research);
        }

        return { cmsId: cms.id, score, confidence, notes, webSearchUsed };
      });

      // Warte auf alle parallelen CMS-Bewertungen
      const cmsResults = await Promise.all(cmsPromises);

      // Baue cmsScores Object aus parallelen Ergebnissen
      const cmsScores: RequirementMatch['cmsScores'] = Object.fromEntries(
        cmsResults.map(result => [
          result.cmsId,
          {
            score: result.score,
            confidence: result.confidence,
            notes: result.notes,
            webSearchUsed: result.webSearchUsed,
          },
        ])
      );

      return {
        ...req,
        cmsScores,
      };
    })
  );

  // 5. Gesamtscores pro CMS berechnen
  const comparedTechnologies = cmsOptions.map(cms => {
    const scores = requirementsWithScores.map(r => {
      const cmsScore = r.cmsScores[cms.id];
      const weight = r.priority === 'must-have' ? 2 : r.priority === 'should-have' ? 1.5 : 1;
      return (cmsScore?.score || 50) * weight;
    });

    const totalWeight = requirementsWithScores.reduce((sum, r) => {
      return sum + (r.priority === 'must-have' ? 2 : r.priority === 'should-have' ? 1.5 : 1);
    }, 0);

    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / totalWeight);

    return {
      id: cms.id,
      name: cms.name,
      category: 'CMS',
      isBaseline: cms.isBaseline,
      overallScore,
      strengths: [] as string[],
      weaknesses: [] as string[],
    };
  });

  // Sortieren nach Score
  comparedTechnologies.sort((a, b) => b.overallScore - a.overallScore);

  // 5.5: Intelligent Research - GitHub API für CMS Versionen
  const intelligentTools = createIntelligentTools({ agentName: 'CMS Researcher' });

  // Füge GitHub-Versionen für bekannte CMS hinzu
  for (const tech of comparedTechnologies) {
    const techLower = tech.name.toLowerCase();
    const knownRepoUrl = KNOWN_GITHUB_REPOS[techLower];

    if (knownRepoUrl) {
      try {
        const repoInfo = await intelligentTools.githubRepo(knownRepoUrl);
        if (repoInfo && !repoInfo.error) {
          // Füge Version-Info zu Strengths hinzu
          if (repoInfo.latestVersion) {
            tech.strengths.push(`Aktuelle Version: ${repoInfo.latestVersion}`);
          }
          if (repoInfo.githubStars && repoInfo.githubStars > 10000) {
            tech.strengths.push(
              `Große Community (${repoInfo.githubStars.toLocaleString()} GitHub Stars)`
            );
          }
        }
      } catch {
        // Non-critical: Continue without GitHub info
      }
    }
  }

  // 6. Empfehlung generieren
  const primary = comparedTechnologies[0];
  const alternative = comparedTechnologies[1];

  const mustHaveCount = requirementsWithScores.filter(r => r.priority === 'must-have').length;
  const avgScore = Math.round(
    comparedTechnologies.reduce((sum, t) => sum + t.overallScore, 0) / comparedTechnologies.length
  );

  // Build result object
  let result: CMSMatchingResult = {
    requirements: requirementsWithScores,
    comparedTechnologies,
    recommendation: {
      primaryCms: primary.name,
      reasoning: `${primary.name} erreicht den höchsten Gesamt-Score (${primary.overallScore}%) basierend auf ${requirementsWithScores.length} erkannten Anforderungen.`,
      alternativeCms: alternative?.name,
      alternativeReasoning: alternative
        ? `${alternative.name} mit ${alternative.overallScore}% als Alternative.`
        : undefined,
      confidence: primary.overallScore,
    },
    metadata: {
      matchedAt: new Date().toISOString(),
      webSearchUsed: input.useWebSearch || false,
      totalRequirements: requirementsWithScores.length,
      mustHaveCount,
      averageMatchScore: avgScore,
    },
  };

  // 6.5: Evaluator-Optimizer Loop
  const quickEval = quickEvaluate(
    result as Record<string, unknown>,
    CMS_MATCHING_EVALUATION_SCHEMA
  );

  if (quickEval.score < 75 && quickEval.canImprove) {
    console.log(`[CMS Matching] Score ${quickEval.score}/100, starte Optimierung...`);

    try {
      const optimization = await optimizeCMSMatchingResults(
        result as Record<string, unknown>,
        {
          qualityScore: quickEval.score,
          confidencesMet: quickEval.issues.length === 0,
          completeness: quickEval.score,
          issues: quickEval.issues.map(issue => ({
            area: issue.split(':')[0] || 'general',
            severity: 'major' as const,
            description: issue,
            suggestion: 'Verbessere über zusätzliche CMS-Recherche',
            canAutoFix: true,
          })),
          canImprove: true,
          summary: `Score ${quickEval.score}/100`,
        },
        intelligentTools,
        { agentName: 'CMS Optimizer' }
      );

      if (optimization.finalScore > quickEval.score) {
        result = { ...result, ...optimization.optimized } as CMSMatchingResult;
        console.log(`[CMS Matching] Optimierung erfolgreich: ${optimization.finalScore}/100`);
      }
    } catch (error) {
      console.warn('[CMS Matching] Optimierung übersprungen:', error);
    }
  }

  return result;
}
