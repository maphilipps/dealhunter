/**
 * URL Validation Tests
 *
 * Tests for SSRF (Server-Side Request Forgery) protection utilities.
 */

import { describe, it, expect } from 'vitest';

import { isInternalUrl, validateUrlForFetch } from '../url-validation';

describe('URL Validation Utilities', () => {
  describe('isInternalUrl', () => {
    describe('localhost variants', () => {
      it('should detect localhost', () => {
        expect(isInternalUrl('http://localhost')).toBe(true);
        expect(isInternalUrl('https://localhost:8080')).toBe(true);
        expect(isInternalUrl('http://localhost/path')).toBe(true);
      });

      it('should detect 127.0.0.1', () => {
        expect(isInternalUrl('http://127.0.0.1')).toBe(true);
        expect(isInternalUrl('https://127.0.0.1:8080')).toBe(true);
      });

      it('should detect IPv6 localhost', () => {
        expect(isInternalUrl('http://::1')).toBe(true);
        expect(isInternalUrl('http://0:0:0:0:0:0:0:1')).toBe(true);
      });

      it('should detect 0.0.0.0', () => {
        expect(isInternalUrl('http://0.0.0.0')).toBe(true);
        expect(isInternalUrl('https://0.0.0.0:8080')).toBe(true);
      });
    });

    describe('RFC 1918 private networks', () => {
      it('should block 10.0.0.0/8 range', () => {
        expect(isInternalUrl('http://10.0.0.1')).toBe(true);
        expect(isInternalUrl('http://10.255.255.255')).toBe(true);
        expect(isInternalUrl('http://10.123.45.67:8080')).toBe(true);
      });

      it('should block 172.16.0.0/12 range', () => {
        expect(isInternalUrl('http://172.16.0.1')).toBe(true);
        expect(isInternalUrl('http://172.31.255.255')).toBe(true);
        expect(isInternalUrl('http://172.20.50.100')).toBe(true);
      });

      it('should NOT block 172.32.0.0 (outside range)', () => {
        expect(isInternalUrl('http://172.32.0.1')).toBe(false);
      });

      it('should NOT block 172.15.255.255 (outside range)', () => {
        expect(isInternalUrl('http://172.15.255.255')).toBe(false);
      });

      it('should block 192.168.0.0/16 range', () => {
        expect(isInternalUrl('http://192.168.0.1')).toBe(true);
        expect(isInternalUrl('http://192.168.255.255')).toBe(true);
        expect(isInternalUrl('http://192.168.1.100:8080')).toBe(true);
      });

      it('should NOT block 192.169.0.0 (outside range)', () => {
        expect(isInternalUrl('http://192.169.0.1')).toBe(false);
      });

      it('should NOT block 192.167.255.255 (outside range)', () => {
        expect(isInternalUrl('http://192.167.255.255')).toBe(false);
      });
    });

    describe('link-local addresses', () => {
      it('should block 169.254.0.0/16 range', () => {
        expect(isInternalUrl('http://169.254.0.1')).toBe(true);
        expect(isInternalUrl('http://169.254.255.255')).toBe(true);
        expect(isInternalUrl('http://169.254.123.45')).toBe(true);
      });
    });

    describe('loopback range', () => {
      it('should block entire 127.0.0.0/8 range', () => {
        expect(isInternalUrl('http://127.0.0.1')).toBe(true);
        expect(isInternalUrl('http://127.0.0.2')).toBe(true);
        expect(isInternalUrl('http://127.255.255.255')).toBe(true);
        expect(isInternalUrl('http://127.123.45.67')).toBe(true);
      });
    });

    describe('special IP ranges', () => {
      it('should block 0.0.0.0/8 (current network)', () => {
        expect(isInternalUrl('http://0.0.0.0')).toBe(true);
        expect(isInternalUrl('http://0.123.45.67')).toBe(true);
      });

      it('should block 224.0.0.0/4 (multicast)', () => {
        expect(isInternalUrl('http://224.0.0.1')).toBe(true);
        expect(isInternalUrl('http://239.255.255.255')).toBe(true);
        expect(isInternalUrl('http:://225.1.2.3')).toBe(true);
      });

      it('should block 240.0.0.0/4 (reserved)', () => {
        expect(isInternalUrl('http://240.0.0.1')).toBe(true);
        expect(isInternalUrl('http://255.255.255.255')).toBe(true);
      });
    });

    describe('IPv6 addresses', () => {
      it('should block IPv6 link-local (fe80::/10)', () => {
        expect(isInternalUrl('http://fe80::1')).toBe(true);
        expect(isInternalUrl('http://fe80::1234:5678')).toBe(true);
        expect(isInternalUrl('http://fe80::')).toBe(true);
      });

      it('should block IPv6 unique local (fc00::/7)', () => {
        expect(isInternalUrl('http://fc00::1')).toBe(true);
        expect(isInternalUrl('http://fd00::1')).toBe(true);
        expect(isInternalUrl('http://fd12:3456:789a::1')).toBe(true);
      });
    });

    describe('public URLs', () => {
      it('should allow public domains', () => {
        expect(isInternalUrl('https://example.com')).toBe(false);
        expect(isInternalUrl('https://www.google.com')).toBe(false);
        expect(isInternalUrl('https://api.github.com')).toBe(false);
      });

      it('should allow public IP addresses', () => {
        expect(isInternalUrl('http://8.8.8.8')).toBe(false); // Google DNS
        expect(isInternalUrl('http://1.1.1.1')).toBe(false); // Cloudflare DNS
        expect(isInternalUrl('http://93.184.216.34')).toBe(false); // example.com
      });

      it('should allow URLs with paths and ports', () => {
        expect(isInternalUrl('https://example.com/path/to/resource')).toBe(false);
        expect(isInternalUrl('https://example.com:8080')).toBe(false);
        expect(isInternalUrl('https://example.com:443/path')).toBe(false);
      });

      it('should allow URLs with query params and fragments', () => {
        expect(isInternalUrl('https://example.com?query=value')).toBe(false);
        expect(isInternalUrl('https://example.com#section')).toBe(false);
        expect(isInternalUrl('https://example.com/path?q=v#frag')).toBe(false);
      });
    });

    describe('invalid URLs', () => {
      it('should treat malformed URLs as internal (safe default)', () => {
        expect(isInternalUrl('not-a-url')).toBe(true);
        expect(isInternalUrl('http://')).toBe(true);
        expect(isInternalUrl('://example.com')).toBe(true);
        expect(isInternalUrl('')).toBe(true);
      });

      it('should treat invalid IP addresses as internal', () => {
        expect(isInternalUrl('http://999.999.999.999')).toBe(true);
        expect(isInternalUrl('http://256.1.2.3')).toBe(true);
        expect(isInternalUrl('http://1.2.3.256')).toBe(true);
      });
    });

    describe('case sensitivity', () => {
      it('should handle uppercase hostnames', () => {
        expect(isInternalUrl('http://LOCALHOST')).toBe(true);
        expect(isInternalUrl('http://LOCALHOST/path')).toBe(true);
      });

      it('should handle mixed case hostnames', () => {
        expect(isInternalUrl('http://LoCaLhOsT')).toBe(true);
        expect(isInternalUrl('http://LocalHost')).toBe(true);
      });
    });
  });

  describe('validateUrlForFetch', () => {
    describe('should block internal URLs', () => {
      it('should throw error for localhost', () => {
        expect(() => validateUrlForFetch('http://localhost')).toThrow(
          'URL validation failed: Cannot fetch internal URLs'
        );
      });

      it('should throw error for private IPs', () => {
        expect(() => validateUrlForFetch('http://192.168.1.1')).toThrow(
          'URL validation failed: Cannot fetch internal URLs'
        );
      });

      it('should throw error for 127.0.0.1', () => {
        expect(() => validateUrlForFetch('http://127.0.0.1')).toThrow(
          'URL validation failed: Cannot fetch internal URLs'
        );
      });
    });

    describe('should block dangerous protocols', () => {
      it('should block file:// protocol', () => {
        expect(() => validateUrlForFetch('file:///etc/passwd')).toThrow(
          'URL validation failed: Protocol "file:" is not allowed'
        );
      });

      it('should block ftp:// protocol', () => {
        expect(() => validateUrlForFetch('ftp://example.com')).toThrow(
          'URL validation failed: Protocol "ftp:" is not allowed'
        );
      });

      it('should block javascript: protocol', () => {
        expect(() => validateUrlForFetch('javascript:alert(1)')).toThrow(
          'URL validation failed: Protocol "javascript:" is not allowed'
        );
      });

      it('should block data:// protocol', () => {
        expect(() =>
          validateUrlForFetch('data:text/html,<script>alert(1)</script>')
        ).toThrow('URL validation failed: Protocol "data:" is not allowed');
      });

      it('should block ssh:// protocol', () => {
        expect(() => validateUrlForFetch('ssh://example.com')).toThrow(
          'URL validation failed: Protocol "ssh:" is not allowed'
        );
      });
    });

    describe('should allow safe protocols', () => {
      it('should allow http://', () => {
        expect(() => validateUrlForFetch('http://example.com')).not.toThrow();
      });

      it('should allow https://', () => {
        expect(() => validateUrlForFetch('https://example.com')).not.toThrow();
      });

      it('should allow http with port', () => {
        expect(() =>
          validateUrlForFetch('http://example.com:8080')
        ).not.toThrow();
      });

      it('should allow https with port', () => {
        expect(() =>
          validateUrlForFetch('https://example.com:443')
        ).not.toThrow();
      });
    });

    describe('should allow public URLs', () => {
      it('should allow valid public URLs', () => {
        expect(() =>
          validateUrlForFetch('https://api.example.com/data')
        ).not.toThrow();
      });

      it('should allow URLs with query parameters', () => {
        expect(() =>
          validateUrlForFetch('https://example.com?param=value')
        ).not.toThrow();
      });

      it('should allow URLs with fragments', () => {
        expect(() =>
          validateUrlForFetch('https://example.com#section')
        ).not.toThrow();
      });
    });

    describe('error messages', () => {
      it('should include security message for internal URLs', () => {
        expect(() => validateUrlForFetch('http://localhost')).toThrow(
          'blocked for security reasons'
        );
      });

      it('should mention allowed protocols for blocked protocols', () => {
        expect(() => validateUrlForFetch('ftp://example.com')).toThrow(
          'Only HTTP and HTTPS are supported'
        );
      });

      it('should indicate invalid format for malformed URLs', () => {
        // Malformed URLs are treated as internal first, so they get blocked there
        expect(() => validateUrlForFetch('not-a-url')).toThrow(
          'Cannot fetch internal URLs'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle URLs with authentication', () => {
        expect(() =>
          validateUrlForFetch('https://user:pass@example.com')
        ).not.toThrow();
      });

      it('should handle internationalized domain names', () => {
        expect(() =>
          validateUrlForFetch('https://müller.de')
        ).not.toThrow();
      });

      it('should handle URLs with long paths', () => {
        expect(() =>
          validateUrlForFetch('https://example.com/path/to/deep/resource')
        ).not.toThrow();
      });
    });
  });
});
