/**
 * SSRF Protection Test Suite
 * Tests URL validation to prevent Server-Side Request Forgery attacks
 */

import { describe, it, expect } from 'vitest';
import { isAllowedUrl } from '../utils/url-validator';

describe('SSRF Protection - URL Validation', () => {
  describe('Localhost blocking', () => {
    it('should block localhost', () => {
      expect(isAllowedUrl('http://localhost:3000')).toBe(false);
      expect(isAllowedUrl('https://localhost')).toBe(false);
      expect(isAllowedUrl('http://localhost.localdomain')).toBe(false);
    });

    it('should block 127.0.0.1', () => {
      expect(isAllowedUrl('http://127.0.0.1')).toBe(false);
      expect(isAllowedUrl('https://127.0.0.1:8080')).toBe(false);
      expect(isAllowedUrl('http://127.0.0.1/api')).toBe(false);
    });

    it('should block 0.0.0.0', () => {
      expect(isAllowedUrl('http://0.0.0.0')).toBe(false);
      expect(isAllowedUrl('https://0.0.0.0:9000')).toBe(false);
    });

    it('should block IPv6 localhost', () => {
      expect(isAllowedUrl('http://[::1]')).toBe(false);
      expect(isAllowedUrl('https://[::1]:3000')).toBe(false);
      expect(isAllowedUrl('http://[0:0:0:0:0:0:0:1]')).toBe(false);
    });
  });

  describe('AWS metadata endpoint blocking', () => {
    it('should block AWS metadata service', () => {
      expect(isAllowedUrl('http://169.254.169.254')).toBe(false);
      expect(isAllowedUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
      expect(
        isAllowedUrl('http://169.254.169.254/latest/meta-data/iam/security-credentials/')
      ).toBe(false);
    });

    it('should block entire link-local range', () => {
      expect(isAllowedUrl('http://169.254.0.1')).toBe(false);
      expect(isAllowedUrl('http://169.254.255.255')).toBe(false);
      expect(isAllowedUrl('http://169.254.100.200')).toBe(false);
    });
  });

  describe('Private network blocking', () => {
    it('should block 192.168.x.x range', () => {
      expect(isAllowedUrl('http://192.168.0.1')).toBe(false);
      expect(isAllowedUrl('http://192.168.1.1')).toBe(false);
      expect(isAllowedUrl('http://192.168.255.255')).toBe(false);
      expect(isAllowedUrl('https://192.168.10.50:8080')).toBe(false);
    });

    it('should block 10.x.x.x range', () => {
      expect(isAllowedUrl('http://10.0.0.1')).toBe(false);
      expect(isAllowedUrl('http://10.1.1.1')).toBe(false);
      expect(isAllowedUrl('http://10.255.255.255')).toBe(false);
      expect(isAllowedUrl('https://10.10.10.10:3000')).toBe(false);
    });

    it('should block 172.16.x.x to 172.31.x.x range', () => {
      expect(isAllowedUrl('http://172.16.0.1')).toBe(false);
      expect(isAllowedUrl('http://172.20.10.5')).toBe(false);
      expect(isAllowedUrl('http://172.31.255.255')).toBe(false);
      expect(isAllowedUrl('https://172.25.0.1:8443')).toBe(false);
    });

    it('should block carrier-grade NAT (100.64.x.x)', () => {
      expect(isAllowedUrl('http://100.64.0.0')).toBe(false);
      expect(isAllowedUrl('http://100.100.100.100')).toBe(false);
      expect(isAllowedUrl('http://100.127.255.255')).toBe(false);
    });

    it('should block multicast addresses (224.x.x.x - 239.x.x.x)', () => {
      expect(isAllowedUrl('http://224.0.0.1')).toBe(false);
      expect(isAllowedUrl('http://239.255.255.255')).toBe(false);
    });

    it('should block reserved addresses (240.x.x.x - 255.x.x.x)', () => {
      expect(isAllowedUrl('http://240.0.0.1')).toBe(false);
      expect(isAllowedUrl('http://255.255.255.255')).toBe(false);
    });
  });

  describe('IPv6 private network blocking', () => {
    it('should block IPv6 link-local (fe80::)', () => {
      expect(isAllowedUrl('http://[fe80::1]')).toBe(false);
      expect(isAllowedUrl('http://[fe80::1234:5678]')).toBe(false);
      expect(isAllowedUrl('http://[fe9a::1]')).toBe(false);
      expect(isAllowedUrl('http://[feaa::1]')).toBe(false);
      expect(isAllowedUrl('http://[feba::1]')).toBe(false);
    });

    it('should block IPv6 unique local (fc00::/7)', () => {
      expect(isAllowedUrl('http://[fc00::1]')).toBe(false);
      expect(isAllowedUrl('http://[fd00::1]')).toBe(false);
      expect(isAllowedUrl('http://[fd12:3456:789a::1]')).toBe(false);
    });

    it('should block IPv4-mapped IPv6 addresses to localhost', () => {
      expect(isAllowedUrl('http://[::ffff:127.0.0.1]')).toBe(false);
    });
  });

  describe('Special domain blocking', () => {
    it('should block .local domains', () => {
      expect(isAllowedUrl('http://myserver.local')).toBe(false);
      expect(isAllowedUrl('https://test.local:8080')).toBe(false);
      expect(isAllowedUrl('http://router.local')).toBe(false);
    });

    it('should block .internal domains', () => {
      expect(isAllowedUrl('http://api.internal')).toBe(false);
      expect(isAllowedUrl('https://service.internal:9000')).toBe(false);
    });
  });

  describe('Protocol restriction', () => {
    it('should block file:// protocol', () => {
      expect(isAllowedUrl('file:///etc/passwd')).toBe(false);
      expect(isAllowedUrl('file:///C:/Windows/System32/config/sam')).toBe(false);
    });

    it('should block ftp:// protocol', () => {
      expect(isAllowedUrl('ftp://ftp.example.com')).toBe(false);
    });

    it('should block gopher:// protocol', () => {
      expect(isAllowedUrl('gopher://example.com')).toBe(false);
    });

    it('should block data: URLs', () => {
      expect(isAllowedUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should block javascript: URLs', () => {
      expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('Valid public URLs', () => {
    it('should allow valid HTTPS URLs', () => {
      expect(isAllowedUrl('https://example.com')).toBe(true);
      expect(isAllowedUrl('https://www.google.com')).toBe(true);
      expect(isAllowedUrl('https://api.github.com/repos')).toBe(true);
    });

    it('should allow valid HTTP URLs', () => {
      expect(isAllowedUrl('http://example.com')).toBe(true);
      expect(isAllowedUrl('http://www.example.org:8080')).toBe(true);
      expect(isAllowedUrl('http://subdomain.example.net/path')).toBe(true);
    });

    it('should allow URLs with query parameters', () => {
      expect(isAllowedUrl('https://example.com/api?key=value')).toBe(true);
      expect(isAllowedUrl('https://search.example.com?q=test&lang=en')).toBe(true);
    });

    it('should allow URLs with fragments', () => {
      expect(isAllowedUrl('https://example.com/page#section')).toBe(true);
    });

    it('should allow URLs with authentication (though not recommended)', () => {
      expect(isAllowedUrl('https://user:pass@example.com')).toBe(true);
    });

    it('should allow non-standard ports on public domains', () => {
      expect(isAllowedUrl('https://example.com:8443')).toBe(true);
      expect(isAllowedUrl('http://example.com:3000')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle invalid URLs gracefully', () => {
      expect(isAllowedUrl('not a url')).toBe(false);
      expect(isAllowedUrl('')).toBe(false);
      expect(isAllowedUrl('://')).toBe(false);
    });

    it('should handle URLs with unusual but valid public IPs', () => {
      // 8.8.8.8 (Google DNS) should be allowed
      expect(isAllowedUrl('http://8.8.8.8')).toBe(true);
      // 1.1.1.1 (Cloudflare DNS) should be allowed
      expect(isAllowedUrl('http://1.1.1.1')).toBe(true);
    });

    it('should handle URLs with special characters', () => {
      expect(isAllowedUrl('https://example.com/path%20with%20spaces')).toBe(true);
      expect(isAllowedUrl('https://example.com/path?query=a+b')).toBe(true);
    });

    it('should be case-insensitive for hostname checks', () => {
      expect(isAllowedUrl('http://LOCALHOST')).toBe(false);
      expect(isAllowedUrl('http://LocalHost.Local')).toBe(false);
      expect(isAllowedUrl('http://SERVER.INTERNAL')).toBe(false);
    });
  });

  describe('Attack scenario prevention', () => {
    it('should prevent AWS metadata access', () => {
      // Common AWS metadata attack
      expect(
        isAllowedUrl('http://169.254.169.254/latest/meta-data/iam/security-credentials/admin')
      ).toBe(false);
    });

    it('should prevent internal network scanning', () => {
      // Attacker trying to scan internal network
      expect(isAllowedUrl('http://192.168.1.1')).toBe(false);
      expect(isAllowedUrl('http://192.168.1.100')).toBe(false);
      expect(isAllowedUrl('http://10.0.0.5')).toBe(false);
    });

    it('should prevent localhost port scanning', () => {
      // Attacker trying to scan localhost ports
      expect(isAllowedUrl('http://127.0.0.1:22')).toBe(false);
      expect(isAllowedUrl('http://127.0.0.1:3306')).toBe(false);
      expect(isAllowedUrl('http://127.0.0.1:27017')).toBe(false);
    });

    it('should prevent file system access', () => {
      // Attacker trying to read local files
      expect(isAllowedUrl('file:///etc/passwd')).toBe(false);
      expect(isAllowedUrl('file:///proc/self/environ')).toBe(false);
    });

    it('should prevent access to router admin panels', () => {
      // Common router IPs
      expect(isAllowedUrl('http://192.168.0.1')).toBe(false);
      expect(isAllowedUrl('http://192.168.1.1')).toBe(false);
      expect(isAllowedUrl('http://10.0.0.1')).toBe(false);
    });

    it('should prevent mDNS/Bonjour attacks', () => {
      expect(isAllowedUrl('http://myserver.local')).toBe(false);
      expect(isAllowedUrl('http://printer.local')).toBe(false);
    });
  });
});
