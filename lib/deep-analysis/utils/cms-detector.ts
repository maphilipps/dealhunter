/**
 * CMS detection and export capabilities assessment
 */

import * as cheerio from 'cheerio';

export interface ExportCapabilities {
  restAPI: boolean;
  xmlExport: boolean;
  cliTool: boolean;
  databaseAccess: boolean;
}

export interface DataQuality {
  brokenLinks: number;
  duplicateContent: boolean;
  inconsistentStructure: boolean;
}

/**
 * Checks available export mechanisms for a given CMS
 * Makes HEAD requests to common API endpoints and export tools
 */
export async function checkExportCapabilities(
  websiteUrl: string,
  sourceCMS: string
): Promise<ExportCapabilities> {
  const capabilities: ExportCapabilities = {
    restAPI: false,
    xmlExport: false,
    cliTool: false,
    databaseAccess: false,
  };

  const cmsLower = sourceCMS.toLowerCase();

  // Check REST API endpoints
  const apiEndpoints = [
    '/wp-json/wp/v2', // WordPress REST API
    '/api', // Generic API
    '/rest', // Drupal REST
    '/jsonapi', // Drupal JSON:API
    '?type=1&format=json', // Typo3
  ];

  for (const endpoint of apiEndpoints) {
    try {
      const response = await fetch(`${websiteUrl}${endpoint}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Dealhunter-DeepAnalysis/1.0 (Migration Analysis Bot)',
        },
      });

      if (response.ok) {
        capabilities.restAPI = true;
        break;
      }
    } catch (error) {
      // Ignore, try next endpoint
    }
  }

  // CMS-specific checks
  if (cmsLower.includes('wordpress')) {
    capabilities.xmlExport = true; // WordPress has built-in XML export
    capabilities.cliTool = true; // WP-CLI
  }

  if (cmsLower.includes('drupal')) {
    capabilities.xmlExport = false; // Drupal doesn't have built-in XML export
    capabilities.cliTool = true; // Drush
    capabilities.databaseAccess = true; // Direct DB access is common
  }

  if (cmsLower.includes('typo3')) {
    capabilities.xmlExport = true; // TYPO3 has XML export
    capabilities.cliTool = true; // TYPO3 Console
  }

  return capabilities;
}

/**
 * Assesses data quality by checking for broken links and duplicates
 * Samples 20 pages and checks link validity
 */
export async function assessDataQuality(
  websiteUrl: string,
  sampleUrls: string[] = []
): Promise<DataQuality> {
  let brokenLinks = 0;
  let duplicateContent = false;
  let inconsistentStructure = false;

  // Sample a few pages to check links (limit to 5 to avoid long execution)
  const pagesToCheck = sampleUrls.slice(0, 5);

  const allLinks: string[] = [];
  const contentHashes = new Set<string>();

  for (const pageUrl of pagesToCheck) {
    try {
      const response = await fetch(pageUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Dealhunter-DeepAnalysis/1.0 (Migration Analysis Bot)',
        },
      });

      if (!response.ok) {
        brokenLinks++;
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract links
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && (href.startsWith('http') || href.startsWith('/'))) {
          allLinks.push(href);
        }
      });

      // Simple content hash (first 500 chars of body text)
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 500);
      const hash = simpleHash(bodyText);

      if (contentHashes.has(hash)) {
        duplicateContent = true;
      }
      contentHashes.add(hash);

      // Check for inconsistent structure (different number of nav items)
      const navItems = $('nav a').length;
      if (navItems === 0) {
        inconsistentStructure = true;
      }
    } catch (error) {
      brokenLinks++;
    }
  }

  // Check if links are broken (sample 10 links max)
  const linksToCheck = allLinks.slice(0, 10);
  for (const link of linksToCheck) {
    try {
      const fullUrl = link.startsWith('http') ? link : `${websiteUrl}${link}`;
      const response = await fetch(fullUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Dealhunter-DeepAnalysis/1.0 (Migration Analysis Bot)',
        },
      });

      if (!response.ok) {
        brokenLinks++;
      }
    } catch (error) {
      brokenLinks++;
    }
  }

  return {
    brokenLinks,
    duplicateContent,
    inconsistentStructure,
  };
}

/**
 * Simple string hash function (not cryptographic)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
