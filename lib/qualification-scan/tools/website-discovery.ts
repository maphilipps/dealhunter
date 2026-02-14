import { searchAndContents } from '@/lib/search/web-search';

const EXCLUDED_HOSTS = new Set([
  'linkedin.com',
  'www.linkedin.com',
  'xing.com',
  'www.xing.com',
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'wikipedia.org',
  'www.wikipedia.org',
  'kununu.com',
  'www.kununu.com',
  'glassdoor.com',
  'www.glassdoor.com',
]);

// Patterns that indicate cloud/tech/aggregator domains — never a customer website.
const EXCLUDED_HOST_PATTERNS = [
  /\.google\.com$/,
  /\.googleapis\.com$/,
  /\.gstatic\.com$/,
  /\.microsoft\.com$/,
  /\.azure\.com$/,
  /\.amazonaws\.com$/,
  /\.cloudflare\.com$/,
  /\.github\.com$/,
  /\.github\.io$/,
  /\.stackoverflow\.com$/,
  /\.reddit\.com$/,
  /\.youtube\.com$/,
  /\.yelp\.com$/,
  /\.trustpilot\.com$/,
  /\.indeed\.com$/,
  /\.stepstone\.de$/,
  /\.northdata\.de$/,
  /\.firmenwissen\.de$/,
  /\.dnb\.com$/,
  /\.crunchbase\.com$/,
];

function normalizeToOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    // Canonicalize: https + origin only.
    return `https://${u.hostname}`;
  } catch {
    return null;
  }
}

function tokenizeCompanyName(companyName: string): string[] {
  // Very rough: good enough for a heuristic scorer.
  return companyName
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      t =>
        ![
          'gmbh',
          'ag',
          'se',
          'kg',
          'ohg',
          'gbr',
          'ug',
          'inc',
          'ltd',
          'llc',
          'mbh',
          'co',
          'company',
          'gruppe',
          'group',
          'holding',
        ].includes(t)
    )
    .slice(0, 6);
}

function scoreCandidate(hostname: string, tokens: string[]): number {
  const h = hostname.toLowerCase();
  let score = 0;

  // Prefer "official-looking" hosts.
  if (h.startsWith('www.')) score += 1;
  if (h.endsWith('.de')) score += 2;
  if (h.endsWith('.com')) score += 1;

  for (const t of tokens) {
    if (t.length < 3) continue;
    if (h.includes(t)) score += 3;
  }

  // Penalize obviously non-official sites.
  if (h.includes('jobs')) score -= 1;
  if (h.includes('karriere')) score -= 1;
  if (h.includes('blog')) score -= 1;

  return score;
}

/**
 * Discover the official company website URL using web search.
 *
 * Contract: This function MUST perform a web search attempt. If it cannot find a
 * reasonable candidate, it returns null (caller can store "unknown").
 */
export async function discoverCompanyWebsiteUrl(companyName: string): Promise<string | null> {
  const tokens = tokenizeCompanyName(companyName);
  const query = `"${companyName}" offizielle website`;

  const { results } = await searchAndContents(query, { numResults: 8 });
  const candidates = results
    .map(r => r.url)
    .map(normalizeToOrigin)
    .filter((u): u is string => typeof u === 'string');

  const unique = Array.from(new Set(candidates)).filter(u => {
    try {
      const host = new URL(u).hostname.toLowerCase();
      if (EXCLUDED_HOSTS.has(host)) return false;
      if (EXCLUDED_HOST_PATTERNS.some(p => p.test(host))) return false;
      return true;
    } catch {
      return false;
    }
  });

  if (unique.length === 0) return null;

  const scored = unique
    .map(u => {
      const host = new URL(u).hostname;
      return { url: u, score: scoreCandidate(host, tokens) };
    })
    .sort((a, b) => b.score - a.score);

  // Require at least one company-name token to appear in the hostname (score >= 3).
  // Without this, unrelated URLs with high generic scores can slip through.
  const best = scored[0];
  if (!best || best.score < 3) return null;

  return best.url;
}
