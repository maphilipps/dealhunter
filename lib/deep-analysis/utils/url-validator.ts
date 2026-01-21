/**
 * URL validation utilities for SSRF protection
 * Prevents Server-Side Request Forgery by blocking private IPs and metadata endpoints
 */

const BLOCKED_HOSTS = [
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '169.254.169.254', // AWS metadata
  '::1', // IPv6 localhost
  '::ffff:127.0.0.1', // IPv4-mapped IPv6 localhost
];

interface IPRange {
  start: string;
  end: string;
}

const BLOCKED_RANGES: IPRange[] = [
  { start: '192.168.0.0', end: '192.168.255.255' }, // Private network
  { start: '10.0.0.0', end: '10.255.255.255' }, // Private network
  { start: '172.16.0.0', end: '172.31.255.255' }, // Private network
  { start: '100.64.0.0', end: '100.127.255.255' }, // Carrier-grade NAT
  { start: '169.254.0.0', end: '169.254.255.255' }, // Link-local
  { start: '224.0.0.0', end: '239.255.255.255' }, // Multicast
  { start: '240.0.0.0', end: '255.255.255.255' }, // Reserved
];

/**
 * Convert IPv4 address to numeric representation
 */
function ipToLong(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error('Invalid IPv4 address');
  }

  return (
    parts.reduce((acc, part) => {
      const num = parseInt(part, 10);
      if (num < 0 || num > 255 || isNaN(num)) {
        throw new Error('Invalid IPv4 address');
      }
      return (acc << 8) + num;
    }, 0) >>> 0
  ); // Convert to unsigned 32-bit integer
}

/**
 * Check if an IP address is within a given range
 */
function isInRange(ip: string, range: IPRange): boolean {
  try {
    const ipLong = ipToLong(ip);
    const startLong = ipToLong(range.start);
    const endLong = ipToLong(range.end);

    return ipLong >= startLong && ipLong <= endLong;
  } catch {
    return false;
  }
}

/**
 * Check if an IP address is private or reserved
 */
function isPrivateIP(ip: string): boolean {
  // Check exact matches
  if (BLOCKED_HOSTS.includes(ip)) {
    return true;
  }

  // Check ranges
  return BLOCKED_RANGES.some(range => isInRange(ip, range));
}

/**
 * Check if a URL is allowed for fetching
 * Blocks private IPs, localhost, metadata endpoints, and non-HTTP protocols
 */
export function isAllowedUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false; // Invalid URL
  }

  // Only allow http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variations
  if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
    return false;
  }

  // Block .local domains (mDNS/Bonjour)
  if (hostname.endsWith('.local')) {
    return false;
  }

  // Block .internal domains
  if (hostname.endsWith('.internal')) {
    return false;
  }

  // Check if hostname is an IP address
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    // It's an IPv4 address, check if it's private
    if (isPrivateIP(hostname)) {
      return false;
    }
  }

  // Check for IPv6 localhost and private addresses
  if (hostname.includes(':')) {
    // Remove brackets from IPv6 addresses (e.g., [::1] -> ::1)
    const ipv6Lower = hostname.replace(/^\[|\]$/g, '').toLowerCase();

    // IPv6 localhost
    if (ipv6Lower === '::1' || ipv6Lower === '0:0:0:0:0:0:0:1') {
      return false;
    }

    // IPv6 link-local (fe80::/10)
    if (
      ipv6Lower.startsWith('fe80:') ||
      ipv6Lower.startsWith('fe9') ||
      ipv6Lower.startsWith('fea') ||
      ipv6Lower.startsWith('feb')
    ) {
      return false;
    }

    // IPv6 unique local (fc00::/7)
    if (ipv6Lower.startsWith('fc') || ipv6Lower.startsWith('fd')) {
      return false;
    }

    // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x or ::ffff:7f00:1 in hex form)
    if (ipv6Lower.includes('::ffff:')) {
      const ipv4Part = ipv6Lower.split('::ffff:')[1];

      // Check if it's in dotted notation (e.g., ::ffff:127.0.0.1)
      if (ipv4Part && ipv4Part.includes('.')) {
        if (isPrivateIP(ipv4Part)) {
          return false;
        }
      }

      // Check if it's in hex notation (e.g., ::ffff:7f00:1 = 127.0.0.1)
      // 127.0.0.0/8 = 0x7f00-0x7fff in hex
      if (ipv4Part && ipv4Part.startsWith('7f')) {
        return false; // Block 127.x.x.x range
      }

      // Block other common private IP ranges in hex
      // 10.0.0.0/8 = 0x0a00-0x0aff
      if (ipv4Part && ipv4Part.startsWith('0a')) {
        return false;
      }

      // 192.168.0.0/16 = 0xc0a8
      if (ipv4Part && ipv4Part.startsWith('c0a8')) {
        return false;
      }

      // 172.16.0.0/12 = 0xac10-0xac1f
      if (ipv4Part && ipv4Part.match(/^ac1[0-9a-f]/)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate that a URL does not resolve to a private IP address
 * This prevents DNS rebinding attacks where a public domain resolves to a private IP
 *
 * Note: This requires DNS resolution and should be used with caution in performance-critical paths
 */
export async function validateUrlResolution(url: string): Promise<boolean> {
  // First check basic URL validity
  if (!isAllowedUrl(url)) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // If hostname is already an IP, we already checked it in isAllowedUrl
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(parsed.hostname) || parsed.hostname.includes(':')) {
    return true; // Already validated by isAllowedUrl
  }

  // For domain names, resolve DNS and check all IP addresses
  try {
    // Dynamic import to avoid issues in edge runtime
    const dns = await import('dns/promises');

    try {
      const addresses = await dns.resolve4(parsed.hostname);

      // Check if any resolved IP is private
      for (const address of addresses) {
        if (isPrivateIP(address)) {
          return false;
        }
      }
    } catch {
      // If IPv4 resolution fails, try IPv6
      try {
        const addresses = await dns.resolve6(parsed.hostname);

        // For IPv6, just check basic patterns (full validation is complex)
        for (const address of addresses) {
          const lower = address.toLowerCase();

          // Check localhost and private ranges
          if (
            lower === '::1' ||
            lower.startsWith('fe80:') ||
            lower.startsWith('fc') ||
            lower.startsWith('fd')
          ) {
            return false;
          }
        }
      } catch {
        // DNS resolution failed - could be NXDOMAIN or network issue
        // Fail closed for security
        return false;
      }
    }

    return true;
  } catch {
    // DNS module not available (edge runtime) or other error
    // In this case, fall back to basic URL validation only
    console.warn('DNS resolution not available, using basic URL validation only');
    return true;
  }
}
