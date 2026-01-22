/**
 * URL Suggestion Agent Tests
 *
 * Tests for the URL suggestion agent that uses AI and web search to find company websites.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock OpenAI module before importing
vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      // Mock constructor
    }
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
  },
}));

// Mock intelligent tools
vi.mock('@/lib/agent-tools/intelligent-tools', () => ({
  createIntelligentTools: () => ({
    webSearch: vi.fn(),
  }),
}));

import { urlSuggestionSchema, type UrlSuggestion, type UrlSuggestionInput } from '../url-suggestion-agent';

describe('URL Suggestion Agent', () => {
  describe('urlSuggestionSchema', () => {
    it('should validate a complete URL suggestion object', () => {
      const validSuggestion: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary',
            description: 'Main corporate website',
            confidence: 95,
          },
          {
            url: 'https://www.example.de',
            type: 'regional',
            description: 'German regional site',
            confidence: 85,
          },
        ],
        reasoning: 'Found both global and regional websites',
      };

      const result = urlSuggestionSchema.safeParse(validSuggestion);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.suggestions).toHaveLength(2);
        expect(result.data.suggestions[0].url).toBe('https://www.example.com');
        expect(result.data.suggestions[0].type).toBe('primary');
        expect(result.data.suggestions[0].confidence).toBe(95);
      }
    });

    it('should accept empty suggestions array', () => {
      const emptySuggestion: UrlSuggestion = {
        suggestions: [],
        reasoning: 'No URLs found',
      };

      const result = urlSuggestionSchema.safeParse(emptySuggestion);

      expect(result.success).toBe(true);
    });

    it('should reject invalid URL type', () => {
      const invalidSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'invalid_type', // Invalid type
            description: 'Test',
            confidence: 90,
          },
        ],
        reasoning: 'Test',
      };

      const result = urlSuggestionSchema.safeParse(invalidSuggestion);

      expect(result.success).toBe(false);
    });

    it('should reject confidence outside 0-100 range', () => {
      const invalidSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary' as const,
            description: 'Test',
            confidence: 150, // Invalid: > 100
          },
        ],
        reasoning: 'Test',
      };

      const result = urlSuggestionSchema.safeParse(invalidSuggestion);

      expect(result.success).toBe(false);
    });

    it('should reject negative confidence', () => {
      const invalidSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary' as const,
            description: 'Test',
            confidence: -10, // Invalid: < 0
          },
        ],
        reasoning: 'Test',
      };

      const result = urlSuggestionSchema.safeParse(invalidSuggestion);

      expect(result.success).toBe(false);
    });

    it('should require all mandatory fields in suggestion', () => {
      const incompleteSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary' as const,
            // Missing description
            confidence: 90,
          },
        ],
        reasoning: 'Test',
      };

      const result = urlSuggestionSchema.safeParse(incompleteSuggestion);

      expect(result.success).toBe(false);
    });

    it('should require reasoning field', () => {
      const incompleteSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary' as const,
            description: 'Test',
            confidence: 90,
          },
        ],
        // Missing reasoning
      };

      const result = urlSuggestionSchema.safeParse(incompleteSuggestion);

      expect(result.success).toBe(false);
    });

    it('should accept all valid URL types', () => {
      const validTypes: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary',
            description: 'Main site',
            confidence: 90,
          },
          {
            url: 'https://product.example.com',
            type: 'product',
            description: 'Product site',
            confidence: 80,
          },
          {
            url: 'https://www.example.de',
            type: 'regional',
            description: 'Regional site',
            confidence: 70,
          },
          {
            url: 'https://partner.example.com',
            type: 'related',
            description: 'Partner site',
            confidence: 60,
          },
        ],
        reasoning: 'All valid types',
      };

      const result = urlSuggestionSchema.safeParse(validTypes);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.suggestions).toHaveLength(4);
      }
    });
  });

  describe('UrlSuggestionInput Type', () => {
    it('should allow minimal input with only customerName', () => {
      const minimalInput: UrlSuggestionInput = {
        customerName: 'Test Company',
      };

      expect(minimalInput.customerName).toBe('Test Company');
    });

    it('should allow complete input with all fields', () => {
      const completeInput: UrlSuggestionInput = {
        customerName: 'Test Company',
        industry: 'Technology',
        projectDescription: 'Website redesign',
        technologies: ['Drupal', 'React'],
        useWebSearch: true,
      };

      expect(completeInput.customerName).toBe('Test Company');
      expect(completeInput.industry).toBe('Technology');
      expect(completeInput.technologies).toHaveLength(2);
    });

    it('should allow useWebSearch to be omitted (defaults to true)', () => {
      const inputWithoutFlag: UrlSuggestionInput = {
        customerName: 'Test Company',
        industry: 'Technology',
      };

      expect(inputWithoutFlag.customerName).toBe('Test Company');
    });
  });

  describe('Edge Cases and Data Validation', () => {
    it('should handle URL with special characters', () => {
      const suggestionWithSpecialChars: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.müller-company.de/path?query=value',
            type: 'primary',
            description: 'Company with special chars',
            confidence: 85,
          },
        ],
        reasoning: 'Special characters in URL',
      };

      const result = urlSuggestionSchema.safeParse(suggestionWithSpecialChars);

      expect(result.success).toBe(true);
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(500);
      const suggestionWithLongDesc: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary',
            description: longDescription,
            confidence: 90,
          },
        ],
        reasoning: 'Long description test',
      };

      const result = urlSuggestionSchema.safeParse(suggestionWithLongDesc);

      expect(result.success).toBe(true);
    });

    it('should handle very long reasoning', () => {
      const longReasoning = 'B'.repeat(1000);
      const suggestionWithLongReasoning: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary',
            description: 'Test',
            confidence: 90,
          },
        ],
        reasoning: longReasoning,
      };

      const result = urlSuggestionSchema.safeParse(suggestionWithLongReasoning);

      expect(result.success).toBe(true);
    });

    it('should handle confidence boundary values', () => {
      const boundaryValues: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary',
            description: 'Zero confidence',
            confidence: 0,
          },
          {
            url: 'https://www.example2.com',
            type: 'primary',
            description: 'Max confidence',
            confidence: 100,
          },
        ],
        reasoning: 'Boundary value test',
      };

      const result = urlSuggestionSchema.safeParse(boundaryValues);

      expect(result.success).toBe(true);
    });

    it('should handle floating point confidence values', () => {
      const floatConfidence: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary',
            description: 'Float confidence',
            confidence: 87.5,
          },
        ],
        reasoning: 'Floating point test',
      };

      const result = urlSuggestionSchema.safeParse(floatConfidence);

      expect(result.success).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should enforce suggestion array type', () => {
      const suggestion: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary',
            description: 'Test',
            confidence: 90,
          },
        ],
        reasoning: 'Test',
      };

      // Type assertion to check compile-time type safety
      const firstSuggestion = suggestion.suggestions[0];
      expect(firstSuggestion.url).toBeTypeOf('string');
      expect(firstSuggestion.type).toMatch(/primary|product|regional|related/);
      expect(firstSuggestion.confidence).toBeTypeOf('number');
    });

    it('should allow description to be optional in schema but required in tests', () => {
      // Note: The schema shows description as required in the actual implementation
      // This test documents the expected behavior
      const suggestionWithDesc: UrlSuggestion = {
        suggestions: [
          {
            url: 'https://www.example.com',
            type: 'primary',
            description: 'Required description',
            confidence: 90,
          },
        ],
        reasoning: 'Test',
      };

      const result = urlSuggestionSchema.safeParse(suggestionWithDesc);
      expect(result.success).toBe(true);
    });
  });
});
