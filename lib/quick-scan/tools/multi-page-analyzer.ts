/**
 * Multi-Page Analyzer - Parallel analysis of multiple pages for tech stack detection
 * Aggregates results from 10 diverse pages for reliable CMS/framework identification
 */

import wappalyzer from 'simple-wappalyzer';

import { validateUrlForFetch } from '@/lib/utils/url-validation';

export interface PageData {
  url: string;
  html: string;
  headers: Record<string, string>;
  fetchedAt: string;
  error?: string;
}

export interface PageTechResult {
  url: string;
  technologies: TechnologyDetection[];
  cms?: CMSDetection;
  framework?: FrameworkDetection;
  rawWappalyzer: WappalyzerTech[];
}

export interface TechnologyDetection {
  name: string;
  category: string;
  confidence: number;
  version?: string;
  source: 'wappalyzer' | 'html_pattern' | 'header' | 'httpx';
}

export interface CMSDetection {
  name: string;
  version?: string;
  confidence: number;
  indicators: string[];
}

export interface FrameworkDetection {
  name: string;
  version?: string;
  confidence: number;
  type: 'frontend' | 'backend' | 'css';
}

export interface WappalyzerTech {
  name: string;
  categories: string[];
  version?: string;
  confidence: number;
  website?: string;
}

export interface AggregatedTechResult {
  cms?: {
    name: string;
    version?: string;
    confidence: number;
    detectedOn: number;
    totalPages: number;
    indicators: string[];
  };
  framework?: {
    name: string;
    version?: string;
    confidence: number;
    detectedOn: number;
  };
  backend: Array<{ name: string; confidence: number; detectedOn: number }>;
  hosting?: string;
  cdn?: string;
  server?: string;
  libraries: Array<{ name: string; confidence: number; version?: string; detectedOn: number }>;
  analytics: Array<{ name: string; confidence: number; detectedOn: number }>;
  marketing: Array<{ name: string; confidence: number; detectedOn: number }>;
  overallConfidence: number;
  pagesAnalyzed: number;
  detectionMethod: 'multi-page' | 'single-page' | 'httpx-fallback';
}

/**
 * CMS detection patterns (HTML patterns to look for)
 */
const CMS_PATTERNS: Array<{ name: string; patterns: RegExp[]; version?: RegExp }> = [
  {
    name: 'Drupal',
    patterns: [
      /Drupal\.settings/i,
      /drupal\.js/i,
      /\/sites\/default\/files\//i,
      /\/sites\/all\//i,
      /data-drupal/i,
      /drupal-ajax/i,
      /X-Drupal-Cache/i,
      /X-Generator.*Drupal/i,
      /generator.*Drupal/i,
    ],
    version: /Drupal\s*(\d+(\.\d+)?)/i,
  },
  {
    name: 'WordPress',
    patterns: [
      /wp-content/i,
      /wp-includes/i,
      /wp-json/i,
      /wordpress/i,
      /\/wp-admin\//i,
      /wp-embed\.min\.js/i,
    ],
    version: /WordPress\s*(\d+(\.\d+)?(\.\d+)?)/i,
  },
  {
    name: 'TYPO3',
    patterns: [
      /typo3/i,
      /t3js/i,
      /\/typo3conf\//i,
      /\/typo3temp\//i,
      /data-t3/i,
      /generator.*TYPO3/i,
    ],
    version: /TYPO3\s*(CMS\s*)?(\d+(\.\d+)?)/i,
  },
  {
    name: 'Joomla',
    patterns: [/joomla/i, /\/media\/jui\//i, /\/components\/com_/i, /Joomla!/i],
    version: /Joomla!\s*(\d+(\.\d+)?)/i,
  },
  {
    name: 'Contao',
    patterns: [/contao/i, /\/system\/modules\//i, /data-contao/i],
  },
  {
    name: 'Magento',
    patterns: [/Magento/i, /Mage\.Cookies/i, /\/skin\/frontend\//i, /\/js\/mage\//i],
    version: /Magento\/(\d+(\.\d+)?)/i,
  },
  {
    name: 'Shopify',
    patterns: [/Shopify\.shop/i, /cdn\.shopify/i, /shopify\.com/i],
  },
  {
    name: 'Sitecore',
    patterns: [/sitecore/i, /sc_mode/i, /\/sitecore\//i],
  },
  {
    name: 'Adobe Experience Manager',
    patterns: [/cq-wcm-edit/i, /\/content\/dam\//i, /AEM/i, /Adobe Experience Manager/i],
  },
  {
    name: 'Contentful',
    patterns: [/contentful/i, /cdn\.contentful\.com/i],
  },
  {
    name: 'Strapi',
    patterns: [/strapi/i, /\/api\/.*\?populate/i],
  },
  {
    name: 'Sanity',
    patterns: [/sanity\.io/i, /cdn\.sanity\.io/i],
  },
];

/**
 * Fetch multiple pages in parallel
 */
export async function fetchPages(
  urls: string[],
  options: {
    timeout?: number;
    maxConcurrent?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<PageData[]> {
  const { timeout = 10000, maxConcurrent = 5, onProgress } = options;

  const results: PageData[] = [];
  let completed = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(async url => {
        try {
          // Validate URL
          const fullUrl = url.startsWith('http') ? url : `https://${url}`;
          validateUrlForFetch(fullUrl);

          const response = await fetch(fullUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            signal: AbortSignal.timeout(timeout),
          });

          if (!response.ok) {
            return {
              url: fullUrl,
              html: '',
              headers: {},
              fetchedAt: new Date().toISOString(),
              error: `HTTP ${response.status}`,
            };
          }

          const html = await response.text();
          const headers: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
          });

          return {
            url: fullUrl,
            html,
            headers,
            fetchedAt: new Date().toISOString(),
          };
        } catch (error) {
          return {
            url,
            html: '',
            headers: {},
            fetchedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Fetch failed',
          };
        }
      })
    );

    results.push(...batchResults);
    completed += batchResults.length;

    if (onProgress) {
      onProgress(completed, urls.length);
    }
  }

  return results;
}

/**
 * Analyze a single page for technology detection
 */
export function analyzePageTech(page: PageData): PageTechResult {
  const technologies: TechnologyDetection[] = [];
  const rawWappalyzer: WappalyzerTech[] = [];
  let cms: CMSDetection | undefined;
  let framework: FrameworkDetection | undefined;

  // Skip if page had errors
  if (page.error || !page.html) {
    return {
      url: page.url,
      technologies,
      rawWappalyzer,
    };
  }

  // Run Wappalyzer
  try {
    const wappalyzerResult = wappalyzer({
      url: page.url,
      html: page.html,
      headers: page.headers,
    });

    const techs = Array.isArray(wappalyzerResult) ? wappalyzerResult : [];
    rawWappalyzer.push(...techs);

    for (const tech of techs) {
      technologies.push({
        name: tech.name,
        category: tech.categories?.[0] || 'Other',
        confidence: tech.confidence,
        version: tech.version,
        source: 'wappalyzer',
      });

      // Check for CMS
      if (tech.categories?.includes('CMS')) {
        if (!cms || tech.confidence > cms.confidence) {
          cms = {
            name: tech.name,
            version: tech.version,
            confidence: tech.confidence,
            indicators: ['wappalyzer'],
          };
        }
      }

      // Check for frameworks
      if (
        tech.categories?.some(c =>
          ['JavaScript frameworks', 'Frontend frameworks', 'Web frameworks'].includes(c)
        )
      ) {
        if (!framework || tech.confidence > framework.confidence) {
          framework = {
            name: tech.name,
            version: tech.version,
            confidence: tech.confidence,
            type: 'frontend',
          };
        }
      }
    }
  } catch {
    // Wappalyzer failed, continue with pattern detection
  }

  // HTML pattern detection for CMS
  for (const cmsPattern of CMS_PATTERNS) {
    let matchCount = 0;
    const indicators: string[] = [];

    for (const pattern of cmsPattern.patterns) {
      if (pattern.test(page.html) || pattern.test(JSON.stringify(page.headers))) {
        matchCount++;
        indicators.push(pattern.source);
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min(95, 50 + matchCount * 15);

      // Extract version if pattern exists
      let version: string | undefined;
      if (cmsPattern.version) {
        const versionMatch = page.html.match(cmsPattern.version);
        if (versionMatch) {
          version = versionMatch[1];
        }
      }

      technologies.push({
        name: cmsPattern.name,
        category: 'CMS',
        confidence,
        version,
        source: 'html_pattern',
      });

      // Update CMS if higher confidence
      if (!cms || confidence > cms.confidence) {
        cms = {
          name: cmsPattern.name,
          version,
          confidence,
          indicators,
        };
      }
    }
  }

  // Header-based detection
  const serverHeader = page.headers['server'];
  if (serverHeader) {
    technologies.push({
      name: serverHeader,
      category: 'Web servers',
      confidence: 100,
      source: 'header',
    });
  }

  const poweredBy = page.headers['x-powered-by'];
  if (poweredBy) {
    technologies.push({
      name: poweredBy,
      category: 'Programming languages',
      confidence: 100,
      source: 'header',
    });
  }

  const generator = page.headers['x-generator'];
  if (generator) {
    technologies.push({
      name: generator,
      category: 'CMS',
      confidence: 90,
      source: 'header',
    });
  }

  return {
    url: page.url,
    technologies,
    cms,
    framework,
    rawWappalyzer,
  };
}

/**
 * Aggregate tech results from multiple pages
 */
export function aggregateTechResults(results: PageTechResult[]): AggregatedTechResult {
  const validResults = results.filter(r => r.technologies.length > 0);
  const totalPages = results.length;
  const validPages = validResults.length;

  // Count technology occurrences across pages
  const techCounts = new Map<string, { count: number; tech: TechnologyDetection }>();

  for (const result of validResults) {
    const seenOnPage = new Set<string>();

    for (const tech of result.technologies) {
      const key = `${tech.category}:${tech.name}`;
      if (seenOnPage.has(key)) continue;
      seenOnPage.add(key);

      const existing = techCounts.get(key);
      if (existing) {
        existing.count++;
        // Keep highest confidence version
        if (tech.confidence > existing.tech.confidence) {
          existing.tech = tech;
        }
      } else {
        techCounts.set(key, { count: 1, tech });
      }
    }
  }

  // Aggregate CMS detections
  const cmsDetections = new Map<
    string,
    { count: number; confidence: number; version?: string; indicators: string[] }
  >();

  for (const result of validResults) {
    if (result.cms) {
      const existing = cmsDetections.get(result.cms.name);
      if (existing) {
        existing.count++;
        existing.confidence = Math.max(existing.confidence, result.cms.confidence);
        existing.indicators.push(...result.cms.indicators);
        if (result.cms.version && !existing.version) {
          existing.version = result.cms.version;
        }
      } else {
        cmsDetections.set(result.cms.name, {
          count: 1,
          confidence: result.cms.confidence,
          version: result.cms.version,
          indicators: [...result.cms.indicators],
        });
      }
    }
  }

  // Find best CMS (detected on most pages)
  let bestCms: AggregatedTechResult['cms'] | undefined;
  let maxCmsCount = 0;
  for (const [name, data] of cmsDetections) {
    if (data.count > maxCmsCount) {
      maxCmsCount = data.count;
      const calculatedConfidence = Math.round((data.count / validPages) * 100);
      bestCms = {
        name,
        version: data.version,
        confidence: Math.max(calculatedConfidence, data.confidence),
        detectedOn: data.count,
        totalPages,
        indicators: [...new Set(data.indicators)],
      };
    }
  }

  // Aggregate frameworks
  const frameworkDetections = new Map<
    string,
    { count: number; confidence: number; version?: string; type: string }
  >();

  for (const result of validResults) {
    if (result.framework) {
      const existing = frameworkDetections.get(result.framework.name);
      if (existing) {
        existing.count++;
        existing.confidence = Math.max(existing.confidence, result.framework.confidence);
        if (result.framework.version && !existing.version) {
          existing.version = result.framework.version;
        }
      } else {
        frameworkDetections.set(result.framework.name, {
          count: 1,
          confidence: result.framework.confidence,
          version: result.framework.version,
          type: result.framework.type,
        });
      }
    }
  }

  // Find best framework
  let bestFramework: AggregatedTechResult['framework'] | undefined;
  let maxFrameworkCount = 0;
  for (const [name, data] of frameworkDetections) {
    if (data.count > maxFrameworkCount) {
      maxFrameworkCount = data.count;
      bestFramework = {
        name,
        version: data.version,
        confidence: Math.round((data.count / validPages) * 100),
        detectedOn: data.count,
      };
    }
  }

  // Categorize and aggregate other technologies
  const categoryAggregates = {
    backend: new Map<string, { count: number; confidence: number }>(),
    libraries: new Map<string, { count: number; confidence: number; version?: string }>(),
    analytics: new Map<string, { count: number; confidence: number }>(),
    marketing: new Map<string, { count: number; confidence: number }>(),
  };

  const backendCategories = ['Programming languages', 'Web servers'];
  const analyticsCategories = ['Analytics', 'Tag managers', 'RUM'];
  const marketingCategories = [
    'Marketing automation',
    'Cookie compliance',
    'A/B testing',
    'Personalization',
    'Advertising',
    'Live chat',
  ];
  const libraryCategories = [
    'JavaScript libraries',
    'UI frameworks',
    'JavaScript frameworks',
    'CSS frameworks',
  ];

  for (const [, { count, tech }] of techCounts) {
    const category = tech.category;

    if (backendCategories.includes(category)) {
      categoryAggregates.backend.set(tech.name, {
        count,
        confidence: Math.round((count / validPages) * 100),
      });
    } else if (analyticsCategories.includes(category)) {
      categoryAggregates.analytics.set(tech.name, {
        count,
        confidence: Math.round((count / validPages) * 100),
      });
    } else if (marketingCategories.includes(category)) {
      categoryAggregates.marketing.set(tech.name, {
        count,
        confidence: Math.round((count / validPages) * 100),
      });
    } else if (libraryCategories.includes(category)) {
      categoryAggregates.libraries.set(tech.name, {
        count,
        confidence: Math.round((count / validPages) * 100),
        version: tech.version,
      });
    }
  }

  // Convert maps to arrays with confidence filter (>30%)
  const backend = Array.from(categoryAggregates.backend.entries())
    .map(([name, data]) => ({ name, ...data, detectedOn: data.count }))
    .filter(t => t.confidence >= 30)
    .sort((a, b) => b.confidence - a.confidence);

  const libraries = Array.from(categoryAggregates.libraries.entries())
    .map(([name, data]) => ({ name, ...data, detectedOn: data.count }))
    .filter(t => t.confidence >= 30)
    .sort((a, b) => b.confidence - a.confidence);

  const analytics = Array.from(categoryAggregates.analytics.entries())
    .map(([name, data]) => ({ name, ...data, detectedOn: data.count }))
    .filter(t => t.confidence >= 30)
    .sort((a, b) => b.confidence - a.confidence);

  const marketing = Array.from(categoryAggregates.marketing.entries())
    .map(([name, data]) => ({ name, ...data, detectedOn: data.count }))
    .filter(t => t.confidence >= 30)
    .sort((a, b) => b.confidence - a.confidence);

  // Find hosting/CDN from results
  let hosting: string | undefined;
  let cdn: string | undefined;
  let server: string | undefined;

  for (const [, { tech }] of techCounts) {
    if (['PaaS', 'Hosting', 'IaaS'].includes(tech.category) && !hosting) {
      hosting = tech.name;
    }
    if (tech.category === 'CDN' && !cdn) {
      cdn = tech.name;
    }
    if (tech.category === 'Web servers' && !server) {
      server = tech.name;
    }
  }

  // Calculate overall confidence
  const confidenceFactors = [
    bestCms?.confidence || 0,
    bestFramework?.confidence || 0,
    backend.length > 0 ? backend[0].confidence : 0,
  ];

  const overallConfidence = Math.round(
    confidenceFactors.reduce((sum, c) => sum + c, 0) /
      Math.max(confidenceFactors.filter(c => c > 0).length, 1)
  );

  return {
    cms: bestCms,
    framework: bestFramework,
    backend,
    hosting,
    cdn,
    server,
    libraries,
    analytics,
    marketing,
    overallConfidence,
    pagesAnalyzed: totalPages,
    detectionMethod: totalPages > 1 ? 'multi-page' : 'single-page',
  };
}

/**
 * Run full multi-page analysis
 */
export async function runMultiPageAnalysis(
  urls: string[],
  options: {
    onProgress?: (completed: number, total: number, phase: string) => void;
  } = {}
): Promise<{
  pages: PageData[];
  techResults: PageTechResult[];
  aggregated: AggregatedTechResult;
}> {
  const { onProgress } = options;

  // Phase 1: Fetch pages
  onProgress?.(0, urls.length, 'fetching');
  const pages = await fetchPages(urls, {
    onProgress: (completed, total) => onProgress?.(completed, total, 'fetching'),
  });

  // Phase 2: Analyze each page
  onProgress?.(0, pages.length, 'analyzing');
  const techResults = pages.map((page, index) => {
    const result = analyzePageTech(page);
    onProgress?.(index + 1, pages.length, 'analyzing');
    return result;
  });

  // Phase 3: Aggregate results
  onProgress?.(0, 1, 'aggregating');
  const aggregated = aggregateTechResults(techResults);
  onProgress?.(1, 1, 'aggregating');

  return {
    pages,
    techResults,
    aggregated,
  };
}
