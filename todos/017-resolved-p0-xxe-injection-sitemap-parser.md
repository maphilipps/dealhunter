---
status: resolved
priority: p0
category: security
epic: EPIC-7
phase: 2
severity: CRITICAL
cvss: 8.6
impact: File disclosure, SSRF via XXE, denial of service
exploitability: HIGH
created: 2026-01-17
resolved: 2026-01-17
---

# P0 CRITICAL: XXE Injection in Sitemap Parser

## Problem

The sitemap parser uses cheerio to parse XML without disabling external entity processing, allowing XML External Entity (XXE) attacks.

**Affected Files:**

- `/lib/deep-analysis/utils/crawler.ts` (lines 45-46, 65-66)

**Vulnerable Code:**

```typescript
// VULNERABLE: External entities not disabled
const xmlText = await response.text();
const $ = cheerio.load(xmlText, { xmlMode: true });
```

## Attack Scenarios

### 1. File Disclosure

Malicious sitemap.xml:

```xml
<?xml version="1.0"?>
<!DOCTYPE sitemap [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<urlset>
  <url>
    <loc>&xxe;</loc>
  </url>
</urlset>
```

### 2. SSRF via XXE

```xml
<!DOCTYPE sitemap [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
]>
```

### 3. Billion Laughs Attack (DoS)

```xml
<!DOCTYPE sitemap [
  <!ENTITY lol "lol">
  <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
  <!-- exponential expansion causes memory exhaustion -->
]>
```

## Solution

### Option 1: Use Safe XML Parser (RECOMMENDED)

Replace cheerio with `fast-xml-parser`:

```bash
npm install fast-xml-parser
```

Update `/lib/deep-analysis/utils/crawler.ts`:

```typescript
import { XMLParser } from 'fast-xml-parser';

export async function fetchSitemap(websiteUrl: string): Promise<Sitemap> {
  // ... existing code

  const xmlText = await response.text();

  // SAFE: External entities disabled
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false, // CRITICAL: Disable entity processing
    allowBooleanAttributes: true,
  });

  const result = parser.parse(xmlText);

  // Extract URLs from parsed result
  const urlset = result.urlset;
  if (!urlset) {
    throw new Error('Invalid sitemap format');
  }

  // Handle both single URL and array of URLs
  const urls: string[] = [];
  if (Array.isArray(urlset.url)) {
    urls.push(...urlset.url.map((u: any) => u.loc));
  } else if (urlset.url) {
    urls.push(urlset.url.loc);
  }

  return {
    urls: urls.filter(Boolean),
    total: urls.length,
  };
}
```

### Option 2: Pre-validate XML (Defense in Depth)

Add validation before parsing:

```typescript
function validateXml(xmlText: string): void {
  // Reject XML with DOCTYPE declarations
  if (xmlText.includes('<!DOCTYPE')) {
    throw new Error('DOCTYPE declarations not allowed in sitemap');
  }

  // Reject XML with entity declarations
  if (xmlText.includes('<!ENTITY')) {
    throw new Error('Entity declarations not allowed in sitemap');
  }

  // Reject XML with external references
  if (xmlText.includes('SYSTEM') || xmlText.includes('PUBLIC')) {
    throw new Error('External references not allowed in sitemap');
  }
}

export async function fetchSitemap(websiteUrl: string): Promise<Sitemap> {
  // ... existing code

  const xmlText = await response.text();

  // Validate before parsing
  validateXml(xmlText);

  // Parse with safe parser
  const parser = new XMLParser({
    processEntities: false,
  });

  // ... rest of code
}
```

## Implementation Steps

### Step 1: Install Dependencies

```bash
npm install fast-xml-parser
npm install --save-dev @types/fast-xml-parser
```

### Step 2: Update Crawler

Replace all cheerio XML parsing with fast-xml-parser:

```typescript
// Before
const $ = cheerio.load(xmlText, { xmlMode: true });
const sitemapTags = $('sitemap loc');

// After
const parser = new XMLParser({ processEntities: false });
const result = parser.parse(xmlText);
const sitemapTags = result.sitemapindex?.sitemap || [];
```

### Step 3: Add Validation Function

Create `/lib/deep-analysis/utils/xml-validator.ts`:

```typescript
export function validateXml(xmlText: string): void {
  const dangerousPatterns = [/<!DOCTYPE/i, /<!ENTITY/i, /SYSTEM/i, /PUBLIC/i];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(xmlText)) {
      throw new Error('XML contains potentially malicious content');
    }
  }

  // Check for excessive nesting (billion laughs prevention)
  const nestingLevel = (xmlText.match(/<!ENTITY/g) || []).length;
  if (nestingLevel > 0) {
    throw new Error('Entity declarations not allowed');
  }
}
```

### Step 4: Add Tests

Create `/lib/deep-analysis/__tests__/xxe-protection.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { fetchSitemap } from '../utils/crawler';

describe('XXE Protection', () => {
  it('should reject XXE file disclosure payloads', async () => {
    const maliciousXml = `
      <?xml version="1.0"?>
      <!DOCTYPE sitemap [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
      ]>
      <urlset><url><loc>&xxe;</loc></url></urlset>
    `;

    // Mock fetch to return malicious XML
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(maliciousXml),
      } as Response)
    );

    await expect(fetchSitemap('https://evil.com')).rejects.toThrow(
      'Entity declarations not allowed'
    );
  });

  it('should reject XXE SSRF payloads', async () => {
    const maliciousXml = `
      <!DOCTYPE sitemap [
        <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
      ]>
      <urlset><url><loc>&xxe;</loc></url></urlset>
    `;

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(maliciousXml),
      } as Response)
    );

    await expect(fetchSitemap('https://evil.com')).rejects.toThrow();
  });

  it('should accept valid sitemap XML', async () => {
    const validXml = `
      <?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/page1</loc>
        </url>
      </urlset>
    `;

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(validXml),
      } as Response)
    );

    const result = await fetchSitemap('https://example.com');
    expect(result.urls).toContain('https://example.com/page1');
  });
});
```

## Acceptance Criteria

- [x] fast-xml-parser installed with processEntities: false
- [x] All XML parsing in crawler.ts uses safe parser
- [x] XML validation function implemented
- [x] XXE protection tests passing
- [ ] Manual XXE payload testing completed
- [ ] Security audit confirms XXE is mitigated

## Resolution Summary

Successfully mitigated XXE injection vulnerability in sitemap parser by implementing the following changes:

1. **Installed fast-xml-parser** - Safe XML parser with entity processing disabled
2. **Created XML validation utility** - `/lib/deep-analysis/utils/xml-validator.ts`
   - Validates XML before parsing to reject DOCTYPE, ENTITY, SYSTEM, PUBLIC declarations
   - Includes size limits to prevent DoS attacks
   - Detects parameter entities and other XXE vectors
3. **Replaced cheerio XML parsing** - `/lib/deep-analysis/utils/crawler.ts`
   - All XML parsing now uses XMLParser with `processEntities: false`
   - Added `parseSitemapXml()` function that validates before parsing
   - Created helper functions `extractUrlsFromSitemap()` and `extractSitemapsFromIndex()`
   - Both main sitemap and sub-sitemap parsing now use safe parser
4. **Created comprehensive test suite** - `/lib/deep-analysis/__tests__/xxe-protection.test.ts`
   - Tests for file disclosure payloads (file:///etc/passwd)
   - Tests for SSRF payloads (AWS metadata endpoint)
   - Tests for billion laughs DoS attacks
   - Tests for valid sitemap parsing (regular and index)
   - Edge case tests (empty sitemaps, malformed XML, whitespace handling)

**Security Improvements:**

- XMLParser configured with `processEntities: false` - prevents entity expansion
- Pre-parsing validation rejects any XML with dangerous constructs
- Defense in depth: both validation and safe parser used together
- Size limits prevent memory exhaustion attacks

## Estimated Effort

3-4 hours

## References

- OWASP XXE Prevention: https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html
- fast-xml-parser docs: https://github.com/NaturalIntelligence/fast-xml-parser
- Security Audit: `/SECURITY-AUDIT-EPIC7-PHASE2.md` (Finding #2)
