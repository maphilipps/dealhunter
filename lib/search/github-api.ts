/**
 * GitHub API Integration
 *
 * Holt aktuelle Daten von GitHub Repositories (Versionen, Stars, Releases)
 * Kostenlos, keine Auth nötig für public repos
 */

interface GitHubRepoInfo {
  latestVersion?: string;
  githubStars?: number;
  lastRelease?: string; // YYYY-MM-DD
  license?: string;
  description?: string;
  error?: string;
}

/**
 * Extrahiert owner/repo aus einer GitHub URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;

  // Unterstütze verschiedene Formate:
  // https://github.com/drupal/drupal
  // https://github.com/drupal/drupal.git
  // github.com/drupal/drupal
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/i);
  if (!match) return null;

  return { owner: match[1], repo: match[2] };
}

/**
 * Holt Repository-Informationen von GitHub
 */
export async function fetchGitHubRepoInfo(githubUrl: string): Promise<GitHubRepoInfo> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    return { error: 'Invalid GitHub URL' };
  }

  const { owner, repo } = parsed;

  try {
    // Parallele Requests für Repo-Info und Latest Release
    const [repoResponse, releaseResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DealHunter/1.0',
        },
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DealHunter/1.0',
        },
        signal: AbortSignal.timeout(10000),
      }).catch(() => null), // Release kann fehlen
    ]);

    if (!repoResponse.ok) {
      return { error: `GitHub API error: ${repoResponse.status}` };
    }

    const repoData = await repoResponse.json();

    const result: GitHubRepoInfo = {
      githubStars: repoData.stargazers_count,
      description: repoData.description,
    };

    // License
    if (repoData.license?.spdx_id) {
      result.license = repoData.license.spdx_id;
    }

    // Latest Release
    if (releaseResponse?.ok) {
      const releaseData = await releaseResponse.json();
      if (releaseData.tag_name) {
        result.latestVersion = releaseData.tag_name.replace(/^v/, '');
      }
      if (releaseData.published_at) {
        result.lastRelease = releaseData.published_at.split('T')[0];
      }
    } else {
      // Fallback: Tags abrufen wenn keine Releases
      try {
        const tagsResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/tags?per_page=1`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'DealHunter/1.0',
            },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (tagsResponse.ok) {
          const tags = await tagsResponse.json();
          if (tags.length > 0) {
            result.latestVersion = tags[0].name.replace(/^v/, '');
          }
        }
      } catch {
        // Ignore tag fetch errors
      }
    }

    console.log(`[GitHub API] ${owner}/${repo}: v${result.latestVersion}, ${result.githubStars} stars`);

    return result;
  } catch (error) {
    console.error('[GitHub API] Error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Bekannte GitHub URLs für CMS-Systeme
 * Fallback wenn keine githubUrl in der DB
 */
export const KNOWN_GITHUB_REPOS: Record<string, string> = {
  'drupal': 'https://github.com/drupal/drupal',
  'wordpress': 'https://github.com/WordPress/WordPress',
  'typo3': 'https://github.com/TYPO3/typo3',
  'joomla': 'https://github.com/joomla/joomla-cms',
  'contentful': '', // SaaS, kein GitHub
  'strapi': 'https://github.com/strapi/strapi',
  'directus': 'https://github.com/directus/directus',
  'payload': 'https://github.com/payloadcms/payload',
  'sanity': 'https://github.com/sanity-io/sanity',
  'ghost': 'https://github.com/TryGhost/Ghost',
  'keystonejs': 'https://github.com/keystonejs/keystone',
  'wagtail': 'https://github.com/wagtail/wagtail',
  'umbraco': 'https://github.com/umbraco/Umbraco-CMS',
  'sitecore': '', // Proprietary
  'adobe experience manager': '', // Proprietary
  'kentico': '', // Proprietary (Kentico Xperience)
  'magnolia': 'https://github.com/magnolia-cms/magnolia-cms',
  'craftcms': 'https://github.com/craftcms/cms',
  'october': 'https://github.com/octobercms/october',
  'concrete5': 'https://github.com/concretecms/concretecms',
  'silverstripe': 'https://github.com/silverstripe/silverstripe-framework',
  'neos': 'https://github.com/neos/neos',
  'pimcore': 'https://github.com/pimcore/pimcore',
  'ibexa': 'https://github.com/ibexa/oss',
  'contao': 'https://github.com/contao/contao',
  'processwire': 'https://github.com/processwire/processwire',
};

/**
 * Findet GitHub URL für eine Technologie
 */
export function findGitHubUrl(techName: string, existingUrl?: string | null): string | null {
  if (existingUrl) return existingUrl;

  const normalized = techName.toLowerCase().trim();

  // Exakte Matches
  if (KNOWN_GITHUB_REPOS[normalized]) {
    return KNOWN_GITHUB_REPOS[normalized];
  }

  // Partial Matches
  for (const [key, url] of Object.entries(KNOWN_GITHUB_REPOS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return url || null;
    }
  }

  return null;
}
