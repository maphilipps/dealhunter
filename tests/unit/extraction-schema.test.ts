import { describe, it, expect } from 'vitest';
import { extractedRequirementsSchema } from '@/lib/extraction/schema';
import { z } from 'zod';

/**
 * Unit tests for extraction schema validation
 * Tests new DEA-85 fields: budgetRange, cmsConstraints, contacts, deliverables
 */

describe('Extraction Schema - Budget Range', () => {
  it('should validate budget range with min/max/currency', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      budgetRange: {
        min: 50000,
        max: 100000,
        currency: 'EUR',
        confidence: 85,
        rawText: '50-100k EUR',
      },
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate budget range with only max (upper bound)', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      budgetRange: {
        max: 200000,
        currency: 'EUR',
        confidence: 75,
        rawText: 'bis 200.000€',
      },
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate budget range with only min (lower bound)', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      budgetRange: {
        min: 50000,
        currency: 'EUR',
        confidence: 70,
        rawText: 'ab 50k',
      },
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate supported currencies', () => {
    const currencies = ['EUR', 'USD', 'GBP', 'CHF'];

    currencies.forEach(currency => {
      const data = {
        customerName: 'Test Customer',
        projectDescription: 'Test project',
        technologies: [],
        keyRequirements: [],
        confidenceScore: 0.9,
        extractedAt: new Date().toISOString(),
        budgetRange: {
          min: 50000,
          max: 100000,
          currency,
          confidence: 85,
          rawText: `50-100k ${currency}`,
        },
      };

      expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
    });
  });

  it('should reject invalid currency', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      budgetRange: {
        min: 50000,
        max: 100000,
        currency: 'JPY',
        confidence: 85,
        rawText: '50-100k JPY',
      },
    };

    expect(() => extractedRequirementsSchema.parse(data)).toThrow();
  });

  it('should default currency to EUR if not specified', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      budgetRange: {
        min: 50000,
        max: 100000,
        confidence: 85,
        rawText: '50-100k',
      },
    };

    const result = extractedRequirementsSchema.parse(data);
    expect(result.budgetRange?.currency).toBe('EUR');
  });
});

describe('Extraction Schema - CMS Constraints', () => {
  it('should validate CMS constraints with required CMSes (rigid)', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      cmsConstraints: {
        required: ['Drupal'],
        flexibility: 'rigid',
        confidence: 95,
        rawText: 'Drupal only',
      },
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate CMS constraints with preferred CMSes', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      cmsConstraints: {
        preferred: ['WordPress', 'Drupal'],
        flexibility: 'preferred',
        confidence: 80,
        rawText: 'WordPress bevorzugt, Drupal auch akzeptabel',
      },
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate CMS constraints with excluded CMSes', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      cmsConstraints: {
        excluded: ['Joomla', 'Typo3'],
        flexibility: 'flexible',
        confidence: 85,
        rawText: 'kein Joomla oder Typo3',
      },
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate all flexibility values', () => {
    const flexibilityValues = ['rigid', 'preferred', 'flexible', 'unknown'] as const;

    flexibilityValues.forEach(flexibility => {
      const data = {
        customerName: 'Test Customer',
        projectDescription: 'Test project',
        technologies: [],
        keyRequirements: [],
        confidenceScore: 0.9,
        extractedAt: new Date().toISOString(),
        cmsConstraints: {
          flexibility,
          confidence: 75,
          rawText: 'test',
        },
      };

      expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
    });
  });

  it('should reject invalid flexibility value', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      cmsConstraints: {
        flexibility: 'maybe',
        confidence: 75,
        rawText: 'test',
      },
    };

    expect(() => extractedRequirementsSchema.parse(data)).toThrow();
  });
});

describe('Extraction Schema - Deliverables with Timeline', () => {
  it('should validate deliverable with deadline and time', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      requiredDeliverables: [
        {
          name: 'Angebot',
          description: 'Preisangebot',
          deadline: '2025-02-15',
          deadlineTime: '14:00',
          format: 'PDF',
          copies: 3,
          mandatory: true,
          confidence: 95,
        },
      ],
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate deliverable without deadline (unknown)', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      requiredDeliverables: [
        {
          name: 'Referenzen',
          mandatory: false,
          confidence: 70,
        },
      ],
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate multiple deliverables with different deadlines', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      requiredDeliverables: [
        {
          name: 'Angebot',
          deadline: '2025-02-15',
          deadlineTime: '14:00',
          mandatory: true,
          confidence: 95,
        },
        {
          name: 'Präsentation',
          deadline: '2025-03-31',
          mandatory: true,
          confidence: 85,
        },
        {
          name: 'Referenzen',
          mandatory: false,
          confidence: 70,
        },
      ],
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });
});

describe('Extraction Schema - Contact Categorization', () => {
  it('should validate decision maker contact', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      contacts: [
        {
          name: 'Dr. Schmidt',
          role: 'CTO',
          email: 'schmidt@example.com',
          phone: '+49 123 456789',
          category: 'decision_maker',
          confidence: 95,
        },
      ],
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should validate all contact categories', () => {
    const categories = ['decision_maker', 'influencer', 'coordinator', 'unknown'] as const;

    categories.forEach(category => {
      const data = {
        customerName: 'Test Customer',
        projectDescription: 'Test project',
        technologies: [],
        keyRequirements: [],
        confidenceScore: 0.9,
        extractedAt: new Date().toISOString(),
        contacts: [
          {
            name: 'Test Person',
            role: 'Test Role',
            category,
            confidence: 80,
          },
        ],
      };

      expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
    });
  });

  it('should validate multiple contacts with different categories', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      contacts: [
        {
          name: 'Dr. Schmidt',
          role: 'CTO',
          email: 'schmidt@example.com',
          category: 'decision_maker',
          confidence: 95,
        },
        {
          name: 'Herr Müller',
          role: 'Projektleiter',
          email: 'mueller@example.com',
          category: 'influencer',
          confidence: 85,
        },
        {
          name: 'Frau Weber',
          role: 'Einkauf',
          category: 'coordinator',
          confidence: 80,
        },
      ],
    };

    expect(() => extractedRequirementsSchema.parse(data)).not.toThrow();
  });

  it('should reject invalid contact category', () => {
    const data = {
      customerName: 'Test Customer',
      projectDescription: 'Test project',
      technologies: [],
      keyRequirements: [],
      confidenceScore: 0.9,
      extractedAt: new Date().toISOString(),
      contacts: [
        {
          name: 'Test Person',
          role: 'Test Role',
          category: 'admin',
          confidence: 80,
        },
      ],
    };

    expect(() => extractedRequirementsSchema.parse(data)).toThrow();
  });
});
