// ═══════════════════════════════════════════════════════════════════════════════
// URL CHECK & SUGGESTION AGENT
// Extracted from agent.ts for use in Workflow 2.0
// ═══════════════════════════════════════════════════════════════════════════════

import { validateUrlForFetch } from '@/lib/utils/url-validation';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UrlCheckResult {
  reachable: boolean;
  finalUrl: string;
  suggestedUrl?: string;
  reason?: string;
  statusCode?: number;
  redirectChain?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL ALTERNATIVES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Try common URL alternatives when the original fails
 */
async function tryUrlAlternatives(originalUrl: string): Promise<string | undefined> {
  const url = new URL(originalUrl);
  const alternatives: string[] = [];

  // If path exists, try without it (homepage)
  if (url.pathname !== '/' && url.pathname !== '') {
    alternatives.push(`${url.protocol}//${url.host}/`);
  }

  // Try with/without www
  if (url.hostname.startsWith('www.')) {
    alternatives.push(`${url.protocol}//${url.hostname.replace('www.', '')}${url.pathname}`);
  } else {
    alternatives.push(`${url.protocol}//www.${url.hostname}${url.pathname}`);
  }

  // Try each alternative with a quick check
  for (const altUrl of alternatives) {
    try {
      const response = await fetch(altUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return response.url; // Return the final URL after redirects
      }
    } catch {
      // Continue to next alternative
    }
  }

  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a URL is reachable and suggest alternatives if not
 * - Follows redirects and captures the final URL
 * - Detects canonical URLs from HTML
 * - Provides clear error messages for unreachable URLs
 */
export async function checkAndSuggestUrl(url: string): Promise<UrlCheckResult> {
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  // Validate URL format and security
  try {
    validateUrlForFetch(fullUrl);
  } catch (error) {
    return {
      reachable: false,
      finalUrl: fullUrl,
      reason: error instanceof Error ? error.message : 'Ungültiges URL-Format',
    };
  }

  const redirectChain: string[] = [fullUrl];

  try {
    // Quick HEAD request with redirect following disabled to capture chain
    const response = await fetch(fullUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout for quick check
    });

    // Capture final URL after redirects
    const finalUrl = response.url;
    if (finalUrl !== fullUrl) {
      redirectChain.push(finalUrl);
    }

    // Check status code
    if (response.ok) {
      // URL is reachable
      return {
        reachable: true,
        finalUrl,
        statusCode: response.status,
        redirectChain: redirectChain.length > 1 ? redirectChain : undefined,
        // Suggest the final URL if it differs from input
        suggestedUrl: finalUrl !== fullUrl ? finalUrl : undefined,
      };
    }

    // Handle specific error codes
    if (response.status === 404) {
      // Try common alternatives
      const alternatives = await tryUrlAlternatives(fullUrl);
      return {
        reachable: false,
        finalUrl,
        statusCode: 404,
        reason: 'Seite nicht gefunden (404)',
        suggestedUrl: alternatives,
        redirectChain,
      };
    }

    if (response.status === 403) {
      return {
        reachable: false,
        finalUrl,
        statusCode: 403,
        reason:
          'Zugriff verweigert (403) - Website blockiert möglicherweise automatisierte Zugriffe',
      };
    }

    if (response.status >= 500) {
      return {
        reachable: false,
        finalUrl,
        statusCode: response.status,
        reason: `Server-Fehler (${response.status}) - Website ist momentan nicht erreichbar`,
      };
    }

    return {
      reachable: false,
      finalUrl,
      statusCode: response.status,
      reason: `HTTP-Fehler ${response.status}`,
    };
  } catch (error) {
    // Network errors, DNS failures, timeouts
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';

    // Try to provide helpful suggestions based on error type
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      // DNS resolution failed - domain doesn't exist
      const suggestedUrl = await tryUrlAlternatives(fullUrl);
      return {
        reachable: false,
        finalUrl: fullUrl,
        reason: 'Domain nicht gefunden - prüfen Sie die Schreibweise',
        suggestedUrl,
      };
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        reachable: false,
        finalUrl: fullUrl,
        reason: 'Zeitüberschreitung - Website antwortet nicht',
      };
    }

    if (errorMessage.includes('ECONNREFUSED')) {
      return {
        reachable: false,
        finalUrl: fullUrl,
        reason: 'Verbindung abgelehnt - Server nicht erreichbar',
      };
    }

    if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
      // Try HTTP if HTTPS fails
      if (fullUrl.startsWith('https://')) {
        const httpUrl = fullUrl.replace('https://', 'http://');
        return {
          reachable: false,
          finalUrl: fullUrl,
          reason: 'SSL/Zertifikatsfehler',
          suggestedUrl: httpUrl,
        };
      }
    }

    return {
      reachable: false,
      finalUrl: fullUrl,
      reason: `Verbindungsfehler: ${errorMessage}`,
    };
  }
}
