/**
 * Navigation Crawler Tool using agent-browser CLI
 * Crawls the full navigation structure of a website
 */

import {
  openPage,
  closeBrowser,
  evaluate,
  createSession,
  wait,
  type BrowserSession,
} from '@/lib/browser';

import type { SiteTree, SiteTreeNode } from '../schema';

// ========================================
// Types
// ========================================

interface CrawlOptions {
  maxDepth?: number;
  maxPages?: number;
  timeout?: number;
  followExternalLinks?: boolean;
}

interface NavItem {
  label: string;
  url?: string;
  children?: NavItem[];
}

interface CrawlResult {
  siteTree: SiteTree;
  discoveredUrls: string[];
  errors: string[];
}

// ========================================
// Navigation Extraction
// ========================================

/**
 * Extract navigation structure from a page using evaluate
 */
async function extractNavigation(session: BrowserSession): Promise<{
  mainNav: NavItem[];
  footerNav: NavItem[];
  hasSearch: boolean;
  hasBreadcrumbs: boolean;
  hasMegaMenu: boolean;
  stickyHeader: boolean;
  mobileMenu: boolean;
}> {
  const result = await evaluate<{
    mainNav: NavItem[];
    footerNav: NavItem[];
    hasSearch: boolean;
    hasBreadcrumbs: boolean;
    hasMegaMenu: boolean;
    stickyHeader: boolean;
    mobileMenu: boolean;
  }>(
    `
    const mainNavItems = [];
    const footerNavItems = [];

    // Extract main navigation
    const navSelectors = [
      'nav:not(footer nav)',
      'header nav',
      '[role="navigation"]:not(footer [role="navigation"])',
      '.main-nav',
      '.navbar',
      '.navigation',
      '#main-menu',
      '.primary-menu',
    ];

    for (const selector of navSelectors) {
      const nav = document.querySelector(selector);
      if (nav) {
        const topLevelItems = nav.querySelectorAll(
          ':scope > ul > li, :scope > div > a, :scope > a'
        );
        topLevelItems.forEach(item => {
          const link =
            item.querySelector('a') || (item.tagName === 'A' ? item : null);
          if (!link) return;

          const navItem = {
            label: (link.textContent || '').trim().slice(0, 50),
            url: link.getAttribute('href') || undefined,
            children: [],
          };

          // Look for sub-items
          const subMenu = item.querySelector('ul, .submenu, .dropdown-menu');
          if (subMenu) {
            const subItems = subMenu.querySelectorAll(':scope > li > a, :scope > a');
            subItems.forEach(subLink => {
              navItem.children.push({
                label: (subLink.textContent || '').trim().slice(0, 50),
                url: subLink.getAttribute('href') || undefined,
              });
            });
          }

          if (navItem.label && !mainNavItems.some(n => n.label === navItem.label)) {
            mainNavItems.push(navItem);
          }
        });
        break; // Only process first found nav
      }
    }

    // Extract footer navigation
    const footer = document.querySelector('footer');
    if (footer) {
      const footerLinks = footer.querySelectorAll('a');
      footerLinks.forEach(link => {
        const label = (link.textContent || '').trim().slice(0, 50);
        if (label && !footerNavItems.some(n => n.label === label)) {
          footerNavItems.push({
            label,
            url: link.getAttribute('href') || undefined,
          });
        }
      });
    }

    // Detect features
    const hasSearch = !!(
      document.querySelector('input[type="search"]') ||
      document.querySelector('[role="search"]') ||
      document.querySelector('.search-form') ||
      document.querySelector('#search') ||
      document.querySelector('.searchbox')
    );

    const hasBreadcrumbs = !!(
      document.querySelector('[aria-label*="breadcrumb" i]') ||
      document.querySelector('.breadcrumb') ||
      document.querySelector('.breadcrumbs') ||
      document.querySelector('[itemtype*="BreadcrumbList"]')
    );

    const hasMegaMenu = !!(
      document.querySelector('.mega-menu') ||
      document.querySelector('.megamenu') ||
      document.querySelectorAll('nav ul ul ul').length > 0 ||
      document.querySelectorAll('nav .dropdown-menu .dropdown-menu').length > 0
    );

    // Check for sticky header
    const header = document.querySelector('header');
    const stickyHeader = header
      ? getComputedStyle(header).position === 'fixed' ||
        getComputedStyle(header).position === 'sticky'
      : false;

    // Check for mobile menu
    const mobileMenu = !!(
      document.querySelector('.hamburger') ||
      document.querySelector('.mobile-menu') ||
      document.querySelector('[class*="burger"]') ||
      document.querySelector('[aria-label*="menu" i]')
    );

    return {
      mainNav: mainNavItems.slice(0, 25),
      footerNav: footerNavItems.slice(0, 40),
      hasSearch,
      hasBreadcrumbs,
      hasMegaMenu,
      stickyHeader,
      mobileMenu,
    };
  `,
    session
  );

  return (
    result || {
      mainNav: [],
      footerNav: [],
      hasSearch: false,
      hasBreadcrumbs: false,
      hasMegaMenu: false,
      stickyHeader: false,
      mobileMenu: false,
    }
  );
}

/**
 * Extract all internal links from a page
 */
async function extractLinks(session: BrowserSession, baseUrl: string): Promise<string[]> {
  const baseUrlObj = new URL(baseUrl);
  const baseDomain = baseUrlObj.hostname;

  const links = await evaluate<string[]>(
    `
    const domain = "${baseDomain}";
    const links = new Set();
    document.querySelectorAll('a[href]').forEach(anchor => {
      const href = anchor.getAttribute('href');
      if (!href) return;

      try {
        const url = new URL(href, window.location.origin);
        // Only internal links
        if (
          url.hostname === domain ||
          url.hostname === 'www.' + domain ||
          domain === 'www.' + url.hostname
        ) {
          // Clean URL
          const cleanUrl = (url.origin + url.pathname).replace(/\\/$/, '');
          links.add(cleanUrl);
        }
      } catch {
        // Invalid URL, skip
      }
    });
    return Array.from(links);
  `,
    session
  );

  return links || [];
}

// ========================================
// Site Tree Building
// ========================================

/**
 * Build site tree from discovered URLs
 */
function buildSiteTree(urls: string[], baseUrl: string): SiteTreeNode[] {
  const urlObj = new URL(baseUrl);
  const basePath = urlObj.origin;

  // Group URLs by path segments
  const pathMap = new Map<string, { url: string; count: number; children: Map<string, any> }>();

  for (const url of urls) {
    try {
      const urlParsed = new URL(url);
      const pathParts = urlParsed.pathname.split('/').filter(Boolean);

      let current = pathMap;
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (!current.has(part)) {
          current.set(part, {
            url: `${basePath}/${pathParts.slice(0, i + 1).join('/')}`,
            count: 0,
            children: new Map(),
          });
        }
        const node = current.get(part)!;
        node.count++;
        current = node.children;
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Convert to SiteTreeNode array
  function mapToNodes(map: Map<string, any>, depth: number): SiteTreeNode[] {
    const nodes: SiteTreeNode[] = [];
    for (const [path, data] of map.entries()) {
      const children = mapToNodes(data.children, depth + 1);
      nodes.push({
        path: `/${path}`,
        url: data.url,
        count: data.count,
        children: children.length > 0 ? children : undefined,
      });
    }
    return nodes.sort((a, b) => b.count - a.count);
  }

  return mapToNodes(pathMap, 0);
}

/**
 * Calculate max depth from site tree
 */
function calculateMaxDepth(nodes: SiteTreeNode[], currentDepth = 1): number {
  let maxDepth = currentDepth;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const childDepth = calculateMaxDepth(node.children, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }
  return maxDepth;
}

// ========================================
// Main Functions
// ========================================

/**
 * Crawl navigation and build full site tree
 */
export async function crawlNavigation(
  url: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const { maxDepth = 3, maxPages = 500, timeout = 30000 } = options;

  const session = createSession('nav-crawler');
  const errors: string[] = [];
  const discoveredUrls = new Set<string>();
  const visitedUrls = new Set<string>();
  const urlQueue: { url: string; depth: number }[] = [];

  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    // Initial page load
    await openPage(fullUrl, session);
    await wait(3000);

    // Extract navigation structure
    const navigation = await extractNavigation(session);

    // Get initial links
    const initialLinks = await extractLinks(session, fullUrl);
    initialLinks.forEach(link => {
      discoveredUrls.add(link);
      urlQueue.push({ url: link, depth: 1 });
    });

    // Add URLs from navigation
    navigation.mainNav.forEach(item => {
      if (item.url && item.url.startsWith('/')) {
        const absUrl = new URL(item.url, fullUrl).toString().replace(/\/$/, '');
        discoveredUrls.add(absUrl);
        urlQueue.push({ url: absUrl, depth: 1 });
      }
      item.children?.forEach(child => {
        if (child.url && child.url.startsWith('/')) {
          const absUrl = new URL(child.url, fullUrl).toString().replace(/\/$/, '');
          discoveredUrls.add(absUrl);
          urlQueue.push({ url: absUrl, depth: 2 });
        }
      });
    });

    visitedUrls.add(fullUrl);

    // Crawl additional pages (BFS)
    while (urlQueue.length > 0 && visitedUrls.size < maxPages) {
      const { url: currentUrl, depth } = urlQueue.shift()!;

      if (visitedUrls.has(currentUrl) || depth > maxDepth) {
        continue;
      }

      try {
        await openPage(currentUrl, session);
        await wait(1500);
        visitedUrls.add(currentUrl);

        if (depth < maxDepth) {
          const links = await extractLinks(session, fullUrl);
          links.forEach(link => {
            if (!visitedUrls.has(link) && !discoveredUrls.has(link)) {
              discoveredUrls.add(link);
              urlQueue.push({ url: link, depth: depth + 1 });
            }
          });
        }
      } catch (err) {
        errors.push(
          `Failed to crawl ${currentUrl}: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }

    await closeBrowser(session);

    // Build site tree
    const allUrls = Array.from(discoveredUrls);
    const sections = buildSiteTree(allUrls, fullUrl);
    const maxTreeDepth = calculateMaxDepth(sections);

    // Count sources
    const sitemapCount = 0;
    let navigationCount = 0;

    navigation.mainNav.forEach(item => {
      if (item.url) navigationCount++;
      item.children?.forEach(() => navigationCount++);
    });

    const siteTree: SiteTree = {
      totalPages: allUrls.length,
      maxDepth: maxTreeDepth,
      crawledAt: new Date().toISOString(),
      sources: {
        sitemap: sitemapCount,
        linkDiscovery: allUrls.length - navigationCount,
        navigation: navigationCount,
      },
      sections: sections.map(node => ({
        path: node.path,
        count: node.count,
        depth: 1,
        children: node.children,
      })),
      navigation: {
        mainNav: navigation.mainNav.map(item => ({
          label: item.label,
          url: item.url,
          children: item.children?.map(child => ({
            label: child.label,
            url: child.url,
          })),
        })),
        footerNav: navigation.footerNav.map(item => ({
          label: item.label,
          url: item.url,
        })),
        breadcrumbs: navigation.hasBreadcrumbs,
        megaMenu: navigation.hasMegaMenu,
        stickyHeader: navigation.stickyHeader,
        mobileMenu: navigation.mobileMenu,
      },
    };

    return {
      siteTree,
      discoveredUrls: allUrls,
      errors,
    };
  } catch (error) {
    await closeBrowser(session);
    throw error;
  }
}

/**
 * Quick navigation scan (homepage only, no deep crawling)
 */
export async function quickNavigationScan(url: string): Promise<{
  mainNav: NavItem[];
  footerNav: NavItem[];
  hasSearch: boolean;
  hasBreadcrumbs: boolean;
  hasMegaMenu: boolean;
  estimatedPages: number;
}> {
  const session = createSession('quick-nav');

  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    await openPage(fullUrl, session);
    await wait(2000);

    const navigation = await extractNavigation(session);
    const links = await extractLinks(session, fullUrl);

    await closeBrowser(session);

    return {
      mainNav: navigation.mainNav,
      footerNav: navigation.footerNav,
      hasSearch: navigation.hasSearch,
      hasBreadcrumbs: navigation.hasBreadcrumbs,
      hasMegaMenu: navigation.hasMegaMenu,
      estimatedPages: links.length,
    };
  } catch (error) {
    await closeBrowser(session);
    throw error;
  }
}
