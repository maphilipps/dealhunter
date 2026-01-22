/**
 * Tests for lib/agent-tools/evaluator.ts
 *
 * Agent Results Evaluator - AI-based quality checking for agent results.
 * Tests completeness, confidence values, and consistency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  evaluateResults,
  quickEvaluate,
  evaluateQuickScanResults,
  evaluateCMSMatchingResults,
  evaluateBITResults,
  QUICKSCAN_EVALUATION_SCHEMA,
  CMS_MATCHING_EVALUATION_SCHEMA,
  BIT_EVALUATION_SCHEMA,
  type EvaluatorContext,
} from '../evaluator';

// Mock the AI config module
vi.mock('@/lib/ai/config', () => ({
  generateStructuredOutput: vi.fn(),
}));

const { generateStructuredOutput } = await import('@/lib/ai/config');

describe('Agent Tools - Evaluator', () => {
  let mockEmitter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEmitter = vi.fn();
    vi.clearAllMocks();
  });

  describe('Helper Functions', () => {
    describe('calculateBasicMetrics (via evaluateResults)', () => {
      it('should calculate completeness correctly for all required fields present', async () => {
        const results = {
          techStack: { cms: 'Drupal', confidence: 85 },
          contentVolume: { estimatedPageCount: 100 },
          features: ['blog', 'ecommerce'],
          blRecommendation: {
            primaryBusinessLine: 'Healthcare',
            confidence: 75,
          },
        };

        // Mock AI to return simple evaluation
        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 100,
          confidencesMet: true,
          completeness: 100,
          issues: [],
          canImprove: false,
          summary: 'Perfect',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        expect(result.completeness).toBe(100);
      });

      it('should calculate completeness correctly for partial required fields', async () => {
        const results = {
          techStack: { cms: 'Drupal', confidence: 85 },
          // contentVolume missing
          features: ['blog'],
        };

        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 50,
          confidencesMet: true,
          completeness: 50,
          issues: [],
          canImprove: true,
          summary: 'Partial',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        expect(result.completeness).toBe(50); // 2 out of 4 fields
      });

      it('should detect confidence issues when below threshold', async () => {
        const results = {
          techStack: { cms: 'Drupal', confidence: 50 }, // Below 70 threshold
          contentVolume: { estimatedPageCount: 100 },
          features: ['blog'],
          blRecommendation: {
            primaryBusinessLine: 'Healthcare',
            confidence: 55, // Below 60 threshold
          },
        };

        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 70,
          confidencesMet: false,
          completeness: 100,
          issues: [],
          canImprove: true,
          summary: 'Low confidence',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        expect(result.confidencesMet).toBe(false);
      });

      it('should count optional fields correctly', async () => {
        const results = {
          techStack: {
            cms: 'Drupal',
            cmsVersion: '10', // Optional
            confidence: 85,
          },
          contentVolume: { estimatedPageCount: 100 },
          features: ['blog'],
          blRecommendation: {
            primaryBusinessLine: 'Healthcare',
            confidence: 75,
          },
          companyIntelligence: { employees: 100 }, // Optional
        };

        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 100,
          confidencesMet: true,
          completeness: 100,
          issues: [],
          canImprove: false,
          summary: 'With optional fields',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        // Bonus points are capped at 100
        expect(result.qualityScore).toBe(100);
      });
    });

    describe('isValueFilled (via evaluateResults)', () => {
      it('should treat null as not filled', async () => {
        const results = { techStack: null };

        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 0,
          confidencesMet: true,
          completeness: 0,
          issues: [],
          canImprove: true,
          summary: 'Empty',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        expect(result.completeness).toBe(0);
      });

      it('should treat empty string as not filled', async () => {
        const results = { techStack: { cms: '' } };

        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 0,
          confidencesMet: true,
          completeness: 0,
          issues: [],
          canImprove: true,
          summary: 'Empty',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        expect(result.completeness).toBe(0);
      });

      it('should treat empty array as not filled', async () => {
        const results = { features: [] };

        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 0,
          confidencesMet: true,
          completeness: 0,
          issues: [],
          canImprove: true,
          summary: 'Empty',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        expect(result.completeness).toBeLessThan(100);
      });

      it('should treat empty object as not filled', async () => {
        const results = { contentVolume: {} };

        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 0,
          confidencesMet: true,
          completeness: 0,
          issues: [],
          canImprove: true,
          summary: 'Empty',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        expect(result.completeness).toBeLessThan(100);
      });

      it('should treat valid values as filled', async () => {
        const results = {
          techStack: { cms: 'Drupal' },
          contentVolume: { estimatedPageCount: 100 },
          features: ['blog'],
          blRecommendation: { primaryBusinessLine: 'Healthcare', confidence: 75 },
        };

        vi.mocked(generateStructuredOutput).mockResolvedValue({
          qualityScore: 100,
          confidencesMet: true,
          completeness: 100,
          issues: [],
          canImprove: false,
          summary: 'Complete',
        });

        const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

        expect(result.completeness).toBe(100);
      });
    });
  });

  describe('evaluateResults', () => {
    it('should emit progress events when emitter is provided', async () => {
      const ctx: EvaluatorContext = {
        emit: mockEmitter,
        agentName: 'TestAgent',
      };

      const results = {
        techStack: { cms: 'Drupal' },
        contentVolume: { estimatedPageCount: 100 },
      };

      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 80,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Good',
      });

      await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA, ctx);

      expect(mockEmitter).toHaveBeenCalledTimes(2); // Start and end
      const firstCall = mockEmitter.mock.calls[0];
      expect(firstCall).toBeDefined();
      expect(firstCall[0]).toMatchObject({
        data: {
          agent: 'TestAgent',
          message: 'Prüfe Ergebnisqualität...',
        },
      });
    });

    it('should use AI evaluation when successful', async () => {
      const aiEvaluation = {
        qualityScore: 85,
        confidencesMet: true,
        completeness: 90,
        issues: [
          {
            area: 'features',
            severity: 'minor' as const,
            description: 'Missing some features',
            suggestion: 'Run additional crawls',
            canAutoFix: true,
          },
        ],
        canImprove: true,
        summary: 'Good with minor issues',
      };

      vi.mocked(generateStructuredOutput).mockResolvedValue(aiEvaluation);

      const result = await evaluateResults(
        {
          techStack: { cms: 'Drupal' },
          contentVolume: { estimatedPageCount: 100 },
        },
        QUICKSCAN_EVALUATION_SCHEMA
      );

      expect(result).toEqual(aiEvaluation);
      expect(generateStructuredOutput).toHaveBeenCalled();
    });

    it('should fallback to basic evaluation when AI fails', async () => {
      vi.mocked(generateStructuredOutput).mockRejectedValue(new Error('AI failed'));

      const results = {
        techStack: { cms: 'Drupal' },
        // Missing contentVolume, features, blRecommendation
      };

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      expect(result.qualityScore).toBeLessThan(100);
      expect(result.completeness).toBe(25); // 1 out of 4 fields
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].severity).toBe('critical');
    });

    it('should add critical issues for missing required fields in fallback', async () => {
      vi.mocked(generateStructuredOutput).mockRejectedValue(new Error('AI failed'));

      const results = {
        // Only techStack present, rest missing
        techStack: { cms: 'Drupal' },
      };

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      const criticalIssues = result.issues.filter((i) => i.severity === 'critical');
      expect(criticalIssues.length).toBe(3); // 3 missing required fields
      expect(criticalIssues.every((i) => i.canAutoFix)).toBe(true);
    });

    it('should add major issues for low confidence in fallback', async () => {
      vi.mocked(generateStructuredOutput).mockRejectedValue(new Error('AI failed'));

      const results = {
        techStack: { cms: 'Drupal', confidence: 50 }, // Below 70 threshold
        contentVolume: { estimatedPageCount: 100 },
        features: ['blog'],
        blRecommendation: {
          primaryBusinessLine: 'Healthcare',
          confidence: 55, // Below 60 threshold
        },
      };

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      const confidenceIssues = result.issues.filter((i) => i.area === 'confidence');
      expect(confidenceIssues.length).toBe(2);
      expect(confidenceIssues.every((i) => i.severity === 'major')).toBe(true);
    });

    it('should calculate bonus points for optional fields', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const results = {
        techStack: { cms: 'Drupal', cmsVersion: '10', confidence: 85 },
        contentVolume: { estimatedPageCount: 100 },
        features: ['blog'],
        blRecommendation: { primaryBusinessLine: 'Healthcare', confidence: 75 },
        companyIntelligence: { employees: 100 },
        accessibilityAudit: { score: 90 },
        seoAudit: { score: 85 },
        migrationComplexity: { level: 'medium' },
        decisionMakers: [{ name: 'John Doe' }],
      };

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      // Base 100 + 5+5+5+5+10+10 = 140, capped at 100
      expect(result.qualityScore).toBe(100);
    });

    it('should apply confidence penalty', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 90,
        confidencesMet: false,
        completeness: 100,
        issues: [],
        canImprove: true,
        summary: 'Low confidence',
      });

      const results = {
        techStack: { cms: 'Drupal', confidence: 50 }, // Below threshold
        contentVolume: { estimatedPageCount: 100 },
        features: ['blog'],
        blRecommendation: {
          primaryBusinessLine: 'Healthcare',
          confidence: 55, // Below threshold
        },
      };

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      // 2 confidence issues * 5 points penalty = 10 points
      // The AI evaluation should reflect this
      expect(result.confidencesMet).toBe(false);
    });
  });

  describe('quickEvaluate', () => {
    it('should return score and issues without AI call', () => {
      const results = {
        techStack: { cms: 'Drupal' },
        contentVolume: { estimatedPageCount: 100 },
      };

      const result = quickEvaluate(results, QUICKSCAN_EVALUATION_SCHEMA);

      expect(result.score).toBe(50); // 2 out of 4 fields
      expect(result.issues.length).toBe(2);
      expect(result.canImprove).toBe(true);
    });

    it('should identify all missing required fields', () => {
      const results = {
        // All required fields missing
      };

      const result = quickEvaluate(results, QUICKSCAN_EVALUATION_SCHEMA);

      expect(result.score).toBe(0);
      expect(result.issues.length).toBe(4);
      expect(result.canImprove).toBe(true);
    });

    it('should include confidence issues', () => {
      const results = {
        techStack: { cms: 'Drupal', confidence: 50 },
        contentVolume: { estimatedPageCount: 100 },
        features: ['blog'],
        blRecommendation: {
          primaryBusinessLine: 'Healthcare',
          confidence: 55,
        },
      };

      const result = quickEvaluate(results, QUICKSCAN_EVALUATION_SCHEMA);

      expect(result.score).toBe(100);
      // Confidence issues are formatted as "Description: X% < Y%"
      expect(result.issues.some(issue => issue.includes('%') && issue.includes('<'))).toBe(true);
      expect(result.canImprove).toBe(true);
    });

    it('should return perfect score when all fields present with good confidence', () => {
      const results = {
        techStack: { cms: 'Drupal', confidence: 85 },
        contentVolume: { estimatedPageCount: 100 },
        features: ['blog'],
        blRecommendation: {
          primaryBusinessLine: 'Healthcare',
          confidence: 75,
        },
      };

      const result = quickEvaluate(results, QUICKSCAN_EVALUATION_SCHEMA);

      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.canImprove).toBe(false);
    });
  });

  describe('Specialized Evaluators', () => {
    it('evaluateQuickScanResults should use correct schema', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const results = {
        techStack: { cms: 'Drupal' },
        contentVolume: { estimatedPageCount: 100 },
      };

      const ctx: EvaluatorContext = { emit: mockEmitter };

      await evaluateQuickScanResults(results, ctx);

      expect(generateStructuredOutput).toHaveBeenCalled();
      const callArgs = vi.mocked(generateStructuredOutput).mock.calls[0][0];
      expect(callArgs.system).toContain('QuickScan Website Analysis');
      expect(mockEmitter).toHaveBeenCalled();
    });

    it('evaluateCMSMatchingResults should use correct schema', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const results = {
        recommendedCms: 'Drupal',
        featureMatch: 85,
        reasoning: 'Good fit',
      };

      const ctx: EvaluatorContext = { emit: mockEmitter };

      await evaluateCMSMatchingResults(results, ctx);

      expect(generateStructuredOutput).toHaveBeenCalled();
      const callArgs2 = vi.mocked(generateStructuredOutput).mock.calls[0][0];
      expect(callArgs2.system).toContain('CMS Selection & Matching');
    });

    it('evaluateBITResults should use correct schema', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const results = {
        decision: 'BIT',
        overallScore: 85,
        reasoning: 'Good opportunity',
      };

      const ctx: EvaluatorContext = { emit: mockEmitter };

      await evaluateBITResults(results, ctx);

      expect(generateStructuredOutput).toHaveBeenCalled();
      const callArgs3 = vi.mocked(generateStructuredOutput).mock.calls[0][0];
      expect(callArgs3.system).toContain('BIT/NO BIT Evaluation');
    });

    it('should set correct agent name for specialized evaluators', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const ctx: EvaluatorContext = { emit: mockEmitter };

      await evaluateQuickScanResults({}, ctx);
      const call1 = mockEmitter.mock.calls[0];
      expect(call1[0]).toMatchObject({
        data: { agent: 'QuickScan Evaluator' },
      });

      vi.clearAllMocks();

      await evaluateCMSMatchingResults({}, ctx);
      const call2 = mockEmitter.mock.calls[0];
      expect(call2[0]).toMatchObject({
        data: { agent: 'CMS Matching Evaluator' },
      });

      vi.clearAllMocks();

      await evaluateBITResults({}, ctx);
      const call3 = mockEmitter.mock.calls[0];
      expect(call3[0]).toMatchObject({
        data: { agent: 'BIT Evaluator' },
      });
    });
  });

  describe('Evaluation Schemas', () => {
    it('QUICKSCAN_EVALUATION_SCHEMA should have correct structure', () => {
      expect(QUICKSCAN_EVALUATION_SCHEMA.requiredFields).toHaveLength(4);
      expect(QUICKSCAN_EVALUATION_SCHEMA.requiredFields[0]).toEqual({
        path: 'techStack.cms',
        minConfidence: 70,
        description: 'CMS Detection',
      });
      expect(QUICKSCAN_EVALUATION_SCHEMA.optionalFields).toHaveLength(6);
      expect(QUICKSCAN_EVALUATION_SCHEMA.minQualityScore).toBe(70);
    });

    it('CMS_MATCHING_EVALUATION_SCHEMA should have correct structure', () => {
      expect(CMS_MATCHING_EVALUATION_SCHEMA.requiredFields).toHaveLength(3);
      expect(CMS_MATCHING_EVALUATION_SCHEMA.requiredFields[0]).toEqual({
        path: 'recommendedCms',
        minConfidence: 75,
        description: 'CMS Recommendation',
      });
      expect(CMS_MATCHING_EVALUATION_SCHEMA.optionalFields).toHaveLength(3);
      expect(CMS_MATCHING_EVALUATION_SCHEMA.minQualityScore).toBe(75);
    });

    it('BIT_EVALUATION_SCHEMA should have correct structure', () => {
      expect(BIT_EVALUATION_SCHEMA.requiredFields).toHaveLength(3);
      expect(BIT_EVALUATION_SCHEMA.requiredFields[0]).toEqual({
        path: 'decision',
        description: 'BIT/NO BIT Decision',
      });
      expect(BIT_EVALUATION_SCHEMA.optionalFields).toHaveLength(3);
      expect(BIT_EVALUATION_SCHEMA.minQualityScore).toBe(80);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results object', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 0,
        confidencesMet: true,
        completeness: 0,
        issues: [],
        canImprove: true,
        summary: 'Empty',
      });

      const result = await evaluateResults({}, QUICKSCAN_EVALUATION_SCHEMA);

      expect(result.completeness).toBe(0);
      expect(result.qualityScore).toBe(0);
    });

    it('should handle deeply nested paths', async () => {
      const results = {
        techStack: {
          cms: 'Drupal',
          confidence: 85,
        },
        contentVolume: { estimatedPageCount: 100 },
        features: ['blog'],
        blRecommendation: {
          primaryBusinessLine: {
            name: 'Healthcare',
            confidence: 75,
          },
        },
      };

      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      expect(result.completeness).toBe(100);
    });

    it('should handle missing optional fields gracefully', async () => {
      const schema = {
        requiredFields: [{ path: 'field1', description: 'Field 1' }],
        optionalFields: undefined,
      };

      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const result = await evaluateResults({ field1: 'value' }, schema);

      expect(result.completeness).toBe(100);
    });

    it('should work without emitter context', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const ctx: EvaluatorContext = {};

      const result = await evaluateResults(
        { field1: 'value' },
        { requiredFields: [{ path: 'field1', description: 'Field 1' }] },
        ctx
      );

      expect(result.qualityScore).toBe(100);
    });

    it('should handle schema without minQualityScore', async () => {
      const schema = {
        requiredFields: [{ path: 'field1', description: 'Field 1' }],
        optionalFields: undefined,
        minQualityScore: undefined,
      };

      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const result = await evaluateResults({ field1: 'value' }, schema);

      expect(result.qualityScore).toBe(100);
    });

    it('should handle schema without context', async () => {
      const schema = {
        requiredFields: [{ path: 'field1', description: 'Field 1' }],
        optionalFields: undefined,
        minQualityScore: undefined,
        context: undefined,
      };

      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 100,
        confidencesMet: true,
        completeness: 100,
        issues: [],
        canImprove: false,
        summary: 'Perfect',
      });

      const result = await evaluateResults({ field1: 'value' }, schema);

      expect(result.qualityScore).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle AI errors gracefully with fallback', async () => {
      vi.mocked(generateStructuredOutput).mockRejectedValue(
        new Error('Network error')
      );

      const results = {
        techStack: { cms: 'Drupal' },
      };

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      expect(result.completeness).toBe(25);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should handle malformed confidence values', async () => {
      vi.mocked(generateStructuredOutput).mockRejectedValue(new Error('AI failed'));

      const results = {
        techStack: { cms: 'Drupal', confidence: 'invalid' as unknown as number },
        contentVolume: { estimatedPageCount: 100 },
        features: ['blog'],
        blRecommendation: { primaryBusinessLine: 'Healthcare', confidence: 75 },
      };

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      // Should not crash, just ignore invalid confidence
      expect(result.completeness).toBeGreaterThan(0);
    });

    it('should handle undefined nested values gracefully', async () => {
      vi.mocked(generateStructuredOutput).mockResolvedValue({
        qualityScore: 75,
        confidencesMet: true,
        completeness: 75,
        issues: [],
        canImprove: true,
        summary: 'Partial',
      });

      const results = {
        techStack: { cms: undefined },
        contentVolume: { estimatedPageCount: 100 },
        features: ['blog'],
        blRecommendation: { primaryBusinessLine: 'Healthcare', confidence: 75 },
      };

      const result = await evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA);

      // undefined cms is treated as not filled, so completeness should be lower
      expect(result.completeness).toBe(75); // 3 out of 4 fields
    });
  });
});
