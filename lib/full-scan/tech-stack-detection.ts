/**
 * Tech Stack Detection
 *
 * Detects CMS, framework, hosting, database, and other technologies
 * using browser inspection and HTML/HTTP analysis.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const techStackSchema = z.object({
  cms: z.string().nullable().describe('Detected CMS (e.g., Drupal, WordPress, etc.)'),
  cmsVersion: z.string().nullable().describe('CMS version if detectable'),
  framework: z.string().nullable().describe('Frontend framework (e.g., React, Vue, etc.)'),
  backend: z.string().nullable().describe('Backend technology (e.g., PHP, Node.js, etc.)'),
  database: z.string().nullable().describe('Database (e.g., MySQL, PostgreSQL, etc.)'),
  hosting: z.string().nullable().describe('Hosting provider (e.g., AWS, Azure, etc.)'),
  server: z.string().nullable().describe('Web server (e.g., Apache, Nginx, etc.)'),
  technologies: z
    .array(z.string())
    .describe('List of all detected technologies')
    .default([]),
  confidence: z.enum(['high', 'medium', 'low']).describe('Detection confidence level'),
});

export type TechStack = z.infer<typeof techStackSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

interface DetectionPattern {
  name: string;
  category: 'cms' | 'framework' | 'server' | 'hosting' | 'analytics' | 'other';
  patterns: {
    meta?: string[]; // Meta tag patterns
    script?: string[]; // Script src patterns
    html?: string[]; // HTML content patterns
    headers?: string[]; // HTTP header patterns
    cookies?: string[]; // Cookie patterns
    dom?: string[]; // DOM element patterns
  };
  version?: {
    meta?: string; // Meta tag for version
    generator?: string; // Generator tag pattern
    path?: string; // Version endpoint path
  };
}

const detectionPatterns: DetectionPattern[] = [
  // === CMS ===
  {
    name: 'Drupal',
    category: 'cms',
    patterns: {
      meta: ['Drupal'],
      script: ['/sites/default/', '/core/misc/', '/modules/'],
      html: ['data-drupal-', 'Drupal.'],
      headers: ['X-Drupal', 'X-Generator: Drupal'],
      cookies: ['SESS'],
    },
    version: {
      meta: 'generator',
      generator: 'Drupal (\\d+)',
      path: '/core/CHANGELOG.txt',
    },
  },
  {
    name: 'WordPress',
    category: 'cms',
    patterns: {
      meta: ['WordPress'],
      script: ['/wp-content/', '/wp-includes/'],
      html: ['wp-content', 'wp-json'],
      cookies: ['wordpress_'],
    },
    version: {
      meta: 'generator',
      generator: 'WordPress (\\d+\\.\\d+)',
      path: '/wp-includes/version.php',
    },
  },
  {
    name: 'Magnolia',
    category: 'cms',
    patterns: {
      meta: ['Magnolia'],
      script: ['/.resources/'],
      html: ['mgnlEditable', 'mgnlPageId'],
      cookies: ['JSESSIONID'],
    },
  },
  {
    name: 'Umbraco',
    category: 'cms',
    patterns: {
      script: ['/umbraco/'],
      html: ['umbraco'],
      cookies: ['UMB_'],
    },
  },
  {
    name: 'Ibexa',
    category: 'cms',
    patterns: {
      html: ['data-ez-', 'ezplatform'],
      cookies: ['eZSESSID'],
    },
  },
  {
    name: 'Contentful',
    category: 'cms',
    patterns: {
      script: ['contentful.com'],
      html: ['contentful'],
    },
  },
  {
    name: 'Strapi',
    category: 'cms',
    patterns: {
      script: ['/strapi/'],
      html: ['powered by Strapi'],
    },
  },

  // === Frontend Frameworks ===
  {
    name: 'React',
    category: 'framework',
    patterns: {
      script: ['react', 'react-dom'],
      html: ['data-reactroot', 'data-react', '__REACT', '_reactRoot'],
      dom: ['[data-reactroot]', '[data-reactid]'],
    },
  },
  {
    name: 'Next.js',
    category: 'framework',
    patterns: {
      script: ['/_next/'],
      html: ['__NEXT_DATA__', 'next.js'],
      meta: ['next.js'],
    },
  },
  {
    name: 'Vue.js',
    category: 'framework',
    patterns: {
      script: ['vue.js', 'vue.min.js'],
      html: ['data-v-', '__vue__'],
      dom: ['[data-v-]'],
    },
  },
  {
    name: 'Nuxt.js',
    category: 'framework',
    patterns: {
      script: ['/_nuxt/'],
      html: ['__NUXT__'],
    },
  },
  {
    name: 'Angular',
    category: 'framework',
    patterns: {
      script: ['angular.js', '@angular/'],
      html: ['ng-', 'data-ng-', 'ng-app'],
      dom: ['[ng-app]', '[ng-controller]'],
    },
  },
  {
    name: 'Svelte',
    category: 'framework',
    patterns: {
      script: ['svelte'],
      html: ['svelte-'],
    },
  },

  // === Web Servers ===
  {
    name: 'Nginx',
    category: 'server',
    patterns: {
      headers: ['Server: nginx', 'Server: nginx/'],
    },
  },
  {
    name: 'Apache',
    category: 'server',
    patterns: {
      headers: ['Server: Apache', 'Server: Apache/'],
    },
  },
  {
    name: 'IIS',
    category: 'server',
    patterns: {
      headers: ['Server: Microsoft-IIS'],
    },
  },
  {
    name: 'Cloudflare',
    category: 'hosting',
    patterns: {
      headers: ['Server: cloudflare', 'CF-RAY'],
      cookies: ['__cfduid'],
    },
  },

  // === Hosting/CDN ===
  {
    name: 'Vercel',
    category: 'hosting',
    patterns: {
      headers: ['x-vercel-', 'Server: Vercel'],
    },
  },
  {
    name: 'Netlify',
    category: 'hosting',
    patterns: {
      headers: ['Server: Netlify', 'x-nf-'],
    },
  },
  {
    name: 'AWS',
    category: 'hosting',
    patterns: {
      headers: ['x-amz-', 'x-amzn-'],
      html: ['amazonaws.com'],
    },
  },
  {
    name: 'Azure',
    category: 'hosting',
    patterns: {
      headers: ['x-azure-', 'x-ms-'],
      html: ['azurewebsites.net', 'windows.net'],
    },
  },

  // === Analytics ===
  {
    name: 'Google Analytics',
    category: 'analytics',
    patterns: {
      script: ['google-analytics.com/analytics.js', 'googletagmanager.com/gtag/'],
      html: ['ga(', 'gtag('],
    },
  },
  {
    name: 'Adobe Analytics',
    category: 'analytics',
    patterns: {
      script: ['omniture.com', 'adobe analytics'],
    },
  },
  {
    name: 'Matomo',
    category: 'analytics',
    patterns: {
      script: ['matomo.js', 'piwik.js'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

interface PageAnalysis {
  html: string;
  headers: Record<string, string>;
  cookies: string[];
  scripts: string[];
  metas: Record<string, string>;
}

/**
 * Detect tech stack from page analysis
 */
export function detectTechStack(pageAnalysis: PageAnalysis): TechStack {
  const detectedTechs: string[] = [];
  let cms: string | null = null;
  let cmsVersion: string | null = null;
  let framework: string | null = null;
  let server: string | null = null;
  let hosting: string | null = null;

  for (const pattern of detectionPatterns) {
    if (matchesPattern(pattern, pageAnalysis)) {
      detectedTechs.push(pattern.name);

      // Categorize detections
      if (pattern.category === 'cms' && !cms) {
        cms = pattern.name;
        // Try to detect version
        if (pattern.version) {
          cmsVersion = detectVersion(pattern, pageAnalysis);
        }
      } else if (pattern.category === 'framework' && !framework) {
        framework = pattern.name;
      } else if (pattern.category === 'server' && !server) {
        server = pattern.name;
      } else if (pattern.category === 'hosting' && !hosting) {
        hosting = pattern.name;
      }
    }
  }

  // Determine confidence based on detections
  const confidence = determineConfidence(detectedTechs, cms, framework);

  return {
    cms,
    cmsVersion,
    framework,
    backend: inferBackend(cms, framework, detectedTechs),
    database: inferDatabase(cms, detectedTechs),
    hosting,
    server,
    technologies: detectedTechs,
    confidence,
  };
}

/**
 * Check if page matches detection pattern
 */
function matchesPattern(pattern: DetectionPattern, analysis: PageAnalysis): boolean {
  let score = 0;
  let totalChecks = 0;

  // Check meta tags
  if (pattern.patterns.meta && pattern.patterns.meta.length > 0) {
    totalChecks++;
    if (
      pattern.patterns.meta.some(
        (m) =>
          Object.values(analysis.metas).some((val) => val.toLowerCase().includes(m.toLowerCase()))
      )
    ) {
      score++;
    }
  }

  // Check scripts
  if (pattern.patterns.script && pattern.patterns.script.length > 0) {
    totalChecks++;
    if (
      pattern.patterns.script.some((s) =>
        analysis.scripts.some((script) => script.toLowerCase().includes(s.toLowerCase()))
      )
    ) {
      score++;
    }
  }

  // Check HTML content
  if (pattern.patterns.html && pattern.patterns.html.length > 0) {
    totalChecks++;
    if (
      pattern.patterns.html.some((h) => analysis.html.toLowerCase().includes(h.toLowerCase()))
    ) {
      score++;
    }
  }

  // Check headers
  if (pattern.patterns.headers && pattern.patterns.headers.length > 0) {
    totalChecks++;
    if (
      pattern.patterns.headers.some((h) =>
        Object.entries(analysis.headers).some(
          ([key, val]) =>
            `${key}: ${val}`.toLowerCase().includes(h.toLowerCase()) ||
            val.toLowerCase().includes(h.toLowerCase())
        )
      )
    ) {
      score++;
    }
  }

  // Check cookies
  if (pattern.patterns.cookies && pattern.patterns.cookies.length > 0) {
    totalChecks++;
    if (
      pattern.patterns.cookies.some((c) =>
        analysis.cookies.some((cookie) => cookie.toLowerCase().includes(c.toLowerCase()))
      )
    ) {
      score++;
    }
  }

  // Match if at least one check passes
  return score > 0 && totalChecks > 0;
}

/**
 * Detect version from pattern
 */
function detectVersion(pattern: DetectionPattern, analysis: PageAnalysis): string | null {
  if (!pattern.version) return null;

  // Check generator meta tag
  if (pattern.version.generator) {
    const generatorValue = analysis.metas.generator || '';
    const regex = new RegExp(pattern.version.generator);
    const match = generatorValue.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Infer backend technology from CMS/framework
 */
function inferBackend(
  cms: string | null,
  framework: string | null,
  _detectedTechs: string[]
): string | null {
  // CMS-based inference
  if (cms === 'Drupal' || cms === 'WordPress') return 'PHP';
  if (cms === 'Magnolia') return 'Java';
  if (cms === 'Umbraco') return '.NET';
  if (cms === 'Strapi' || cms === 'Contentful') return 'Node.js';

  // Framework-based inference
  if (framework === 'Next.js' || framework === 'Nuxt.js') return 'Node.js';
  if (framework === 'ASP.NET') return '.NET';

  return null;
}

/**
 * Infer database from CMS
 */
function inferDatabase(cms: string | null, _detectedTechs: string[]): string | null {
  // CMS-based inference
  if (cms === 'Drupal' || cms === 'WordPress') return 'MySQL/MariaDB';
  if (cms === 'Magnolia') return 'JCR/MySQL';
  if (cms === 'Umbraco') return 'SQL Server';
  if (cms === 'Strapi') return 'PostgreSQL/MySQL';

  return null;
}

/**
 * Determine confidence level
 */
function determineConfidence(
  detectedTechs: string[],
  cms: string | null,
  framework: string | null
): 'high' | 'medium' | 'low' {
  if (cms && detectedTechs.length >= 3) return 'high';
  if (cms || framework) return 'medium';
  if (detectedTechs.length > 0) return 'low';
  return 'low';
}

/**
 * Extract page analysis from HTML and headers
 */
export function analyzePageContent(
  html: string,
  headers: Record<string, string>
): PageAnalysis {
  // Extract scripts
  const scriptMatches = Array.from(html.matchAll(/<script[^>]*src=["']([^"']+)["']/gi));
  const scripts = scriptMatches.map((m) => m[1]);

  // Extract meta tags
  const metas: Record<string, string> = {};
  const metaMatches = Array.from(
    html.matchAll(/<meta[^>]*name=["']([^"']+)["'][^>]*content=["']([^"']+)["']/gi)
  );
  for (const match of metaMatches) {
    metas[match[1].toLowerCase()] = match[2];
  }

  // Also check property metas (og:, etc.)
  const propertyMetaMatches = Array.from(
    html.matchAll(/<meta[^>]*property=["']([^"']+)["'][^>]*content=["']([^"']+)["']/gi)
  );
  for (const match of propertyMetaMatches) {
    metas[match[1].toLowerCase()] = match[2];
  }

  // Extract cookies from Set-Cookie headers
  const cookies: string[] = [];
  if (headers['set-cookie']) {
    cookies.push(headers['set-cookie']);
  }

  return {
    html,
    headers,
    cookies,
    scripts,
    metas,
  };
}
