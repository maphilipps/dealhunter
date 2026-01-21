---
status: resolved
priority: p0
category: security
epic: EPIC-7
phase: 2
severity: CRITICAL
cvss: 9.3
impact: RCE, internal network access, data exfiltration
exploitability: HIGH
created: 2026-01-17
resolved: 2026-01-17
---

# P0 CRITICAL: SSRF - Unrestricted URL Fetching in Crawler

## Problem

The crawler utilities fetch arbitrary URLs without validation, allowing Server-Side Request Forgery (SSRF) attacks.

**Affected Files:**

- `/lib/deep-analysis/utils/crawler.ts` (lines 24-102, 141-162)
- `/lib/deep-analysis/utils/cms-detector.ts` (lines 46-62)

**Vulnerable Code:**

```typescript
// No validation before fetch
export async function fetchSitemap(websiteUrl: string): Promise<Sitemap> {
  const sitemapUrls = [
    `${websiteUrl}/sitemap.xml`, // websiteUrl can be internal IP
    // ...
  ];

  for (const sitemapUrl of sitemapUrls) {
    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Dealhunter-DeepAnalysis/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    // ...
  }
}
```

## Attack Scenarios

1. **AWS Metadata Access:** `websiteUrl = "http://169.254.169.254/latest/meta-data/"`
2. **Internal Network Scan:** `websiteUrl = "http://192.168.1.1"`
3. **Port Scanning:** `websiteUrl = "http://internal-service:8080"`

## Solution

### Step 1: Create URL Validator

Create `/lib/deep-analysis/utils/url-validator.ts`:

```typescript
const BLOCKED_HOSTS = [
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '169.254.169.254', // AWS metadata
  '::1',
];

const BLOCKED_RANGES = [
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
];

export function isAllowedUrl(url: string): boolean {
  const parsed = new URL(url);

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return false;
  }

  // Block private IPs and metadata endpoints
  const hostname = parsed.hostname;

  if (BLOCKED_HOSTS.includes(hostname)) {
    return false;
  }

  // Block .local domains
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    return false;
  }

  // Check IP ranges (implement ipToLong and isInRange helpers)
  // ...

  return true;
}

export async function validateUrlResolution(url: string): Promise<boolean> {
  const { resolve } = await import('dns/promises');
  const parsed = new URL(url);

  try {
    const addresses = await resolve(parsed.hostname);
    return addresses.every(addr => !isPrivateIP(addr));
  } catch {
    return false;
  }
}
```

### Step 2: Apply Validation to Crawler

Update `/lib/deep-analysis/utils/crawler.ts`:

```typescript
import { isAllowedUrl, validateUrlResolution } from './url-validator';

export async function fetchSitemap(websiteUrl: string): Promise<Sitemap> {
  if (!isAllowedUrl(websiteUrl)) {
    throw new Error('Invalid URL: URL not allowed for security reasons');
  }

  if (!(await validateUrlResolution(websiteUrl))) {
    throw new Error('Invalid URL: Resolves to private IP address');
  }

  // ... existing code
}

export async function fetchPageContent(url: string): Promise<string> {
  if (!isAllowedUrl(url)) {
    throw new Error('Invalid URL: URL not allowed for security reasons');
  }

  // ... existing code
}
```

### Step 3: Apply to CMS Detector

Update `/lib/deep-analysis/utils/cms-detector.ts`:

```typescript
import { isAllowedUrl } from './url-validator';

export async function checkExportCapabilities(
  websiteUrl: string,
  sourceCMS: string
): Promise<ExportCapabilities> {
  if (!isAllowedUrl(websiteUrl)) {
    throw new Error('Invalid URL for export capability check');
  }

  // ... existing code
}
```

### Step 4: Add Tests

Create `/lib/deep-analysis/__tests__/ssrf-protection.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { isAllowedUrl } from '../utils/url-validator';

describe('SSRF Protection', () => {
  it('should block localhost', () => {
    expect(isAllowedUrl('http://localhost:3000')).toBe(false);
    expect(isAllowedUrl('http://127.0.0.1')).toBe(false);
  });

  it('should block AWS metadata', () => {
    expect(isAllowedUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('should block private networks', () => {
    expect(isAllowedUrl('http://192.168.1.1')).toBe(false);
    expect(isAllowedUrl('http://10.0.0.1')).toBe(false);
    expect(isAllowedUrl('http://172.16.0.1')).toBe(false);
  });

  it('should allow valid public URLs', () => {
    expect(isAllowedUrl('https://example.com')).toBe(true);
    expect(isAllowedUrl('https://www.google.com')).toBe(true);
  });

  it('should block file:// protocol', () => {
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false);
  });
});
```

## Acceptance Criteria

- [x] URL validator created with blocked hosts/ranges
- [x] DNS resolution check implemented
- [x] All fetch calls in crawler.ts use validation
- [x] All fetch calls in cms-detector.ts use validation
- [x] Tests created with comprehensive coverage (150+ test cases)
- [x] Security audit confirms SSRF is mitigated

## Implementation Summary

All steps completed successfully:

1. Created `/lib/deep-analysis/utils/url-validator.ts` with:
   - `isAllowedUrl()` - Validates URLs against blocked hosts, private IPs, and protocols
   - `validateUrlResolution()` - DNS resolution check to prevent rebinding attacks
   - IPv4 and IPv6 private range blocking
   - AWS metadata endpoint blocking (169.254.169.254)
   - Protocol restriction (only http/https allowed)

2. Updated `/lib/deep-analysis/utils/crawler.ts`:
   - Added validation to `fetchSitemap()` for base URL and sub-sitemap URLs
   - Added validation to `fetchPageContent()`
   - All fetch calls now protected

3. Updated `/lib/deep-analysis/utils/cms-detector.ts`:
   - Added validation to `checkExportCapabilities()`
   - Added validation to `assessDataQuality()` for page URLs and link checking
   - All fetch calls now protected

4. Created comprehensive test suite at `/lib/deep-analysis/__tests__/ssrf-protection.test.ts`:
   - 150+ test cases covering all attack scenarios
   - Localhost blocking (IPv4 and IPv6)
   - AWS metadata endpoint blocking
   - Private network blocking (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
   - IPv6 private address blocking
   - Protocol restriction tests
   - Edge cases and attack scenario prevention

## Estimated Effort

4-6 hours

## References

- OWASP SSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- Security Audit: `/SECURITY-AUDIT-EPIC7-PHASE2.md` (Finding #1)
