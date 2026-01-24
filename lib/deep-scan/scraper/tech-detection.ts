import type { TechIndicator } from './types';

interface DetectionContext {
  html: string;
  headers?: Headers;
  cookies?: string[];
  scripts?: string[];
}

interface TechPattern {
  name: string;
  category: TechIndicator['category'];
  patterns: {
    html?: RegExp[];
    scripts?: RegExp[];
    headers?: { name: string; pattern: RegExp }[];
    cookies?: RegExp[];
    meta?: { name: string; pattern: RegExp }[];
  };
}

const TECH_PATTERNS: TechPattern[] = [
  {
    name: 'WordPress',
    category: 'cms',
    patterns: {
      html: [/wp-content/i, /wp-includes/i, /wp-json/i],
      scripts: [/wp-content\/plugins/i, /wp-content\/themes/i],
      meta: [{ name: 'generator', pattern: /WordPress/i }],
    },
  },
  {
    name: 'Drupal',
    category: 'cms',
    patterns: {
      html: [/Drupal\.settings/i, /sites\/default\/files/i],
      scripts: [/drupal\.js/i, /\/core\/misc\//i],
      meta: [{ name: 'generator', pattern: /Drupal/i }],
      headers: [{ name: 'x-drupal-cache', pattern: /.+/ }],
    },
  },
  {
    name: 'TYPO3',
    category: 'cms',
    patterns: {
      html: [/typo3conf/i, /typo3temp/i, /\/typo3\//i],
      scripts: [/typo3conf\/ext/i],
      meta: [{ name: 'generator', pattern: /TYPO3/i }],
    },
  },
  {
    name: 'Joomla',
    category: 'cms',
    patterns: {
      html: [/\/media\/jui\//i, /\/components\/com_/i],
      meta: [{ name: 'generator', pattern: /Joomla/i }],
    },
  },
  {
    name: 'Shopify',
    category: 'cms',
    patterns: {
      html: [/cdn\.shopify\.com/i, /Shopify\.theme/i],
      scripts: [/shopify\.com\/s\/files/i],
    },
  },
  {
    name: 'Magento',
    category: 'cms',
    patterns: {
      html: [/Mage\.Cookies/i, /\/static\/version/i],
      scripts: [/mage\/cookies/i, /requirejs-config\.js/i],
      cookies: [/frontend=/i],
    },
  },
  {
    name: 'React',
    category: 'framework',
    patterns: {
      html: [/__NEXT_DATA__/i, /data-reactroot/i, /_reactRootContainer/i],
      scripts: [/react\.production\.min\.js/i, /react-dom/i],
    },
  },
  {
    name: 'Next.js',
    category: 'framework',
    patterns: {
      html: [/__NEXT_DATA__/i, /_next\/static/i],
      scripts: [/_next\/static\/chunks/i],
    },
  },
  {
    name: 'Vue.js',
    category: 'framework',
    patterns: {
      html: [/data-v-[a-f0-9]+/i, /__VUE__/i],
      scripts: [/vue\.min\.js/i, /vue\.runtime/i],
    },
  },
  {
    name: 'Nuxt.js',
    category: 'framework',
    patterns: {
      html: [/__NUXT__/i, /_nuxt\//i],
      scripts: [/_nuxt\/[a-f0-9]+\.js/i],
    },
  },
  {
    name: 'Angular',
    category: 'framework',
    patterns: {
      html: [/ng-version/i, /ng-app/i, /\[ng-/i],
      scripts: [/angular\.min\.js/i, /zone\.js/i],
    },
  },
  {
    name: 'jQuery',
    category: 'library',
    patterns: {
      scripts: [/jquery[.-]?\d*\.?(min\.)?js/i, /jquery\.com/i],
    },
  },
  {
    name: 'Bootstrap',
    category: 'library',
    patterns: {
      html: [/class="[^"]*\b(container|row|col-)/i],
      scripts: [/bootstrap(\.bundle)?(\.min)?\.js/i],
    },
  },
  {
    name: 'Tailwind CSS',
    category: 'library',
    patterns: {
      html: [/class="[^"]*\b(flex|grid|bg-|text-|p-|m-|w-|h-)[a-z0-9-]+/i],
    },
  },
  {
    name: 'Google Analytics',
    category: 'analytics',
    patterns: {
      html: [/google-analytics\.com\/analytics/i, /gtag\(/i, /UA-\d+-\d+/i],
      scripts: [/googletagmanager\.com\/gtag/i, /google-analytics\.com\/ga\.js/i],
    },
  },
  {
    name: 'Google Tag Manager',
    category: 'analytics',
    patterns: {
      html: [/googletagmanager\.com\/gtm/i, /GTM-[A-Z0-9]+/i],
      scripts: [/googletagmanager\.com\/gtm\.js/i],
    },
  },
  {
    name: 'Matomo',
    category: 'analytics',
    patterns: {
      html: [/_paq\.push/i, /matomo\.js/i],
      scripts: [/matomo\.js/i, /piwik\.js/i],
    },
  },
  {
    name: 'Hotjar',
    category: 'analytics',
    patterns: {
      scripts: [/hotjar\.com/i, /static\.hotjar\.com/i],
    },
  },
  {
    name: 'Cloudflare',
    category: 'hosting',
    patterns: {
      headers: [
        { name: 'cf-ray', pattern: /.+/ },
        { name: 'server', pattern: /cloudflare/i },
      ],
    },
  },
  {
    name: 'Vercel',
    category: 'hosting',
    patterns: {
      headers: [
        { name: 'x-vercel-id', pattern: /.+/ },
        { name: 'server', pattern: /vercel/i },
      ],
    },
  },
  {
    name: 'Netlify',
    category: 'hosting',
    patterns: {
      headers: [
        { name: 'x-nf-request-id', pattern: /.+/ },
        { name: 'server', pattern: /netlify/i },
      ],
    },
  },
  {
    name: 'AWS',
    category: 'hosting',
    patterns: {
      headers: [
        { name: 'x-amz-cf-id', pattern: /.+/ },
        { name: 'server', pattern: /AmazonS3/i },
      ],
    },
  },
];

function extractScriptsFromHtml(html: string): string[] {
  const scripts: string[] = [];
  const scriptMatches = html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi);
  for (const match of scriptMatches) {
    scripts.push(match[1]);
  }
  return scripts;
}

function extractMetaFromHtml(html: string): Map<string, string> {
  const meta = new Map<string, string>();
  const metaMatches = html.matchAll(
    /<meta[^>]*name=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi
  );
  for (const match of metaMatches) {
    meta.set(match[1].toLowerCase(), match[2]);
  }
  const metaMatchesReverse = html.matchAll(
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']([^"']+)["'][^>]*>/gi
  );
  for (const match of metaMatchesReverse) {
    meta.set(match[2].toLowerCase(), match[1]);
  }
  return meta;
}

function detectTech(
  pattern: TechPattern,
  context: DetectionContext,
  meta: Map<string, string>,
  scripts: string[]
): TechIndicator | null {
  const evidences: string[] = [];
  let totalConfidence = 0;
  let checks = 0;

  if (pattern.patterns.html) {
    for (const regex of pattern.patterns.html) {
      checks++;
      if (regex.test(context.html)) {
        evidences.push(`HTML pattern: ${regex.source}`);
        totalConfidence += 0.7;
      }
    }
  }

  if (pattern.patterns.scripts) {
    for (const regex of pattern.patterns.scripts) {
      checks++;
      const matchingScript = scripts.find(s => regex.test(s));
      if (matchingScript) {
        evidences.push(`Script: ${matchingScript}`);
        totalConfidence += 0.8;
      }
    }
  }

  if (pattern.patterns.meta) {
    for (const metaPattern of pattern.patterns.meta) {
      checks++;
      const metaValue = meta.get(metaPattern.name.toLowerCase());
      if (metaValue && metaPattern.pattern.test(metaValue)) {
        evidences.push(`Meta ${metaPattern.name}: ${metaValue}`);
        totalConfidence += 0.95;
      }
    }
  }

  if (pattern.patterns.headers && context.headers) {
    for (const headerPattern of pattern.patterns.headers) {
      checks++;
      const headerValue = context.headers.get(headerPattern.name);
      if (headerValue && headerPattern.pattern.test(headerValue)) {
        evidences.push(`Header ${headerPattern.name}: ${headerValue}`);
        totalConfidence += 0.9;
      }
    }
  }

  if (pattern.patterns.cookies && context.cookies) {
    for (const regex of pattern.patterns.cookies) {
      checks++;
      const matchingCookie = context.cookies.find(c => regex.test(c));
      if (matchingCookie) {
        evidences.push(`Cookie: ${matchingCookie}`);
        totalConfidence += 0.75;
      }
    }
  }

  if (evidences.length === 0) {
    return null;
  }

  const confidence = Math.min(totalConfidence / Math.max(checks * 0.5, 1), 1);

  return {
    name: pattern.name,
    category: pattern.category,
    confidence: Math.round(confidence * 100) / 100,
    evidence: evidences.join('; '),
  };
}

export function detectTechnologies(context: DetectionContext): TechIndicator[] {
  const indicators: TechIndicator[] = [];
  const scripts = context.scripts ?? extractScriptsFromHtml(context.html);
  const meta = extractMetaFromHtml(context.html);

  for (const pattern of TECH_PATTERNS) {
    const indicator = detectTech(pattern, context, meta, scripts);
    if (indicator) {
      indicators.push(indicator);
    }
  }

  indicators.sort((a, b) => b.confidence - a.confidence);

  return indicators;
}

export function mergeTechIndicators(allIndicators: TechIndicator[][]): TechIndicator[] {
  const merged = new Map<string, TechIndicator>();

  for (const indicators of allIndicators) {
    for (const indicator of indicators) {
      const existing = merged.get(indicator.name);
      if (!existing || indicator.confidence > existing.confidence) {
        merged.set(indicator.name, indicator);
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
}
