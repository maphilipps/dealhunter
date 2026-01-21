/**
 * XXE Protection Tests
 * Ensures that XML parsing is protected against XML External Entity (XXE) attacks
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

import { fetchSitemap } from '../utils/crawler';
import { validateXml } from '../utils/xml-validator';

describe('XXE Protection', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    vi.resetAllMocks();
  });

  describe('validateXml', () => {
    it('should reject XML with DOCTYPE declarations', () => {
      const maliciousXml = `<?xml version="1.0"?>
<!DOCTYPE sitemap [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<urlset><url><loc>&xxe;</loc></url></urlset>`;

      expect(() => validateXml(maliciousXml)).toThrow(
        'XML contains DOCTYPE declaration - not allowed for security reasons'
      );
    });

    it('should reject XML with ENTITY declarations', () => {
      const maliciousXml = `<?xml version="1.0"?>
<!ENTITY xxe SYSTEM "file:///etc/passwd">
<urlset><url><loc>&xxe;</loc></url></urlset>`;

      expect(() => validateXml(maliciousXml)).toThrow(
        'XML contains ENTITY declaration - not allowed for security reasons'
      );
    });

    it('should reject XML with SYSTEM references', () => {
      const maliciousXml = `<?xml version="1.0"?>
<!DOCTYPE sitemap SYSTEM "http://evil.com/dtd">
<urlset></urlset>`;

      expect(() => validateXml(maliciousXml)).toThrow(
        'XML contains SYSTEM reference - not allowed for security reasons'
      );
    });

    it('should reject XML with PUBLIC references', () => {
      const maliciousXml = `<?xml version="1.0"?>
<!DOCTYPE sitemap PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://evil.com/dtd">
<urlset></urlset>`;

      expect(() => validateXml(maliciousXml)).toThrow(
        'XML contains PUBLIC reference - not allowed for security reasons'
      );
    });

    it('should reject XML with parameter entities', () => {
      const maliciousXml = `<?xml version="1.0"?>
<urlset>
  <url><loc>http://example.com/%param;</loc></url>
</urlset>`;

      expect(() => validateXml(maliciousXml)).toThrow(
        'XML contains parameter entity - not allowed for security reasons'
      );
    });

    it('should reject XML exceeding size limit', () => {
      // Create XML larger than 10MB
      const largeXml = '<?xml version="1.0"?><urlset>' + 'x'.repeat(11 * 1024 * 1024) + '</urlset>';

      expect(() => validateXml(largeXml)).toThrow('XML size exceeds maximum allowed size');
    });

    it('should accept valid sitemap XML', () => {
      const validXml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <lastmod>2024-01-01</lastmod>
  </url>
</urlset>`;

      expect(() => validateXml(validXml)).not.toThrow();
    });

    it('should accept valid sitemap index XML', () => {
      const validXml = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
</sitemapindex>`;

      expect(() => validateXml(validXml)).not.toThrow();
    });
  });

  describe('fetchSitemap XXE protection', () => {
    it('should reject XXE file disclosure payloads', async () => {
      const maliciousXml = `<?xml version="1.0"?>
<!DOCTYPE sitemap [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>&xxe;</loc></url>
</urlset>`;

      // Mock fetch to return malicious XML
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(maliciousXml),
        } as Response)
      ) as Mock;

      await expect(fetchSitemap('https://evil.com')).rejects.toThrow(
        'XML contains DOCTYPE declaration'
      );
    });

    it('should reject XXE SSRF payloads', async () => {
      const maliciousXml = `<?xml version="1.0"?>
<!DOCTYPE sitemap [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
]>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>&xxe;</loc></url>
</urlset>`;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(maliciousXml),
        } as Response)
      ) as Mock;

      await expect(fetchSitemap('https://evil.com')).rejects.toThrow(
        'XML contains DOCTYPE declaration'
      );
    });

    it('should reject billion laughs attack (DoS)', async () => {
      const maliciousXml = `<?xml version="1.0"?>
<!DOCTYPE sitemap [
  <!ENTITY lol "lol">
  <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>&lol3;</loc></url>
</urlset>`;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(maliciousXml),
        } as Response)
      ) as Mock;

      await expect(fetchSitemap('https://evil.com')).rejects.toThrow();
    });

    it('should accept and parse valid sitemap XML', async () => {
      const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(validXml),
        } as Response)
      ) as Mock;

      const result = await fetchSitemap('https://example.com');

      expect(result.urls).toHaveLength(2);
      expect(result.urls).toContain('https://example.com/page1');
      expect(result.urls).toContain('https://example.com/page2');
      expect(result.total).toBe(2);
    });

    it('should accept and parse valid sitemap index XML', async () => {
      const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
</urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page2</loc></url>
</urlset>`;

      // Mock fetch to return different XML based on URL
      global.fetch = vi.fn((url: string) => {
        if (url.includes('sitemap.xml')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(sitemapIndexXml),
          } as Response);
        } else if (url.includes('sitemap1.xml')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(sitemap1Xml),
          } as Response);
        } else if (url.includes('sitemap2.xml')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(sitemap2Xml),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      }) as Mock;

      const result = await fetchSitemap('https://example.com');

      expect(result.urls).toHaveLength(2);
      expect(result.urls).toContain('https://example.com/page1');
      expect(result.urls).toContain('https://example.com/page2');
    });

    it('should handle single URL in sitemap (non-array)', async () => {
      const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/single-page</loc>
  </url>
</urlset>`;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(validXml),
        } as Response)
      ) as Mock;

      const result = await fetchSitemap('https://example.com');

      expect(result.urls).toHaveLength(1);
      expect(result.urls[0]).toBe('https://example.com/single-page');
    });

    it('should reject malicious sub-sitemap URLs in sitemap index', async () => {
      const maliciousSitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>file:///etc/passwd</loc>
  </sitemap>
</sitemapindex>`;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(maliciousSitemapIndex),
        } as Response)
      ) as Mock;

      const result = await fetchSitemap('https://example.com');

      // Should skip invalid URL and return empty results
      expect(result.urls).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty sitemap', async () => {
      const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(emptyXml),
        } as Response)
      ) as Mock;

      await expect(fetchSitemap('https://example.com')).rejects.toThrow('No sitemap found');
    });

    it('should handle malformed but safe XML', async () => {
      const malformedXml = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/page1</loc>
  <!-- missing closing tag -->
</urlset>`;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(malformedXml),
        } as Response)
      ) as Mock;

      // fast-xml-parser should handle this gracefully
      const result = await fetchSitemap('https://example.com');
      expect(result.urls).toHaveLength(1);
    });

    it('should trim whitespace from URLs', async () => {
      const xmlWithWhitespace = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>
      https://example.com/page1
    </loc>
  </url>
</urlset>`;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(xmlWithWhitespace),
        } as Response)
      ) as Mock;

      const result = await fetchSitemap('https://example.com');

      expect(result.urls[0]).toBe('https://example.com/page1');
      expect(result.urls[0]).not.toContain('\n');
      expect(result.urls[0]).not.toContain(' ');
    });
  });
});
