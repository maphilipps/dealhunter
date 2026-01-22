/**
 * Sanitize Utility Tests
 *
 * Tests for HTML and URL sanitization utilities:
 * - sanitizeText
 * - sanitizeHtml
 * - sanitizeUrl
 */

import { describe, it, expect } from 'vitest';

import { sanitizeText, sanitizeHtml, sanitizeUrl } from '../sanitize';

describe('Sanitize Utilities', () => {
  describe('sanitizeText', () => {
    it('should strip all HTML tags and keep text content', () => {
      const input = '<p>Hello <b>World</b></p>';
      const result = sanitizeText(input);

      expect(result).toBe('Hello World');
    });

    it('should remove script tags completely', () => {
      const input = '<div>Hello</div><script>alert("XSS")</script>';
      const result = sanitizeText(input);

      expect(result).toBe('Hello');
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('should remove on* event handlers', () => {
      const input = '<div onmouseover="alert(1)">Hover me</div>';
      const result = sanitizeText(input);

      expect(result).toBe('Hover me');
      expect(result).not.toContain('onmouseover');
    });

    it('should handle HTML entities (keeps them as-is)', () => {
      const input = '&#60;script&#62;alert(1)&#60;/script&#62;';
      const result = sanitizeText(input);

      // DOMPurify keeps HTML entities as-is
      expect(result).toBe('&#60;script&#62;alert(1)&#60;/script&#62;');
      expect(result).not.toContain('<script>');
    });

    it('should handle empty string', () => {
      const result = sanitizeText('');

      expect(result).toBe('');
    });

    it('should handle plain text without HTML', () => {
      const input = 'Just plain text';
      const result = sanitizeText(input);

      expect(result).toBe('Just plain text');
    });

    it('should remove iframe tags', () => {
      const input = 'Text<iframe src="malicious.com"></iframe>More text';
      const result = sanitizeText(input);

      expect(result).toBe('TextMore text');
      expect(result).not.toContain('iframe');
    });

    it('should remove object and embed tags', () => {
      const input = '<object data="malicious.swf"></object><embed src="evil.pdf">';
      const result = sanitizeText(input);

      expect(result).not.toContain('object');
      expect(result).not.toContain('embed');
    });

    it('should handle complex nested HTML', () => {
      const input = '<div><p><span>Deep</span> <b>nesting</b></p></div>';
      const result = sanitizeText(input);

      expect(result).toBe('Deep nesting');
    });

    it('should remove style tags and content', () => {
      const input = '<style>body { display: none; }</style>Content';
      const result = sanitizeText(input);

      expect(result).toBe('Content');
      expect(result).not.toContain('style');
    });
  });

  describe('sanitizeHtml', () => {
    it('should strip all tags when allowedTags is empty', () => {
      const input = '<p>Hello <b>World</b></p>';
      const result = sanitizeHtml(input, []);

      expect(result).toBe('Hello World');
    });

    it('should allow specified tags', () => {
      const input = '<p>Hello <b>World</b></p>';
      const result = sanitizeHtml(input, ['p', 'b']);

      expect(result).toBe('<p>Hello <b>World</b></p>');
    });

    it('should remove non-allowed tags', () => {
      const input = '<p>Hello <script>alert(1)</script></p>';
      const result = sanitizeHtml(input, ['p']);

      expect(result).toBe('<p>Hello </p>');
      expect(result).not.toContain('script');
    });

    it('should remove attributes from allowed tags', () => {
      const input = '<p class="test" id="para">Text</p>';
      const result = sanitizeHtml(input, ['p']);

      expect(result).toBe('<p>Text</p>');
      expect(result).not.toContain('class');
      expect(result).not.toContain('id');
    });

    it('should remove dangerous event handlers', () => {
      const input = '<div onclick="evil()">Text</div>';
      const result = sanitizeHtml(input, ['div']);

      expect(result).toBe('<div>Text</div>');
      expect(result).not.toContain('onclick');
    });

    it('should handle multiple allowed tags', () => {
      const input = '<h1>Title</h1><p>Paragraph</p><b>Bold</b>';
      const result = sanitizeHtml(input, ['h1', 'p']);

      expect(result).toContain('<h1>Title</h1>');
      expect(result).toContain('<p>Paragraph</p>');
      expect(result).not.toContain('<b>');
    });

    it('should default to empty allowedTags array', () => {
      const input = '<p>Hello</p>';
      const result = sanitizeHtml(input);

      expect(result).toBe('Hello');
    });

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(input, ['a']);

      expect(result).toBe('<a>Click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('should handle self-closing tags', () => {
      const input = '<p>Text<br/>More</p>';
      const result = sanitizeHtml(input, ['p', 'br']);

      expect(result).toContain('<p>Text');
      expect(result).toContain('More</p>');
    });

    it('should sanitize svg tags (XSS protection)', () => {
      const input = '<svg onload=alert(1)>';
      const result = sanitizeHtml(input, ['svg']);

      expect(result).not.toContain('onload');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid http URLs', () => {
      const url = 'http://example.com';
      const result = sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should allow valid https URLs', () => {
      const url = 'https://example.com';
      const result = sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should allow https URLs with paths and query params', () => {
      const url = 'https://example.com/path?query=value&other=123';
      const result = sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should reject javascript: protocol', () => {
      expect(() => sanitizeUrl('javascript:alert(1)')).toThrow(
        'URL must use http or https protocol'
      );
    });

    it('should reject data: protocol', () => {
      expect(() => sanitizeUrl('data:text/html,<script>alert(1)</script>')).toThrow(
        'URL must use http or https protocol'
      );
    });

    it('should reject file: protocol', () => {
      expect(() => sanitizeUrl('file:///etc/passwd')).toThrow(
        'URL must use http or https protocol'
      );
    });

    it('should reject ftp: protocol', () => {
      expect(() => sanitizeUrl('ftp://example.com')).toThrow(
        'URL must use http or https protocol'
      );
    });

    it('should reject URLs without protocol', () => {
      expect(() => sanitizeUrl('example.com')).toThrow(
        'URL must use http or https protocol'
      );
    });

    it('should sanitize and validate URLs with HTML', () => {
      const url = 'https://example.com"><script>alert(1)</script>';
      const result = sanitizeUrl(url);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toMatch(/^https:\/\//);
    });

    it('should throw error for invalid URL after sanitization', () => {
      expect(() => sanitizeUrl('https://[invalid-url]')).toThrow(
        'Invalid URL after sanitization'
      );
    });

    it('should handle URLs with fragments', () => {
      const url = 'https://example.com#section';
      const result = sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should handle URLs with ports', () => {
      const url = 'https://example.com:8080/path';
      const result = sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should handle internationalized domain names', () => {
      const url = 'https://müller.de';
      const result = sanitizeUrl(url);

      expect(result).toMatch(/^https:\/\//);
    });

    it('should handle URLs with special characters in path', () => {
      const url = 'https://example.com/path?param=value&other=test#section';
      const result = sanitizeUrl(url);

      expect(result).toBe(url);
    });
  });
});
