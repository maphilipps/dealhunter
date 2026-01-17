/**
 * URL Validation Utilities
 * Protects against SSRF (Server-Side Request Forgery) attacks
 */

/**
 * Checks if a URL points to an internal/private network resource
 * Blocks localhost, private IP ranges (RFC 1918), and link-local addresses
 *
 * @param url - The URL to validate
 * @returns true if the URL is internal/private and should be blocked
 * @throws Error if URL is malformed
 */
export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost variants
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0'
    ) {
      return true;
    }

    // Check for IPv4 addresses
    const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
    const ipv4Match = hostname.match(ipv4Regex);

    if (ipv4Match) {
      const [, a, b, c, d] = ipv4Match.map(Number);

      // Validate IP octets are in valid range
      if (a > 255 || b > 255 || c > 255 || d > 255) {
        return true; // Invalid IP, block it
      }

      // Block private networks (RFC 1918)
      // 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
      if (a === 10) {
        return true;
      }

      // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
      if (a === 172 && b >= 16 && b <= 31) {
        return true;
      }

      // 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
      if (a === 192 && b === 168) {
        return true;
      }

      // Block link-local addresses (RFC 3927)
      // 169.254.0.0/16 (169.254.0.0 - 169.254.255.255)
      if (a === 169 && b === 254) {
        return true;
      }

      // Block loopback range
      // 127.0.0.0/8 (127.0.0.0 - 127.255.255.255)
      if (a === 127) {
        return true;
      }

      // Block 0.0.0.0/8 (current network)
      if (a === 0) {
        return true;
      }

      // Block 224.0.0.0/4 (multicast)
      if (a >= 224 && a <= 239) {
        return true;
      }

      // Block 240.0.0.0/4 (reserved)
      if (a >= 240) {
        return true;
      }
    }

    // Check for IPv6 localhost and link-local
    if (hostname.includes(':')) {
      const lower = hostname.toLowerCase();

      // IPv6 localhost
      if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') {
        return true;
      }

      // IPv6 link-local (fe80::/10)
      if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) {
        return true;
      }

      // IPv6 unique local (fc00::/7)
      if (lower.startsWith('fc') || lower.startsWith('fd')) {
        return true;
      }
    }

    return false;
  } catch (error) {
    // If URL parsing fails, treat it as internal to be safe
    return true;
  }
}

/**
 * Validates a URL before fetching to prevent SSRF attacks
 *
 * @param url - The URL to validate
 * @throws Error if URL is internal/private or invalid
 */
export function validateUrlForFetch(url: string): void {
  if (isInternalUrl(url)) {
    throw new Error(
      'URL validation failed: Cannot fetch internal URLs, localhost, or private IP addresses. ' +
      'This request has been blocked for security reasons.'
    );
  }

  // Additional protocol validation
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:'];

    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new Error(
        `URL validation failed: Protocol "${parsed.protocol}" is not allowed. ` +
        'Only HTTP and HTTPS are supported.'
      );
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('URL validation failed: Invalid URL format');
    }
    throw error;
  }
}
