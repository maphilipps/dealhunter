/**
 * Expert Output to json-render Visualization Mappers
 *
 * Transforms structured expert outputs into json-render trees
 * that can be rendered by QuickScanRenderer.
 *
 * @module lib/deep-scan/output-to-json-render
 */

import type { RenderTree } from '@/components/json-render/quick-scan-registry';

// ============================================================================
// Helper Functions
// ============================================================================

let elementCounter = 0;

function generateKey(prefix: string): string {
  return `${prefix}_${++elementCounter}`;
}

function resetCounter(): void {
  elementCounter = 0;
}

// ============================================================================
// Tech Expert Visualization
// ============================================================================

interface TechStackOverview {
  cms?: {
    name: string;
    version?: string;
    confidence: number;
    evidence: string[];
  };
  frameworks: Array<{
    name: string;
    category: string;
    confidence: number;
  }>;
  libraries: string[];
  analytics: string[];
  hosting: {
    provider?: string;
    cdn?: string;
    evidence: string[];
  };
  confidence: number;
}

interface CMSDeepDive {
  name: string;
  version?: string;
  edition?: string;
  strengths: string[];
  weaknesses: string[];
  marketPosition: string;
  typicalUseCases: string[];
  migrationComplexity: 'low' | 'medium' | 'high';
  confidence: number;
}

export function techExpertToVisualization(
  techStack: TechStackOverview,
  cmsDeepDive?: CMSDeepDive
): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};

  // Root container
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // CMS Card (if detected)
  if (techStack.cms && techStack.cms.confidence >= 50) {
    const cmsCardKey = generateKey('cms_card');
    const cmsContentKey = generateKey('cms_content');

    elements[cmsContentKey] = {
      key: cmsContentKey,
      type: 'TechBadge',
      props: {
        name: techStack.cms.name,
        version: techStack.cms.version,
        confidence: techStack.cms.confidence,
        category: 'cms',
      },
    };

    elements[cmsCardKey] = {
      key: cmsCardKey,
      type: 'ResultCard',
      props: {
        title: 'Content Management System',
        description: techStack.cms.evidence.join(', '),
        icon: 'tech',
        variant: 'highlight',
      },
      children: [cmsContentKey],
    };
    childKeys.push(cmsCardKey);
  }

  // Frameworks
  if (techStack.frameworks.length > 0) {
    const frameworksCardKey = generateKey('frameworks_card');
    const techStackKey = generateKey('tech_stack');

    elements[techStackKey] = {
      key: techStackKey,
      type: 'TechStack',
      props: {
        technologies: techStack.frameworks.map(f => ({
          name: f.name,
          category: f.category === 'unknown' ? 'framework' : f.category,
          confidence: f.confidence,
        })),
      },
    };

    elements[frameworksCardKey] = {
      key: frameworksCardKey,
      type: 'ResultCard',
      props: {
        title: 'Frameworks & Libraries',
        icon: 'tech',
      },
      children: [techStackKey],
    };
    childKeys.push(frameworksCardKey);
  }

  // Hosting Info
  if (techStack.hosting.provider || techStack.hosting.cdn) {
    const hostingCardKey = generateKey('hosting_card');
    const gridKey = generateKey('hosting_grid');
    const gridChildren: string[] = [];

    if (techStack.hosting.provider) {
      const providerKey = generateKey('provider');
      elements[providerKey] = {
        key: providerKey,
        type: 'Metric',
        props: {
          label: 'Hosting Provider',
          value: techStack.hosting.provider,
        },
      };
      gridChildren.push(providerKey);
    }

    if (techStack.hosting.cdn) {
      const cdnKey = generateKey('cdn');
      elements[cdnKey] = {
        key: cdnKey,
        type: 'Metric',
        props: {
          label: 'CDN',
          value: techStack.hosting.cdn,
        },
      };
      gridChildren.push(cdnKey);
    }

    elements[gridKey] = {
      key: gridKey,
      type: 'Grid',
      props: { columns: 2 },
      children: gridChildren,
    };

    elements[hostingCardKey] = {
      key: hostingCardKey,
      type: 'ResultCard',
      props: {
        title: 'Hosting & Infrastruktur',
        icon: 'performance',
      },
      children: [gridKey],
    };
    childKeys.push(hostingCardKey);
  }

  // CMS Deep Dive (if available)
  if (cmsDeepDive) {
    const deepDiveCardKey = generateKey('deepdive_card');
    const deepDiveChildren: string[] = [];

    // Migration Complexity Score
    const complexityScoreKey = generateKey('complexity_score');
    const complexityMap = { low: 30, medium: 60, high: 90 };
    const complexityVariant =
      cmsDeepDive.migrationComplexity === 'low'
        ? 'success'
        : cmsDeepDive.migrationComplexity === 'medium'
          ? 'warning'
          : 'danger';

    elements[complexityScoreKey] = {
      key: complexityScoreKey,
      type: 'ScoreCard',
      props: {
        label: 'Migration Complexity',
        score: complexityMap[cmsDeepDive.migrationComplexity],
        variant: complexityVariant,
      },
    };
    deepDiveChildren.push(complexityScoreKey);

    // Strengths
    if (cmsDeepDive.strengths.length > 0) {
      const strengthsKey = generateKey('strengths');
      elements[strengthsKey] = {
        key: strengthsKey,
        type: 'FeatureList',
        props: {
          title: 'Stärken',
          features: cmsDeepDive.strengths.map(s => ({
            name: s,
            detected: true,
          })),
        },
      };
      deepDiveChildren.push(strengthsKey);
    }

    // Weaknesses
    if (cmsDeepDive.weaknesses.length > 0) {
      const weaknessesKey = generateKey('weaknesses');
      elements[weaknessesKey] = {
        key: weaknessesKey,
        type: 'FeatureList',
        props: {
          title: 'Schwächen',
          features: cmsDeepDive.weaknesses.map(w => ({
            name: w,
            detected: true,
          })),
        },
      };
      deepDiveChildren.push(weaknessesKey);
    }

    elements[deepDiveCardKey] = {
      key: deepDiveCardKey,
      type: 'ResultCard',
      props: {
        title: `${cmsDeepDive.name} Deep-Dive`,
        description: `Marktposition: ${cmsDeepDive.marketPosition}`,
        icon: 'tech',
        variant: 'default',
      },
      children: deepDiveChildren,
    };
    childKeys.push(deepDiveCardKey);
  }

  // Confidence Score
  const confidenceKey = generateKey('confidence');
  elements[confidenceKey] = {
    key: confidenceKey,
    type: 'ScoreCard',
    props: {
      label: 'Analyse-Confidence',
      score: techStack.confidence,
      variant:
        techStack.confidence >= 70 ? 'success' : techStack.confidence >= 40 ? 'warning' : 'danger',
    },
  };
  childKeys.push(confidenceKey);

  // Root element
  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Website Expert Visualization
// ============================================================================

interface WebsiteAnalysis {
  siteStructure?: {
    totalPages: number;
    maxDepth: number;
    sections?: Array<{ path: string; count: number }>;
  };
  contentTypes?: Array<{ type: string; count: number; percentage: number }>;
  navigation?: {
    mainNav?: Array<{ label: string; url?: string }>;
    hasSearch?: boolean;
    hasBreadcrumbs?: boolean;
  };
}

export function websiteExpertToVisualization(analysis: WebsiteAnalysis): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // Site Structure
  if (analysis.siteStructure) {
    const siteTreeKey = generateKey('site_tree');
    elements[siteTreeKey] = {
      key: siteTreeKey,
      type: 'SiteTree',
      props: {
        totalPages: analysis.siteStructure.totalPages,
        maxDepth: analysis.siteStructure.maxDepth,
        sections: analysis.siteStructure.sections?.map(s => ({
          path: s.path,
          count: s.count,
        })),
      },
    };

    const siteCardKey = generateKey('site_card');
    elements[siteCardKey] = {
      key: siteCardKey,
      type: 'ResultCard',
      props: {
        title: 'Seitenstruktur',
        icon: 'siteTree',
      },
      children: [siteTreeKey],
    };
    childKeys.push(siteCardKey);
  }

  // Content Types Distribution
  if (analysis.contentTypes && analysis.contentTypes.length > 0) {
    const distributionKey = generateKey('distribution');
    elements[distributionKey] = {
      key: distributionKey,
      type: 'ContentTypeDistribution',
      props: {
        distribution: analysis.contentTypes,
      },
    };

    const contentCardKey = generateKey('content_card');
    elements[contentCardKey] = {
      key: contentCardKey,
      type: 'ResultCard',
      props: {
        title: 'Content Types',
        icon: 'contentTypes',
      },
      children: [distributionKey],
    };
    childKeys.push(contentCardKey);
  }

  // Navigation Stats
  if (analysis.navigation) {
    const navStatsKey = generateKey('nav_stats');
    elements[navStatsKey] = {
      key: navStatsKey,
      type: 'NavigationStats',
      props: {
        mainNav: analysis.navigation.mainNav,
        features: {
          hasSearch: analysis.navigation.hasSearch,
          hasBreadcrumbs: analysis.navigation.hasBreadcrumbs,
        },
      },
    };

    const navCardKey = generateKey('nav_card');
    elements[navCardKey] = {
      key: navCardKey,
      type: 'ResultCard',
      props: {
        title: 'Navigation',
        icon: 'navigation',
      },
      children: [navStatsKey],
    };
    childKeys.push(navCardKey);
  }

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Decision Expert Visualization
// ============================================================================

interface DecisionOutput {
  recommendation: 'BID' | 'NO-BID' | 'CONDITIONAL';
  confidence: number;
  reasoning: string;
  pros: string[];
  cons: string[];
  nextSteps?: string[];
  riskFactors?: string[];
}

export function decisionExpertToVisualization(decision: DecisionOutput): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // Main Recommendation
  const recommendationKey = generateKey('recommendation');
  const variant =
    decision.recommendation === 'BID'
      ? 'success'
      : decision.recommendation === 'NO-BID'
        ? 'warning'
        : 'highlight';

  elements[recommendationKey] = {
    key: recommendationKey,
    type: 'Recommendation',
    props: {
      businessUnit: decision.recommendation,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
    },
  };

  const mainCardKey = generateKey('main_card');
  elements[mainCardKey] = {
    key: mainCardKey,
    type: 'ResultCard',
    props: {
      title: 'Empfehlung',
      icon: 'recommendation',
      variant,
    },
    children: [recommendationKey],
  };
  childKeys.push(mainCardKey);

  // Pros
  if (decision.pros.length > 0) {
    const prosKey = generateKey('pros');
    elements[prosKey] = {
      key: prosKey,
      type: 'FeatureList',
      props: {
        title: 'Pro',
        features: decision.pros.map(p => ({ name: p, detected: true })),
      },
    };

    const prosCardKey = generateKey('pros_card');
    elements[prosCardKey] = {
      key: prosCardKey,
      type: 'ResultCard',
      props: {
        title: 'Vorteile',
        variant: 'success',
      },
      children: [prosKey],
    };
    childKeys.push(prosCardKey);
  }

  // Cons
  if (decision.cons.length > 0) {
    const consKey = generateKey('cons');
    elements[consKey] = {
      key: consKey,
      type: 'FeatureList',
      props: {
        title: 'Contra',
        features: decision.cons.map(c => ({ name: c, detected: true })),
      },
    };

    const consCardKey = generateKey('cons_card');
    elements[consCardKey] = {
      key: consCardKey,
      type: 'ResultCard',
      props: {
        title: 'Nachteile / Risiken',
        variant: 'warning',
      },
      children: [consKey],
    };
    childKeys.push(consCardKey);
  }

  // Next Steps
  if (decision.nextSteps && decision.nextSteps.length > 0) {
    const stepsKey = generateKey('steps');
    elements[stepsKey] = {
      key: stepsKey,
      type: 'SkillsList',
      props: {
        title: 'Nächste Schritte',
        skills: decision.nextSteps,
      },
    };

    const stepsCardKey = generateKey('steps_card');
    elements[stepsCardKey] = {
      key: stepsCardKey,
      type: 'ResultCard',
      props: {
        title: 'Empfohlene nächste Schritte',
        icon: 'recommendation',
      },
      children: [stepsKey],
    };
    childKeys.push(stepsCardKey);
  }

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Architecture Expert Visualization
// ============================================================================

interface ArchitectureAnalysis {
  components?: {
    navigation: Array<{ type: string; features: string[] }>;
    contentBlocks: Array<{ type: string; count: number; examples: string[] }>;
    forms: Array<{ type: string; fields: number }>;
    mediaElements: Array<{ type: string; count: number }>;
    interactiveElements: string[];
  };
  summary?: {
    totalComponents: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    uniquePatterns: number;
    estimatedComponentTypes: number;
  };
}

export function architectureExpertToVisualization(analysis: ArchitectureAnalysis): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  if (analysis.components && analysis.summary) {
    const componentsKey = generateKey('components');
    elements[componentsKey] = {
      key: componentsKey,
      type: 'ExtractedComponents',
      props: {
        navigation: analysis.components.navigation,
        contentBlocks: analysis.components.contentBlocks,
        forms: analysis.components.forms,
        mediaElements: analysis.components.mediaElements,
        interactiveElements: analysis.components.interactiveElements,
        summary: analysis.summary,
      },
    };

    const archCardKey = generateKey('arch_card');
    elements[archCardKey] = {
      key: archCardKey,
      type: 'ResultCard',
      props: {
        title: 'Komponenten-Analyse',
        icon: 'extractedComponents',
      },
      children: [componentsKey],
    };
    childKeys.push(archCardKey);
  }

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Hosting Expert Visualization
// ============================================================================

interface HostingAnalysis {
  provider?: string;
  cdn?: string;
  ssl?: {
    valid: boolean;
    issuer?: string;
    expiresAt?: string;
  };
  performance?: {
    ttfb?: number;
    loadTime?: number;
    score?: number;
  };
  infrastructure?: {
    ipAddress?: string;
    location?: string;
    http2?: boolean;
  };
}

export function hostingExpertToVisualization(analysis: HostingAnalysis): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // Hosting Overview
  const metricsChildren: string[] = [];

  if (analysis.provider) {
    const providerKey = generateKey('provider');
    elements[providerKey] = {
      key: providerKey,
      type: 'Metric',
      props: { label: 'Hosting Provider', value: analysis.provider },
    };
    metricsChildren.push(providerKey);
  }

  if (analysis.cdn) {
    const cdnKey = generateKey('cdn');
    elements[cdnKey] = {
      key: cdnKey,
      type: 'Metric',
      props: { label: 'CDN', value: analysis.cdn },
    };
    metricsChildren.push(cdnKey);
  }

  if (analysis.performance?.score !== undefined) {
    const perfKey = generateKey('perf_score');
    elements[perfKey] = {
      key: perfKey,
      type: 'ScoreCard',
      props: {
        label: 'Performance Score',
        score: analysis.performance.score,
        variant:
          analysis.performance.score >= 70
            ? 'success'
            : analysis.performance.score >= 40
              ? 'warning'
              : 'danger',
      },
    };
    metricsChildren.push(perfKey);
  }

  if (metricsChildren.length > 0) {
    const gridKey = generateKey('metrics_grid');
    elements[gridKey] = {
      key: gridKey,
      type: 'Grid',
      props: { columns: 2 },
      children: metricsChildren,
    };

    const hostingCardKey = generateKey('hosting_card');
    elements[hostingCardKey] = {
      key: hostingCardKey,
      type: 'ResultCard',
      props: {
        title: 'Hosting & Infrastruktur',
        icon: 'performance',
      },
      children: [gridKey],
    };
    childKeys.push(hostingCardKey);
  }

  // SSL Status
  if (analysis.ssl) {
    const sslFeaturesKey = generateKey('ssl_features');
    elements[sslFeaturesKey] = {
      key: sslFeaturesKey,
      type: 'FeatureList',
      props: {
        features: [
          { name: 'SSL Zertifikat gültig', detected: analysis.ssl.valid },
          {
            name: `Aussteller: ${analysis.ssl.issuer || 'Unbekannt'}`,
            detected: !!analysis.ssl.issuer,
          },
          { name: `HTTP/2 aktiv`, detected: analysis.infrastructure?.http2 ?? false },
        ],
      },
    };

    const sslCardKey = generateKey('ssl_card');
    elements[sslCardKey] = {
      key: sslCardKey,
      type: 'ResultCard',
      props: {
        title: 'Sicherheit',
        icon: 'accessibility',
        variant: analysis.ssl.valid ? 'success' : 'warning',
      },
      children: [sslFeaturesKey],
    };
    childKeys.push(sslCardKey);
  }

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Migration Expert Visualization
// ============================================================================

interface MigrationAnalysis {
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  estimatedEffort?: {
    days?: number;
    personMonths?: number;
  };
  risks: string[];
  recommendations: string[];
  phases?: Array<{
    name: string;
    description: string;
    duration?: string;
  }>;
}

export function migrationExpertToVisualization(analysis: MigrationAnalysis): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // Complexity Score
  const complexityMap = { low: 25, medium: 50, high: 75, very_high: 95 };
  const complexityVariant =
    analysis.complexity === 'low'
      ? 'success'
      : analysis.complexity === 'medium'
        ? 'warning'
        : 'danger';

  const complexityKey = generateKey('complexity');
  elements[complexityKey] = {
    key: complexityKey,
    type: 'ScoreCard',
    props: {
      label: 'Migrations-Komplexität',
      score: complexityMap[analysis.complexity],
      variant: complexityVariant,
    },
  };

  const complexityCardKey = generateKey('complexity_card');
  elements[complexityCardKey] = {
    key: complexityCardKey,
    type: 'ResultCard',
    props: {
      title: 'Komplexitäts-Bewertung',
      icon: 'migration',
      variant:
        complexityVariant === 'success'
          ? 'success'
          : complexityVariant === 'warning'
            ? 'default'
            : 'warning',
    },
    children: [complexityKey],
  };
  childKeys.push(complexityCardKey);

  // Risks
  if (analysis.risks.length > 0) {
    const risksKey = generateKey('risks');
    elements[risksKey] = {
      key: risksKey,
      type: 'FeatureList',
      props: {
        title: 'Identifizierte Risiken',
        features: analysis.risks.map(r => ({ name: r, detected: true })),
      },
    };

    const risksCardKey = generateKey('risks_card');
    elements[risksCardKey] = {
      key: risksCardKey,
      type: 'ResultCard',
      props: {
        title: 'Risiken',
        icon: 'legal',
        variant: 'warning',
      },
      children: [risksKey],
    };
    childKeys.push(risksCardKey);
  }

  // Recommendations
  if (analysis.recommendations.length > 0) {
    const recsKey = generateKey('recs');
    elements[recsKey] = {
      key: recsKey,
      type: 'SkillsList',
      props: {
        title: 'Empfehlungen',
        skills: analysis.recommendations,
      },
    };

    const recsCardKey = generateKey('recs_card');
    elements[recsCardKey] = {
      key: recsCardKey,
      type: 'ResultCard',
      props: {
        title: 'Migrations-Empfehlungen',
        icon: 'recommendation',
      },
      children: [recsKey],
    };
    childKeys.push(recsCardKey);
  }

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Costs Expert Visualization
// ============================================================================

interface CostsAnalysis {
  estimatedBudget?: {
    min: number;
    max: number;
    currency: string;
  };
  breakdown?: Array<{
    category: string;
    percentage: number;
    amount?: number;
  }>;
  assumptions?: string[];
}

export function costsExpertToVisualization(analysis: CostsAnalysis): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // Budget Overview
  if (analysis.estimatedBudget) {
    const budgetGridKey = generateKey('budget_grid');
    const minKey = generateKey('min');
    const maxKey = generateKey('max');

    elements[minKey] = {
      key: minKey,
      type: 'Metric',
      props: {
        label: 'Minimum',
        value: `${analysis.estimatedBudget.min.toLocaleString()} ${analysis.estimatedBudget.currency}`,
      },
    };

    elements[maxKey] = {
      key: maxKey,
      type: 'Metric',
      props: {
        label: 'Maximum',
        value: `${analysis.estimatedBudget.max.toLocaleString()} ${analysis.estimatedBudget.currency}`,
      },
    };

    elements[budgetGridKey] = {
      key: budgetGridKey,
      type: 'Grid',
      props: { columns: 2 },
      children: [minKey, maxKey],
    };

    const budgetCardKey = generateKey('budget_card');
    elements[budgetCardKey] = {
      key: budgetCardKey,
      type: 'ResultCard',
      props: {
        title: 'Budget-Schätzung',
        icon: 'content',
        variant: 'highlight',
      },
      children: [budgetGridKey],
    };
    childKeys.push(budgetCardKey);
  }

  // Breakdown
  if (analysis.breakdown && analysis.breakdown.length > 0) {
    const breakdownKey = generateKey('breakdown');
    elements[breakdownKey] = {
      key: breakdownKey,
      type: 'ContentTypeDistribution',
      props: {
        distribution: analysis.breakdown.map(b => ({
          type: b.category,
          count: b.amount || 0,
          percentage: b.percentage,
        })),
      },
    };

    const breakdownCardKey = generateKey('breakdown_card');
    elements[breakdownCardKey] = {
      key: breakdownCardKey,
      type: 'ResultCard',
      props: {
        title: 'Kosten-Verteilung',
        icon: 'content',
      },
      children: [breakdownKey],
    };
    childKeys.push(breakdownCardKey);
  }

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Integrations Expert Visualization
// ============================================================================

interface IntegrationsAnalysis {
  detected: Array<{
    name: string;
    category: string;
    confidence: number;
  }>;
  thirdPartyServices?: string[];
  apiEndpoints?: Array<{
    url: string;
    type: string;
  }>;
}

export function integrationsExpertToVisualization(analysis: IntegrationsAnalysis): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // Detected Integrations
  if (analysis.detected.length > 0) {
    const techStackKey = generateKey('integrations_stack');
    elements[techStackKey] = {
      key: techStackKey,
      type: 'TechStack',
      props: {
        title: 'Erkannte Integrationen',
        technologies: analysis.detected.map(i => ({
          name: i.name,
          category: i.category,
          confidence: i.confidence,
        })),
      },
    };

    const intCardKey = generateKey('int_card');
    elements[intCardKey] = {
      key: intCardKey,
      type: 'ResultCard',
      props: {
        title: 'Integrationen',
        icon: 'tech',
      },
      children: [techStackKey],
    };
    childKeys.push(intCardKey);
  }

  // Third-party Services
  if (analysis.thirdPartyServices && analysis.thirdPartyServices.length > 0) {
    const servicesKey = generateKey('services');
    elements[servicesKey] = {
      key: servicesKey,
      type: 'SkillsList',
      props: {
        title: 'Third-Party Services',
        skills: analysis.thirdPartyServices,
      },
    };

    const servicesCardKey = generateKey('services_card');
    elements[servicesCardKey] = {
      key: servicesCardKey,
      type: 'ResultCard',
      props: {
        title: 'Externe Services',
        icon: 'content',
      },
      children: [servicesKey],
    };
    childKeys.push(servicesCardKey);
  }

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Project Expert Visualization
// ============================================================================

interface ProjectAnalysis {
  timeline?: {
    estimatedDuration: string;
    phases: Array<{
      name: string;
      duration: string;
    }>;
  };
  team?: {
    roles: Array<{
      role: string;
      count: number;
    }>;
    totalHeadcount?: number;
  };
  milestones?: Array<{
    name: string;
    date?: string;
    status?: 'pending' | 'in_progress' | 'completed';
  }>;
}

export function projectExpertToVisualization(analysis: ProjectAnalysis): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // Timeline
  if (analysis.timeline) {
    const durationKey = generateKey('duration');
    elements[durationKey] = {
      key: durationKey,
      type: 'Metric',
      props: {
        label: 'Geschätzte Projektdauer',
        value: analysis.timeline.estimatedDuration,
      },
    };

    const timelineCardKey = generateKey('timeline_card');
    elements[timelineCardKey] = {
      key: timelineCardKey,
      type: 'ResultCard',
      props: {
        title: 'Zeitplanung',
        icon: 'content',
      },
      children: [durationKey],
    };
    childKeys.push(timelineCardKey);
  }

  // Team
  if (analysis.team && analysis.team.roles.length > 0) {
    const teamGridChildren: string[] = [];

    analysis.team.roles.forEach(r => {
      const roleKey = generateKey('role');
      elements[roleKey] = {
        key: roleKey,
        type: 'Metric',
        props: {
          label: r.role,
          value: `${r.count} Person${r.count > 1 ? 'en' : ''}`,
        },
      };
      teamGridChildren.push(roleKey);
    });

    const teamGridKey = generateKey('team_grid');
    elements[teamGridKey] = {
      key: teamGridKey,
      type: 'Grid',
      props: { columns: 2 },
      children: teamGridChildren,
    };

    const teamCardKey = generateKey('team_card');
    elements[teamCardKey] = {
      key: teamCardKey,
      type: 'ResultCard',
      props: {
        title: 'Team-Zusammensetzung',
        description: analysis.team.totalHeadcount
          ? `Gesamt: ${analysis.team.totalHeadcount} Personen`
          : undefined,
        icon: 'decisionMakers',
      },
      children: [teamGridKey],
    };
    childKeys.push(teamCardKey);
  }

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}

// ============================================================================
// Generic Section Visualization (Fallback)
// ============================================================================

export function genericSectionToVisualization(
  title: string,
  content: unknown,
  confidence?: number
): RenderTree {
  resetCounter();
  const elements: RenderTree['elements'] = {};
  const rootKey = generateKey('root');
  const childKeys: string[] = [];

  // Confidence Score (if available)
  if (confidence !== undefined) {
    const confidenceKey = generateKey('confidence');
    elements[confidenceKey] = {
      key: confidenceKey,
      type: 'ScoreCard',
      props: {
        label: 'Analyse-Confidence',
        score: confidence,
        variant: confidence >= 70 ? 'success' : confidence >= 40 ? 'warning' : 'danger',
      },
    };
    childKeys.push(confidenceKey);
  }

  const cardKey = generateKey('card');
  elements[cardKey] = {
    key: cardKey,
    type: 'ResultCard',
    props: {
      title,
      description: typeof content === 'string' ? content : 'Analyse abgeschlossen',
    },
    children: [],
  };
  childKeys.push(cardKey);

  elements[rootKey] = {
    key: rootKey,
    type: 'Grid',
    props: { columns: 1 },
    children: childKeys,
  };

  return { root: rootKey, elements };
}
