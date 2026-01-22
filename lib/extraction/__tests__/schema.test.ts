/**
 * Extraction Schema Tests
 *
 * Tests for the Zod schemas used for AI-extracted requirements from bid documents.
 */

import { describe, it, expect } from 'vitest';
import {
  extractedRequirementsSchema,
  extractionResultSchema,
  type ExtractedRequirements,
  type ExtractionResult,
} from '../schema';

describe('Extraction Schema', () => {
  describe('extractedRequirementsSchema', () => {
    const minimalValidData: ExtractedRequirements = {
      customerName: 'Test Customer',
      projectDescription: 'A test project for website development',
      technologies: ['Drupal', 'React'],
      keyRequirements: ['Requirement 1', 'Requirement 2'],
      confidenceScore: 0.85,
    };

    it('should validate minimal valid data', () => {
      const result = extractedRequirementsSchema.safeParse(minimalValidData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe('Test Customer');
        expect(result.data.technologies).toHaveLength(2);
      }
    });

    it('should validate complete data with all optional fields', () => {
      const completeData: ExtractedRequirements = {
        // Customer Information
        customerName: 'Test Customer AG',
        industry: 'Technology',
        companySize: 'large',
        employeeCountRange: '1000-5000',
        revenueRange: '100-500 Mio EUR',
        procurementType: 'public',
        industryVertical: 'Software Development',
        companyLocation: 'Berlin, Germany',

        // Website URLs
        websiteUrls: [
          {
            url: 'https://www.testcustomer.de',
            type: 'primary',
            description: 'Main corporate website',
            extractedFromDocument: true,
          },
          {
            url: 'https://www.testcustomer.com',
            type: 'regional',
            description: 'International site',
            extractedFromDocument: false,
          },
        ],
        websiteUrl: 'https://www.testcustomer.de', // Deprecated field

        // Project Details
        projectDescription: 'Complete website redesign and migration',
        projectName: 'Corporate Website 2024',

        // Technical Requirements
        technologies: ['Drupal', 'React', 'Node.js', 'TypeScript'],
        scope: 'Development, Migration, Consulting',

        // CMS Constraints
        cmsConstraints: {
          required: ['Drupal'],
          preferred: ['WordPress'],
          excluded: ['Joomla'],
          flexibility: 'preferred',
          confidence: 90,
          rawText: 'Must use Drupal, WordPress preferred',
        },

        // Business Requirements
        budgetRange: {
          min: 100000,
          max: 500000,
          currency: 'EUR',
          confidence: 75,
          rawText: 'Budget between 100k and 500k EUR',
        },
        timeline: '6 months',
        teamSize: 5,

        // Submission Details
        submissionDeadline: '2024-06-30',
        submissionTime: '14:00',
        projectStartDate: '2024-07-01',
        projectEndDate: '2024-12-31',

        // Required Deliverables
        requiredDeliverables: [
          {
            name: 'Technical Proposal',
            description: 'Detailed technical architecture',
            deadline: '2024-06-30',
            deadlineTime: '14:00',
            format: 'PDF',
            copies: 2,
            mandatory: true,
            confidence: 95,
          },
          {
            name: 'Price Quote',
            mandatory: true,
            confidence: 95,
          },
        ],

        // Contact Information
        contactPerson: 'Max Mustermann',
        contactEmail: 'max.mustermann@testcustomer.de',
        contactPhone: '+49 30 1234567',

        // Structured Contacts
        contacts: [
          {
            name: 'Max Mustermann',
            role: 'Project Manager',
            email: 'max@testcustomer.de',
            phone: '+49 30 1234567',
            category: 'decision_maker',
            confidence: 90,
          },
          {
            name: 'Erika Musterfrau',
            role: 'Technical Contact',
            email: 'erika@testcustomer.de',
            category: 'influencer',
            confidence: 80,
          },
        ],

        // Additional Context
        keyRequirements: ['GDPR compliance', 'Multi-language support', 'Accessibility'],
        constraints: ['Fixed deadline', 'Budget cap at 500k'],

        // Metadata
        confidenceScore: 0.92,
        extractedAt: '2024-01-15T10:30:00Z',
      };

      const result = extractedRequirementsSchema.safeParse(completeData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.websiteUrls).toHaveLength(2);
        expect(result.data.cmsConstraints?.required).toEqual(['Drupal']);
        expect(result.data.contacts).toHaveLength(2);
      }
    });

    it('should require mandatory fields', () => {
      const incompleteData = {
        // Missing customerName
        projectDescription: 'Test project',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
      };

      const result = extractedRequirementsSchema.safeParse(incompleteData);

      expect(result.success).toBe(false);
    });

    it('should reject invalid company size', () => {
      const invalidData = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        companySize: 'invalid_size' as any,
      };

      const result = extractedRequirementsSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should accept all valid company sizes', () => {
      const validSizes = ['startup', 'small', 'medium', 'large', 'enterprise'] as const;

      validSizes.forEach(size => {
        const data = { ...minimalValidData, companySize: size };
        const result = extractedRequirementsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid procurement type', () => {
      const invalidData = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        procurementType: 'invalid_type' as any,
      };

      const result = extractedRequirementsSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should accept all valid procurement types', () => {
      const validTypes = ['public', 'private', 'semi-public'] as const;

      validTypes.forEach(type => {
        const data = { ...minimalValidData, procurementType: type };
        const result = extractedRequirementsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate websiteUrls array structure', () => {
      const dataWithUrls = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        websiteUrls: [
          {
            url: 'https://www.example.com',
            type: 'primary' as const,
            description: 'Main site',
            extractedFromDocument: true,
          },
        ],
      };

      const result = extractedRequirementsSchema.safeParse(dataWithUrls);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.websiteUrls).toHaveLength(1);
        expect(result.data.websiteUrls![0].url).toBe('https://www.example.com');
      }
    });

    it('should accept all valid website URL types', () => {
      const validTypes = ['primary', 'product', 'regional', 'related'] as const;

      validTypes.forEach(type => {
        const data = {
          customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
          websiteUrls: [
            {
              url: 'https://www.example.com',
              type,
              description: 'Test',
              extractedFromDocument: false,
            },
          ],
        };

        const result = extractedRequirementsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate CMS constraints structure', () => {
      const dataWithCms = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        cmsConstraints: {
          required: ['Drupal'],
          preferred: ['WordPress'],
          excluded: ['Joomla'],
          flexibility: 'preferred' as const,
          confidence: 85,
          rawText: 'CMS requirements',
        },
      };

      const result = extractedRequirementsSchema.safeParse(dataWithCms);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cmsConstraints?.flexibility).toBe('preferred');
      }
    });

    it('should accept all valid CMS flexibility values', () => {
      const validFlexibilities = ['rigid', 'preferred', 'flexible', 'unknown'] as const;

      validFlexibilities.forEach(flexibility => {
        const data = {
          customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
          cmsConstraints: {
            flexibility,
            confidence: 80,
            rawText: 'Test',
          },
        };

        const result = extractedRequirementsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate budget range structure', () => {
      const dataWithBudget = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        budgetRange: {
          min: 50000,
          max: 200000,
          currency: 'EUR' as const,
          confidence: 80,
          rawText: 'Budget 50-200k EUR',
        },
      };

      const result = extractedRequirementsSchema.safeParse(dataWithBudget);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.budgetRange?.currency).toBe('EUR');
        expect(result.data.budgetRange?.min).toBe(50000);
      }
    });

    it('should accept all valid budget currencies', () => {
      const validCurrencies = ['EUR', 'USD', 'GBP', 'CHF'] as const;

      validCurrencies.forEach(currency => {
        const data = {
          customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
          budgetRange: {
            currency,
            confidence: 75,
            rawText: 'Test',
          },
        };

        const result = extractedRequirementsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate requiredDeliverables array', () => {
      const dataWithDeliverables = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        requiredDeliverables: [
          {
            name: 'Proposal',
            description: 'Detailed proposal document',
            deadline: '2024-06-30',
            deadlineTime: '14:00',
            format: 'PDF',
            copies: 3,
            mandatory: true,
            confidence: 90,
          },
        ],
      };

      const result = extractedRequirementsSchema.safeParse(dataWithDeliverables);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiredDeliverables).toHaveLength(1);
      }
    });

    it('should default mandatory to true in deliverables', () => {
      const deliverableWithoutMandatory = {
        name: 'Proposal',
        confidence: 85,
      };

      // This is handled by Zod's default() in the schema
      const data = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        requiredDeliverables: [deliverableWithoutMandatory],
      };

      const result = extractedRequirementsSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiredDeliverables![0].mandatory).toBe(true);
      }
    });

    it('should validate contacts array structure', () => {
      const dataWithContacts = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        contacts: [
          {
            name: 'John Doe',
            role: 'CTO',
            email: 'john@example.com',
            phone: '+49 123 456',
            category: 'decision_maker' as const,
            confidence: 95,
          },
        ],
      };

      const result = extractedRequirementsSchema.safeParse(dataWithContacts);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contacts).toHaveLength(1);
        expect(result.data.contacts![0].category).toBe('decision_maker');
      }
    });

    it('should accept all valid contact categories', () => {
      const validCategories = ['decision_maker', 'influencer', 'coordinator', 'unknown'] as const;

      validCategories.forEach(category => {
        const data = {
          customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
          contacts: [
            {
              name: 'Test Contact',
              role: 'Manager',
              category,
              confidence: 80,
            },
          ],
        };

        const result = extractedRequirementsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should validate confidenceScore range', () => {
      const validScores = [0, 0.5, 0.85, 0.99, 1];

      validScores.forEach(score => {
        const data = { ...minimalValidData, confidenceScore: score };
        const result = extractedRequirementsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should reject confidenceScore outside 0-1 range', () => {
      const invalidScores = [-0.1, 1.1, 2, 10];

      invalidScores.forEach(score => {
        const data = { ...minimalValidData, confidenceScore: score };
        const result = extractedRequirementsSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    it('should validate date formats for dates', () => {
      const dataWithDates = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        submissionDeadline: '2024-12-31',
        projectStartDate: '2025-01-01',
        projectEndDate: '2025-06-30',
        extractedAt: '2024-01-15T10:30:00Z',
      };

      const result = extractedRequirementsSchema.safeParse(dataWithDates);

      expect(result.success).toBe(true);
    });

    it('should handle technologies array with many items', () => {
      const manyTechnologies = [
        'Drupal',
        'WordPress',
        'React',
        'Vue',
        'Angular',
        'Node.js',
        'TypeScript',
        'PHP',
        'Python',
        'Java',
      ];

      const data = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        technologies: manyTechnologies,
      };

      const result = extractedRequirementsSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.technologies).toHaveLength(10);
      }
    });

    it('should allow empty arrays for optional fields', () => {
      const dataWithEmptyArrays: ExtractedRequirements = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        technologies: [],
        keyRequirements: [],
        websiteUrls: [],
        requiredDeliverables: [],
        contacts: [],
        constraints: [],
      };

      const result = extractedRequirementsSchema.safeParse(dataWithEmptyArrays);

      expect(result.success).toBe(true);
    });

    it('should validate CMS constraints confidence range', () => {
      const dataWithCms = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        cmsConstraints: {
          confidence: 95,
          rawText: 'Test',
        },
      };
// // 
// //       const result = extractedRequirementsSchema.safeParse(dataWithCms);
// // 
// //       expect(result.success).toBe(true);
// //       if (result.success) {
// //         expect(result.data.cmsConstraints?.confidence).toBe(95);
// //       }
// //     });
// // 
// //     it('should reject CMS constraints confidence outside 0-100', () => {
      const dataWithInvalidCms = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        cmsConstraints: {
          confidence: 150,
          rawText: 'Test',
        },
      };

      const result = extractedRequirementsSchema.safeParse(dataWithInvalidCms);

      expect(result.success).toBe(false);
    });

    it('should validate budget range confidence', () => {
      const dataWithBudget = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        budgetRange: {
          confidence: 85,
          rawText: 'Test',
        },
      };

      const result = extractedRequirementsSchema.safeParse(dataWithBudget);

      expect(result.success).toBe(true);
    });

    it('should reject budget range confidence outside 0-100', () => {
      const dataWithInvalidBudget = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        budgetRange: {
          confidence: -10,
          rawText: 'Test',
        },
      };

      const result = extractedRequirementsSchema.safeParse(dataWithInvalidBudget);

      expect(result.success).toBe(false);
    });
  });

  describe('extractionResultSchema', () => {
    it('should validate complete extraction result', () => {
      const validResult: ExtractionResult = {
        requirements: {
          customerName: 'Test Customer',
          projectDescription: 'Test project',
          technologies: ['Drupal'],
          keyRequirements: ['Req 1'],
          confidenceScore: 0.9,
        },
        activityLog: [
          {
            timestamp: '2024-01-15T10:00:00Z',
            action: 'extraction_started',
            details: 'Started processing document',
          },
          {
            timestamp: '2024-01-15T10:01:00Z',
            action: 'ai_analysis_complete',
          },
        ],
      };

      const result = extractionResultSchema.safeParse(validResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activityLog).toHaveLength(2);
        expect(result.data.requirements.customerName).toBe('Test Customer');
      }
    });

    it('should allow empty activity log', () => {
      const resultWithEmptyLog: ExtractionResult = {
        requirements: {
          customerName: 'Test',
          projectDescription: 'Test',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        },
        activityLog: [],
      };

      const result = extractionResultSchema.safeParse(resultWithEmptyLog);

      expect(result.success).toBe(true);
    });

    it('should require activity log array', () => {
      const incompleteResult = {
        requirements: {
          customerName: 'Test',
          projectDescription: 'Test',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        },
        // Missing activityLog
      };

      const result = extractionResultSchema.safeParse(incompleteResult);

      expect(result.success).toBe(false);
    });

    it('should validate activity log entry structure', () => {
      const validEntry: ExtractionResult = {
        requirements: {
          customerName: 'Test',
          projectDescription: 'Test',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        },
        activityLog: [
          {
            timestamp: '2024-01-15T10:00:00Z',
            action: 'test_action',
            details: 'Optional details',
          },
        ],
      };

      const result = extractionResultSchema.safeParse(validEntry);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activityLog[0].details).toBe('Optional details');
      }
    });

    it('should allow activity log entries without details', () => {
      const entryWithoutDetails: ExtractionResult = {
        requirements: {
          customerName: 'Test',
          projectDescription: 'Test',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        },
        activityLog: [
          {
            timestamp: '2024-01-15T10:00:00Z',
            action: 'simple_action',
          },
        ],
      };

      const result = extractionResultSchema.safeParse(entryWithoutDetails);

      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases and Real-World Scenarios', () => {
    it('should handle German company names', () => {
      const germanData: ExtractedRequirements = {
        customerName: 'Städtische Werke GmbH & Co. KG',
        industry: 'Public Utilities',
        projectDescription: 'Digitalisierung der Kundenschnittstelle',
        technologies: ['Drupal', 'React'],
        keyRequirements: ['DSGVO-Konformität', 'Barrierefreiheit nach BITV 2.0'],
        confidenceScore: 0.88,
      };

      const result = extractedRequirementsSchema.safeParse(germanData);

      expect(result.success).toBe(true);
    });

    it('should handle realistic budget range', () => {
      const realisticData: ExtractedRequirements = {
        customerName: 'Ministerium für Digitalisierung',
        procurementType: 'public',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        budgetRange: {
          min: 150000,
          max: 450000,
          currency: 'EUR',
          confidence: 70,
          rawText: 'Das Budget liegt im Rahmen von 150.000 bis 450.000 EUR',
        },
      };

      const result = extractedRequirementsSchema.safeParse(realisticData);

      expect(result.success).toBe(true);
    });

    it('should handle multiple contacts with different roles', () => {
      const multipleContacts: ExtractedRequirements = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        contacts: [
          {
            name: 'Dr. Maria Schmidt',
            role: 'Abteilungsleiter IT',
            email: 'm.schmidt@gov.de',
            phone: '+49 30 12345678',
            category: 'decision_maker',
            confidence: 95,
          },
          {
            name: 'Thomas Müller',
            role: 'Projektkoordinator',
            email: 't.mueller@gov.de',
            category: 'coordinator',
            confidence: 90,
          },
          {
            name: 'Julia Weber',
            role: 'Technische Ansprechpartnerin',
            email: 'j.weber@gov.de',
            category: 'influencer',
            confidence: 85,
          },
        ],
      };

      const result = extractedRequirementsSchema.safeParse(multipleContacts);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contacts).toHaveLength(3);
      }
    });

    it('should handle complex deliverables list', () => {
      const complexDeliverables: ExtractedRequirements = {
        customerName: 'Test Customer',
        projectDescription: 'A test project for website development',
        technologies: ['Drupal'],
        keyRequirements: ['Req 1'],
        confidenceScore: 0.8,
        requiredDeliverables: [
          {
            name: 'Leistungsbeschreibung',
            description: 'Detaillierte Beschreibung der zu erbringenden Leistungen',
            deadline: '2024-06-30',
            deadlineTime: '14:00',
            format: 'PDF',
            copies: 2,
            mandatory: true,
            confidence: 100,
          },
          {
            name: 'Referenzprojekte',
            description: 'Beschreibung von drei vergleichbaren Projekten',
            deadline: '2024-06-30',
            format: 'PDF',
            mandatory: true,
            confidence: 95,
          },
          {
            name: 'Wirtschaftliches Angebot',
            deadline: '2024-06-30',
            deadlineTime: '14:00',
            format: 'PDF',
            copies: 1,
            mandatory: true,
            confidence: 100,
          },
          {
            name: 'Nutzungskonzept',
            description: 'Optional: Konzept zur Content-Migration',
            mandatory: false,
            confidence: 70,
          },
        ],
      };

      const result = extractedRequirementsSchema.safeParse(complexDeliverables);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiredDeliverables).toHaveLength(4);
        expect(result.data.requiredDeliverables![0].mandatory).toBe(true);
        expect(result.data.requiredDeliverables![3].mandatory).toBe(false);
      }
    });
  });
});
