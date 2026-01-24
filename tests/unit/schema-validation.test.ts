import { expect, test, describe } from 'vitest';
import {
  LegalRequirementSchema,
  LegalRfpAnalysisSchema,
} from '@/lib/agents/expert-agents/legal-pre-qualification-schema';
import { ManagementSummarySchema } from '@/lib/agents/expert-agents/summary-schema';

describe('Schema Validation Strictness', () => {
  describe('LegalRequirementSchema', () => {
    test('should throw error for invalid category instead of silently catching', () => {
      const invalidInput = {
        requirement: 'Test requirement',
        category: 'INVALID_CATEGORY', // Should fail, currently caught as 'other'
        riskLevel: 'medium',
      };

      expect(() => LegalRequirementSchema.parse(invalidInput)).toThrow();
    });

    test('should throw error for invalid riskLevel instead of silently catching', () => {
      const invalidInput = {
        requirement: 'Test requirement',
        category: 'contract_terms',
        riskLevel: 'INVALID_RISK', // Should fail, currently caught as 'medium'
      };

      expect(() => LegalRequirementSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('LegalRfpAnalysisSchema', () => {
    test('should throw error for invalid overallRiskLevel', () => {
      const invalidInput = {
        overallRiskLevel: 'INVALID_LEVEL', // Should fail
      };
      // Note: Partial parsing might require more fields, but let's see minimal required
      // LegalRfpAnalysisSchema has many defaults, but let's provide minimal valid object + invalid field
      const input = {
        overallRiskLevel: 'INVALID_LEVEL',
      };

      expect(() => LegalRfpAnalysisSchema.parse(input)).toThrow();
    });
  });

  describe('ManagementSummarySchema', () => {
    test('should throw error for invalid urgencyLevel', () => {
      const input = {
        assessment: {
          urgencyLevel: 'INVALID_URGENCY',
        },
      };
      // assessment is nested. ManagementSummarySchema has defaults for assessment.
      // But if we provide assessment object, we must validate its fields.

      // We need to provide a structure that satisfies the schema enough to reach the validation
      const fullInput = {
        assessment: {
          fitScore: 5,
          complexityScore: 5,
          urgencyLevel: 'INVALID_URGENCY', // Should fail, currently caught as 'medium'
          recommendation: 'consider',
          reasoning: 'test',
        },
      };

      expect(() => ManagementSummarySchema.parse(fullInput)).toThrow();
    });

    test('should throw error for invalid recommendation', () => {
      const fullInput = {
        assessment: {
          fitScore: 5,
          complexityScore: 5,
          urgencyLevel: 'medium',
          recommendation: 'INVALID_REC', // Should fail, currently caught as 'consider'
          reasoning: 'test',
        },
      };

      expect(() => ManagementSummarySchema.parse(fullInput)).toThrow();
    });
  });
});
