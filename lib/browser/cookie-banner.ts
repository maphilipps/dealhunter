/**
 * Cookie Banner Dismissal via agent-browser
 * Uses accessibility snapshot to find and click accept buttons
 */

import { getSnapshot, click, wait } from './agent-browser';
import type { BrowserSession, CookieBannerResult, SnapshotElement } from './types';

// ========================================
// Cookie Banner Keywords
// ========================================

/**
 * Keywords that indicate a cookie accept button (German + English)
 * Ordered by specificity (most specific first)
 */
const ACCEPT_KEYWORDS = [
  // German - explicit accept all
  'alle akzeptieren',
  'alle cookies akzeptieren',
  'alle annehmen',
  'alles akzeptieren',
  // English - explicit accept all
  'accept all',
  'accept all cookies',
  'allow all',
  'allow all cookies',
  // German - general accept
  'akzeptieren',
  'zustimmen',
  'einverstanden',
  'annehmen',
  'erlauben',
  // English - general accept
  'accept',
  'agree',
  'allow',
  'ok',
  'got it',
  'i agree',
  'i accept',
  // Common patterns
  'accept & close',
  'accept and close',
  'continue',
  'weiter',
];

/**
 * Keywords that indicate a cookie banner container
 */
const BANNER_KEYWORDS = ['cookie', 'consent', 'privacy', 'gdpr', 'dsgvo', 'datenschutz'];

// ========================================
// Detection Logic
// ========================================

/**
 * Check if an element name matches cookie accept keywords
 */
function isAcceptButton(element: SnapshotElement): boolean {
  const name = (element.name || '').toLowerCase().trim();
  const role = element.role?.toLowerCase();

  // Must be a button or link
  if (!['button', 'link', 'menuitem'].includes(role || '')) {
    return false;
  }

  // Check against keywords
  for (const keyword of ACCEPT_KEYWORDS) {
    if (name.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if element is part of a cookie banner
 */
function isInCookieBanner(element: SnapshotElement, ancestors: SnapshotElement[] = []): boolean {
  // Check element name
  const name = (element.name || '').toLowerCase();
  for (const keyword of BANNER_KEYWORDS) {
    if (name.includes(keyword)) {
      return true;
    }
  }

  // Check ancestors (modal, dialog, banner)
  for (const ancestor of ancestors) {
    const ancestorName = (ancestor.name || '').toLowerCase();
    const ancestorRole = ancestor.role?.toLowerCase();

    // Check if ancestor is a dialog/modal
    if (['dialog', 'alertdialog', 'banner'].includes(ancestorRole || '')) {
      return true;
    }

    // Check ancestor name for keywords
    for (const keyword of BANNER_KEYWORDS) {
      if (ancestorName.includes(keyword)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find accept button in snapshot tree
 */
function findAcceptButton(
  elements: SnapshotElement[],
  ancestors: SnapshotElement[] = []
): SnapshotElement | null {
  // First pass: look for buttons with accept keywords
  const candidates: Array<{ element: SnapshotElement; score: number }> = [];

  function traverse(element: SnapshotElement, path: SnapshotElement[]) {
    if (isAcceptButton(element)) {
      // Calculate score based on keyword position and banner context
      let score = 0;
      const name = (element.name || '').toLowerCase();

      // Higher score for more specific keywords
      for (let i = 0; i < ACCEPT_KEYWORDS.length; i++) {
        if (name.includes(ACCEPT_KEYWORDS[i])) {
          score = ACCEPT_KEYWORDS.length - i;
          break;
        }
      }

      // Bonus if in cookie banner context
      if (isInCookieBanner(element, path)) {
        score += 100;
      }

      candidates.push({ element, score });
    }

    // Traverse children
    if (element.children) {
      for (const child of element.children) {
        traverse(child, [...path, element]);
      }
    }
  }

  for (const element of elements) {
    traverse(element, ancestors);
  }

  // Sort by score (highest first) and return best match
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score > 0) {
    return candidates[0].element;
  }

  return null;
}

// ========================================
// Main Function
// ========================================

/**
 * Attempt to dismiss cookie consent banner
 * Uses accessibility snapshot to find and click accept buttons
 */
export async function dismissCookieBanner(
  options: BrowserSession = {}
): Promise<CookieBannerResult> {
  // Wait a moment for banner to appear
  await wait(1000);

  // Get interactive snapshot
  const snapshot = await getSnapshot({ ...options, interactive: true });

  if (!snapshot || !snapshot.elements) {
    return { dismissed: false };
  }

  // Find accept button
  const acceptButton = findAcceptButton(snapshot.elements);

  if (!acceptButton || !acceptButton.ref) {
    return { dismissed: false };
  }

  // Click the button
  const clicked = await click(acceptButton.ref, options);

  if (clicked) {
    // Wait for banner to disappear
    await wait(500);

    const buttonName = acceptButton.name || acceptButton.ref;

    return {
      dismissed: true,
      method: buttonName,
    };
  }

  return { dismissed: false };
}

/**
 * Check if cookie banner is present (without dismissing)
 */
export async function hasCookieBanner(options: BrowserSession = {}): Promise<boolean> {
  const snapshot = await getSnapshot({ ...options, interactive: true });

  if (!snapshot || !snapshot.elements) {
    return false;
  }

  const acceptButton = findAcceptButton(snapshot.elements);
  return acceptButton !== null;
}
