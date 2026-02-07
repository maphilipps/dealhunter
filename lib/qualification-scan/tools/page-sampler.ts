/**
 * Page Sampler - Intelligent page selection for multi-page analysis
 * Selects diverse pages from URL pool for comprehensive tech stack detection
 */

export interface PageCategory {
  name: string;
  targetCount: number;
  patterns: RegExp[];
}

export interface SampledPages {
  urls: string[];
  categories: Record<string, string[]>;
  totalFromPool: number;
}

/**
 * URL categories for diverse page selection
 */
const PAGE_CATEGORIES: PageCategory[] = [
  {
    name: 'homepage',
    targetCount: 1,
    patterns: [/^\/$/],
  },
  {
    name: 'blog',
    targetCount: 1,
    patterns: [
      /\/blog\//i,
      /\/news\//i,
      /\/aktuelles\//i,
      /\/magazin\//i,
      /\/artikel\//i,
      /\/beitraege\//i,
      /\/posts?\//i,
    ],
  },
  {
    name: 'products',
    targetCount: 2,
    patterns: [
      /\/produkte?\//i,
      /\/products?\//i,
      /\/leistungen\//i,
      /\/services?\//i,
      /\/solutions?\//i,
      /\/loesungen\//i,
      /\/angebot\//i,
    ],
  },
  {
    name: 'about',
    targetCount: 1,
    patterns: [
      /\/ueber-uns\//i,
      /\/about\//i,
      /\/unternehmen\//i,
      /\/company\//i,
      /\/team\//i,
      /\/wir\//i,
      /\/karriere\//i,
      /\/jobs?\//i,
    ],
  },
  {
    name: 'contact',
    targetCount: 1,
    patterns: [
      /\/kontakt\//i,
      /\/contact\//i,
      /\/anfahrt\//i,
      /\/standorte?\//i,
      /\/locations?\//i,
    ],
  },
  {
    name: 'legal',
    targetCount: 1,
    patterns: [
      /\/impressum\//i,
      /\/datenschutz\//i,
      /\/privacy\//i,
      /\/agb\//i,
      /\/terms\//i,
      /\/legal\//i,
    ],
  },
  {
    name: 'deep',
    targetCount: 3,
    patterns: [], // Will be filled dynamically - pages with 2+ path segments
  },
];

/**
 * Parse URL into path segments
 */
function getPathSegments(url: string): string[] {
  try {
    const parsed = new URL(url);
    return parsed.pathname
      .split('/')
      .filter(segment => segment.length > 0 && !segment.match(/\.(html?|php|aspx?|jsp)$/i));
  } catch {
    return [];
  }
}

/**
 * Calculate URL diversity score
 * Higher score = more diverse from already selected URLs
 */
function calculateDiversityScore(url: string, selectedUrls: string[]): number {
  if (selectedUrls.length === 0) return 100;

  const segments = getPathSegments(url);
  if (segments.length === 0) return 0;

  let totalSimilarity = 0;
  for (const selected of selectedUrls) {
    const selectedSegments = getPathSegments(selected);

    // Calculate path prefix overlap
    let overlap = 0;
    for (let i = 0; i < Math.min(segments.length, selectedSegments.length); i++) {
      if (segments[i] === selectedSegments[i]) {
        overlap++;
      } else {
        break;
      }
    }

    const similarity = overlap / Math.max(segments.length, selectedSegments.length);
    totalSimilarity += similarity;
  }

  const avgSimilarity = totalSimilarity / selectedUrls.length;
  return Math.round((1 - avgSimilarity) * 100);
}

/**
 * Categorize a URL based on its path
 */
function categorizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Check against each category's patterns
    for (const category of PAGE_CATEGORIES) {
      if (category.name === 'deep') continue; // Handle separately

      for (const pattern of category.patterns) {
        if (pattern.test(path)) {
          return category.name;
        }
      }
    }

    // Check for deep pages (2+ path segments)
    const segments = getPathSegments(url);
    if (segments.length >= 2) {
      return 'deep';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Select the best URL from a list based on criteria:
 * - Shortest path (more likely to be main page of section)
 * - Ends in / or .html (actual page, not file)
 * - Highest diversity from already selected
 */
function selectBestUrl(urls: string[], selectedUrls: string[]): string | null {
  if (urls.length === 0) return null;

  let bestUrl = urls[0];
  let bestScore = -1;

  for (const url of urls) {
    const segments = getPathSegments(url);

    // Calculate score: shorter paths preferred, diversity bonus
    const lengthPenalty = segments.length * 10;
    const diversityBonus = calculateDiversityScore(url, selectedUrls);

    // Bonus for clean URLs (ending in / or being a directory)
    const cleanUrlBonus = url.endsWith('/') || !url.includes('.') ? 20 : 0;

    const score = 100 - lengthPenalty + diversityBonus + cleanUrlBonus;

    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }

  return bestUrl;
}

/**
 * Get unique path prefixes from URLs to ensure diversity
 */
function getUniquePathPrefixes(urls: string[]): Map<string, string[]> {
  const prefixMap = new Map<string, string[]>();

  for (const url of urls) {
    const segments = getPathSegments(url);
    if (segments.length > 0) {
      const prefix = '/' + segments[0];
      const existing = prefixMap.get(prefix) || [];
      existing.push(url);
      prefixMap.set(prefix, existing);
    }
  }

  return prefixMap;
}

/**
 * Select diverse pages from URL pool
 *
 * @param urls - Array of URLs to sample from (sitemap + discovered)
 * @param count - Number of pages to select (default: 10)
 * @param baseUrl - Base URL to ensure homepage is included
 * @returns Selected URLs with category information
 */
export function selectDiversePages(
  urls: string[],
  count: number = 10,
  baseUrl?: string
): SampledPages {
  const selectedUrls: string[] = [];
  const categories: Record<string, string[]> = {};
  const usedUrls = new Set<string>();

  // Initialize categories
  for (const cat of PAGE_CATEGORIES) {
    categories[cat.name] = [];
  }

  // Ensure homepage is always first (if baseUrl provided)
  if (baseUrl) {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    selectedUrls.push(normalizedBase);
    categories['homepage'].push(normalizedBase);
    usedUrls.add(normalizedBase);
  }

  // Group URLs by category
  const urlsByCategory: Record<string, string[]> = {};
  for (const cat of PAGE_CATEGORIES) {
    urlsByCategory[cat.name] = [];
  }
  urlsByCategory['uncategorized'] = [];

  for (const url of urls) {
    if (usedUrls.has(url)) continue;

    const category = categorizeUrl(url);
    if (category) {
      urlsByCategory[category].push(url);
    } else {
      urlsByCategory['uncategorized'].push(url);
    }
  }

  // Select URLs per category (respecting target counts)
  for (const category of PAGE_CATEGORIES) {
    if (category.name === 'homepage') continue; // Already handled

    const categoryUrls = urlsByCategory[category.name];
    const targetCount = category.targetCount;

    for (let i = 0; i < targetCount && selectedUrls.length < count; i++) {
      const availableUrls = categoryUrls.filter(u => !usedUrls.has(u));
      const bestUrl = selectBestUrl(availableUrls, selectedUrls);

      if (bestUrl) {
        selectedUrls.push(bestUrl);
        categories[category.name].push(bestUrl);
        usedUrls.add(bestUrl);
      }
    }
  }

  // Fill remaining slots with diverse URLs from uncategorized pool
  const uncategorizedUrls = urlsByCategory['uncategorized'];
  const prefixMap = getUniquePathPrefixes(uncategorizedUrls.filter(u => !usedUrls.has(u)));

  // Sort prefixes by number of pages (more pages = more important section)
  const sortedPrefixes = Array.from(prefixMap.entries()).sort((a, b) => b[1].length - a[1].length);

  for (const [, prefixUrls] of sortedPrefixes) {
    if (selectedUrls.length >= count) break;

    const availableUrls = prefixUrls.filter(u => !usedUrls.has(u));
    const bestUrl = selectBestUrl(availableUrls, selectedUrls);

    if (bestUrl) {
      selectedUrls.push(bestUrl);
      categories['deep'].push(bestUrl);
      usedUrls.add(bestUrl);
    }
  }

  // If still not enough, add any remaining URLs by diversity
  const remainingUrls = urls.filter(u => !usedUrls.has(u));
  remainingUrls.sort(
    (a, b) => calculateDiversityScore(b, selectedUrls) - calculateDiversityScore(a, selectedUrls)
  );

  for (const url of remainingUrls) {
    if (selectedUrls.length >= count) break;
    selectedUrls.push(url);
    categories['deep'].push(url);
    usedUrls.add(url);
  }

  return {
    urls: selectedUrls.slice(0, count),
    categories,
    totalFromPool: urls.length,
  };
}

/**
 * Extract path segments for categorization analysis
 */
export function analyzeUrlStructure(urls: string[]): {
  pathPatterns: Record<string, number>;
  avgDepth: number;
  maxDepth: number;
} {
  const pathPatterns: Record<string, number> = {};
  let totalDepth = 0;
  let maxDepth = 0;

  for (const url of urls) {
    const segments = getPathSegments(url);
    const depth = segments.length;

    totalDepth += depth;
    if (depth > maxDepth) maxDepth = depth;

    if (segments.length > 0) {
      const prefix = '/' + segments[0];
      pathPatterns[prefix] = (pathPatterns[prefix] || 0) + 1;
    }
  }

  return {
    pathPatterns,
    avgDepth: urls.length > 0 ? totalDepth / urls.length : 0,
    maxDepth,
  };
}
