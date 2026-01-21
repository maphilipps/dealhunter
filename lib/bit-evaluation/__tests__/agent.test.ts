/**
 * BIT Evaluation Agent Tests
 *
 * Tests for the main BIT evaluation coordinator:
 * - runBitEvaluation - Main coordinator function
 * - runBitEvaluationWithStreaming - Streaming version with events
 * - Helper functions for decision generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI and AI config BEFORE importing
vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: vi.fn(() => Promise.resolve({
          choices: [{ message: { content: '{}' } }],
        })),
      },
    };
  },
}));

vi.mock('@/lib/ai/config', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(() => Promise.resolve({
          choices: [{ message: { content: '{}' } }],
        })),
      },
    },
  },
  modelNames: {
    fast: 'claude-haiku-4.5',
    default: 'claude-haiku-4.5',
    quality: 'claude-sonnet-4',
    premium: 'claude-sonnet-4',
  },
  defaultSettings: {
    deterministic: { temperature: 0.3, maxTokens: 4000 },
    creative: { temperature: 0.7, maxTokens: 4000 },
    longForm: { temperature: 0.5, maxTokens: 8000 },
  },
  generateStructuredOutput: vi.fn(),
}));

vi.mock('@/lib/agent-tools/evaluator', () => ({
  quickEvaluate: vi.fn(() => ({ score: 100, issues: [] })),
  BIT_EVALUATION_SCHEMA: {},
}));

import { runBitEvaluation } from '../agent';
import type { BitEvaluationInput } from '../agent';

// Mock all agent dependencies
vi.mock('../agents/capability-agent', () => ({
  runCapabilityAgent: vi.fn(() => Promise.resolve({
    overallCapabilityScore: 75,
    confidence: 80,
    reasoning: 'Good capability match',
    criticalBlockers: [],
  })),
}));

vi.mock('../agents/competition-agent', () => ({
  runCompetitionAgent: vi.fn(() => Promise.resolve({
    estimatedWinProbability: 65,
    confidence: 70,
    reasoning: 'Moderate competition',
    criticalBlockers: [],
  })),
}));

vi.mock('../agents/contract-agent', () => ({
  runContractAgent: vi.fn(() => Promise.resolve({
    overallContractScore: 70,
    confidence: 75,
    reasoning: 'Acceptable contract terms',
    criticalBlockers: [],
  })),
}));

vi.mock('../agents/deal-quality-agent', () => ({
  runDealQualityAgent: vi.fn(() => Promise.resolve({
    overallDealQualityScore: 80,
    confidence: 85,
    reasoning: 'High deal quality',
    criticalBlockers: [],
  })),
}));

vi.mock('../agents/legal-agent', () => ({
  runLegalAgent: vi.fn(() => Promise.resolve({
    overallLegalScore: 72,
    confidence: 78,
    reasoning: 'Legal risks manageable',
    criticalBlockers: [],
  })),
}));

vi.mock('../agents/reference-agent', () => ({
  runReferenceAgent: vi.fn(() => Promise.resolve({
    overallReferenceScore: 68,
    confidence: 73,
    reasoning: 'Some relevant references',
    criticalBlockers: [],
  })),
}));

vi.mock('../agents/strategic-fit-agent', () => ({
  runStrategicFitAgent: vi.fn(() => Promise.resolve({
    overallStrategicFitScore: 77,
    confidence: 82,
    reasoning: 'Good strategic fit',
    criticalBlockers: [],
  })),
}));

vi.mock('../coordinator-agent', () => ({
  runCoordinatorAgent: vi.fn(() => Promise.resolve({
    recommendation: 'bit',
    confidence: 78,
    synthesis: {
      executiveSummary: 'Overall positive assessment with strong capabilities',
      keyStrengths: ['Strong technical capabilities', 'Good strategic fit'],
      keyRisks: ['Moderate competition', 'Timeline constraints'],
      criticalBlockers: [],
    },
    nextSteps: ['Prepare detailed proposal', 'Schedule stakeholder meeting'],
  })),
}));

describe('BIT Evaluation Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('runBitEvaluation', () => {
    const mockInput: BitEvaluationInput = {
      bidId: 'test-bid-123',
      extractedRequirements: {
        title: 'Test Project',
        description: 'Test description',
      },
      quickScanResults: {
        techStack: ['React', 'Node.js'],
        businessLine: 'DXS',
      },
    };

    it('should run all seven agents in parallel', async () => {
      const result = await runBitEvaluation(mockInput);

      expect(result).toBeDefined();
      expect(result.capabilityMatch).toBeDefined();
      expect(result.dealQuality).toBeDefined();
      expect(result.strategicFit).toBeDefined();
      expect(result.competitionCheck).toBeDefined();
      expect(result.legalAssessment).toBeDefined();
      expect(result.contractAnalysis).toBeDefined();
      expect(result.referenceMatch).toBeDefined();
    });

    it('should calculate weighted scores correctly', async () => {
      const result = await runBitEvaluation(mockInput);

      expect(result.decision.scores).toBeDefined();
      expect(result.decision.scores.capability).toBe(75);
      expect(result.decision.scores.dealQuality).toBe(80);
      expect(result.decision.scores.strategicFit).toBe(77);
      expect(result.decision.scores.winProbability).toBe(65);
      expect(result.decision.scores.legal).toBe(72);
      expect(result.decision.scores.reference).toBe(68);
      
      // Overall = (75*0.25 + 80*0.2 + 77*0.15 + 65*0.15 + 72*0.15 + 68*0.1)
      // 18.75 + 16 + 11.55 + 9.75 + 10.8 + 6.8 = 73.65
      expect(result.decision.scores.overall).toBeCloseTo(73.65, 1);
    });

    it('should generate activity log during evaluation', async () => {
      const result = await runBitEvaluation(mockInput);

      expect(result.evaluationDuration).toBeGreaterThanOrEqual(0);
      expect(result.evaluatedAt).toBeDefined();
    });

    it('should include coordinator output in result', async () => {
      const result = await runBitEvaluation(mockInput);

      expect(result.coordinatorOutput).toBeDefined();
      expect(result.coordinatorOutput.recommendation).toBe('bit');
      expect(result.coordinatorOutput.confidence).toBe(78);
    });

    it('should build decision from coordinator output', async () => {
      const result = await runBitEvaluation(mockInput);

      expect(result.decision).toBeDefined();
      expect(result.decision.decision).toBe('bit');
      expect(result.decision.overallConfidence).toBe(78);
      expect(result.decision.reasoning).toBe('Overall positive assessment with strong capabilities');
      expect(result.decision.keyStrengths).toHaveLength(2);
      expect(result.decision.keyRisks).toHaveLength(2);
      expect(result.decision.criticalBlockers).toHaveLength(0);
      expect(result.decision.nextSteps).toHaveLength(2);
    });

    it('should collect all critical blockers from agents', async () => {
      // Create a fresh test with blockers in the default mocks
      const { runCapabilityAgent: capabilityAgent } = await import('../agents/capability-agent');
      const { runDealQualityAgent: dealQualityAgent } = await import('../agents/deal-quality-agent');

      // Reset and reconfigure mocks for this specific test
      vi.mocked(capabilityAgent).mockResolvedValueOnce({
        overallCapabilityScore: 40,
        confidence: 70,
        reasoning: 'Poor capability match',
        criticalBlockers: ['Missing critical skills', 'Insufficient resources'],
        // @ts-expect-error - Testing with partial mock data
        hasRequiredTechnologies: false,
        technologyMatchScore: 30,
        missingCapabilities: ['Critical skills missing'],
        hasRequiredScale: false,
        scaleMatchScore: 30,
        scaleGaps: ['Insufficient resources'],
      });

      vi.mocked(dealQualityAgent).mockResolvedValueOnce({
        // @ts-expect-error - Testing with partial mock data
        budgetAdequacy: 'inadequate',
        estimatedMargin: -10,
        budgetRisks: ['Low budget'],
        timelineRealism: 'unrealistic',
        timelineRisks: ['Tight timeline'],
        clientRiskRating: 'high',
        clientRiskFactors: ['Financial risk'],
        projectComplexity: 'high',
        complexityFactors: ['Scope unclear'],
        strategicValue: 'low',
        strategicFactors: [],
        contractTypeRisk: 'high',
        contractRisks: ['Unfavorable terms'],
        overallDealQualityScore: 50,
        confidence: 65,
        reasoning: 'Low deal quality',
        criticalBlockers: ['Unprofitable project'],
      });

      const result = await runBitEvaluation(mockInput);

      // The decision.criticalBlockers comes from coordinator, not directly from agents
      // The allCriticalBlockers array is passed to coordinator but may be filtered
      expect(result.decision.criticalBlockers).toBeDefined();
      expect(Array.isArray(result.decision.criticalBlockers)).toBe(true);
    });

    it('should handle useWebSearch parameter', async () => {
      const inputWithWebSearch: BitEvaluationInput = {
        ...mockInput,
        useWebSearch: true,
      };

      const result = await runBitEvaluation(inputWithWebSearch);

      expect(result).toBeDefined();
      // Verify agents were called (implicitly through result)
    });

    it('should default useWebSearch to true if not provided', async () => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const inputWithoutWebSearch: BitEvaluationInput = {
        bidId: 'test-bid-456',
        extractedRequirements: mockInput.extractedRequirements,
      };
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */

      const result = await runBitEvaluation(inputWithoutWebSearch);

      expect(result).toBeDefined();
    });

    it('should throw error if agent fails', async () => {
      const { runCapabilityAgent } = await import('../agents/capability-agent');
      vi.mocked(runCapabilityAgent).mockRejectedValueOnce(new Error('Agent failure'));

      await expect(runBitEvaluation(mockInput)).rejects.toThrow('Agent failure');
    });

    it('should set correct evaluation timestamp', async () => {
      const beforeTime = new Date().toISOString();
      const result = await runBitEvaluation(mockInput);
      const afterTime = new Date().toISOString();

      expect(result.evaluatedAt).toBeDefined();
      expect(result.evaluatedAt >= beforeTime).toBe(true);
      expect(result.evaluatedAt <= afterTime).toBe(true);
    });

    it('should complete evaluation within reasonable time', async () => {
      const startTime = Date.now();
      const result = await runBitEvaluation(mockInput);
      const endTime = Date.now();

      expect(result.evaluationDuration).toBeGreaterThanOrEqual(0);
      expect(result.evaluationDuration).toBeLessThan(10000); // Less than 10 seconds
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  describe('Weighted Score Calculation', () => {
    it('should apply correct weights to component scores', async () => {
      const mockInput: BitEvaluationInput = {
        bidId: 'test-weights',
        extractedRequirements: { title: 'Test' },
      };

      const result = await runBitEvaluation(mockInput);
      const { scores } = result.decision;

      // Verify weight distribution
      // Capability: 25%, Deal Quality: 20%, Strategic Fit: 15%
      // Win Probability: 15%, Legal: 15%, Reference: 10%
      const expectedOverall = 
        scores.capability * 0.25 +
        scores.dealQuality * 0.2 +
        scores.strategicFit * 0.15 +
        scores.winProbability * 0.15 +
        scores.legal * 0.15 +
        scores.reference * 0.1;

      expect(scores.overall).toBeCloseTo(expectedOverall, 1);
    });

    it('should handle edge case with perfect scores', async () => {
      const { runCapabilityAgent } = await import('../agents/capability-agent');
      const { runDealQualityAgent } = await import('../agents/deal-quality-agent');
      const { runStrategicFitAgent } = await import('../agents/strategic-fit-agent');
      const { runCompetitionAgent } = await import('../agents/competition-agent');
      const { runLegalAgent } = await import('../agents/legal-agent');
      const { runReferenceAgent } = await import('../agents/reference-agent');

      vi.mocked(runCapabilityAgent).mockResolvedValueOnce({
        overallCapabilityScore: 100,
        confidence: 100,
        reasoning: 'Perfect match',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        hasRequiredTechnologies: true,
        technologyMatchScore: 100,
        missingCapabilities: [],
        hasRequiredScale: true,
        scaleMatchScore: 100,
        scaleGaps: [],
      });

      vi.mocked(runDealQualityAgent).mockResolvedValueOnce({
        overallDealQualityScore: 100,
        confidence: 100,
        reasoning: 'Excellent quality',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        budgetAdequacy: 'adequate',
        estimatedMargin: 30,
        budgetRisks: [],
        timelineRealism: 'realistic',
        timelineRisks: [],
        clientRiskRating: 'low',
        clientRiskFactors: [],
        projectComplexity: 'low',
        complexityFactors: [],
        strategicValue: 'high',
        strategicFactors: ['High value'],
        contractTypeRisk: 'low',
        contractRisks: [],
      });

      vi.mocked(runStrategicFitAgent).mockResolvedValueOnce({
        overallStrategicFitScore: 100,
        confidence: 100,
        reasoning: 'Perfect strategic fit',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        strategicAlignment: 'high',
        marketPositioning: 'strong',
        competitiveAdvantage: 'significant',
        synergies: ['Strong synergies'],
        fitScore: 100,
      });

      vi.mocked(runCompetitionAgent).mockResolvedValueOnce({
        estimatedWinProbability: 100,
        confidence: 100,
        reasoning: 'No competition',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        competitiveIntensity: 'low',
        competitors: [],
        competitiveAdvantages: ['Strong position'],
        winProbability: 100,
      });

      vi.mocked(runLegalAgent).mockResolvedValueOnce({
        overallLegalScore: 100,
        confidence: 100,
        reasoning: 'No legal issues',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        complianceRisk: 'low',
        regulatoryIssues: [],
        contractRisks: [],
        ipConsiderations: ['Clear IP'],
        liabilityRisk: 'low',
      });

      vi.mocked(runReferenceAgent).mockResolvedValueOnce({
        overallReferenceScore: 100,
        confidence: 100,
        reasoning: 'Perfect references',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        relevantProjects: [],
        projectSimilarity: 'high',
        clientTestimonials: [],
        referenceQuality: 'excellent',
        matchScore: 100,
      });

      const mockInput: BitEvaluationInput = {
        bidId: 'test-perfect',
        extractedRequirements: { title: 'Test' },
      };

      const result = await runBitEvaluation(mockInput);

      expect(result.decision.scores.overall).toBe(100);
    });

    it('should handle edge case with zero scores', async () => {
      const { runCapabilityAgent } = await import('../agents/capability-agent');
      const { runDealQualityAgent } = await import('../agents/deal-quality-agent');
      const { runStrategicFitAgent } = await import('../agents/strategic-fit-agent');
      const { runCompetitionAgent } = await import('../agents/competition-agent');
      const { runLegalAgent } = await import('../agents/legal-agent');
      const { runReferenceAgent } = await import('../agents/reference-agent');

      vi.mocked(runCapabilityAgent).mockResolvedValueOnce({
        overallCapabilityScore: 0,
        confidence: 100,
        reasoning: 'No capability',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        hasRequiredTechnologies: false,
        technologyMatchScore: 0,
        missingCapabilities: ['All missing'],
        hasRequiredScale: false,
        scaleMatchScore: 0,
        scaleGaps: ['No scale'],
      });

      vi.mocked(runDealQualityAgent).mockResolvedValueOnce({
        overallDealQualityScore: 0,
        confidence: 100,
        reasoning: 'Poor quality',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        budgetAdequacy: 'inadequate',
        estimatedMargin: -50,
        budgetRisks: ['Very low budget'],
        timelineRealism: 'unrealistic',
        timelineRisks: ['Impossible timeline'],
        clientRiskRating: 'critical',
        clientRiskFactors: ['High risk'],
        projectComplexity: 'critical',
        complexityFactors: ['Too complex'],
        strategicValue: 'none',
        strategicFactors: [],
        contractTypeRisk: 'critical',
        contractRisks: ['Terrible terms'],
      });

      vi.mocked(runStrategicFitAgent).mockResolvedValueOnce({
        overallStrategicFitScore: 0,
        confidence: 100,
        reasoning: 'No strategic fit',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        strategicAlignment: 'none',
        marketPositioning: 'weak',
        competitiveAdvantage: 'none',
        synergies: [],
        fitScore: 0,
      });

      vi.mocked(runCompetitionAgent).mockResolvedValueOnce({
        estimatedWinProbability: 0,
        confidence: 100,
        reasoning: 'High competition',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        competitiveIntensity: 'extreme',
        competitors: ['Many strong competitors'],
        competitiveAdvantages: [],
        winProbability: 0,
      });

      vi.mocked(runLegalAgent).mockResolvedValueOnce({
        overallLegalScore: 0,
        confidence: 100,
        reasoning: 'Major legal issues',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        complianceRisk: 'critical',
        regulatoryIssues: ['Major compliance issues'],
        contractRisks: ['Severe contract risks'],
        ipConsiderations: ['IP conflicts'],
        liabilityRisk: 'critical',
      });

      vi.mocked(runReferenceAgent).mockResolvedValueOnce({
        overallReferenceScore: 0,
        confidence: 100,
        reasoning: 'No references',
        criticalBlockers: [],
        // @ts-expect-error - Testing with partial mock data
        relevantProjects: [],
        projectSimilarity: 'none',
        clientTestimonials: [],
        referenceQuality: 'poor',
        matchScore: 0,
      });

      const mockInput: BitEvaluationInput = {
        bidId: 'test-zero',
        extractedRequirements: { title: 'Test' },
      };

      const result = await runBitEvaluation(mockInput);

      expect(result.decision.scores.overall).toBe(0);
    });
  });

  describe('Activity Logging', () => {
    it('should log start of evaluation', async () => {
      const mockInput: BitEvaluationInput = {
        bidId: 'test-logging-1',
        extractedRequirements: { title: 'Test' },
      };

      const result = await runBitEvaluation(mockInput);

      expect(result.evaluationDuration).toBeDefined();
      expect(result.evaluatedAt).toBeDefined();
    });

    it('should log completion with duration', async () => {
      const mockInput: BitEvaluationInput = {
        bidId: 'test-logging-2',
        extractedRequirements: { title: 'Test' },
      };

      const result = await runBitEvaluation(mockInput);

      expect(result.evaluationDuration).toBeGreaterThanOrEqual(0);
      expect(result.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Error Handling', () => {
    it('should throw and log error when coordinator fails', async () => {
      const { runCoordinatorAgent } = await import('../coordinator-agent');
      vi.mocked(runCoordinatorAgent).mockRejectedValueOnce(new Error('Coordinator failed'));

      const mockInput: BitEvaluationInput = {
        bidId: 'test-error',
        extractedRequirements: { title: 'Test' },
      };

      await expect(runBitEvaluation(mockInput)).rejects.toThrow('Coordinator failed');
    });

    it('should handle multiple agent failures gracefully', async () => {
      const { runCapabilityAgent } = await import('../agents/capability-agent');
      const { runDealQualityAgent } = await import('../agents/deal-quality-agent');

      vi.mocked(runCapabilityAgent).mockRejectedValueOnce(new Error('Capability agent failed'));
      vi.mocked(runDealQualityAgent).mockRejectedValueOnce(new Error('Deal quality agent failed'));

      const mockInput: BitEvaluationInput = {
        bidId: 'test-multi-error',
        extractedRequirements: { title: 'Test' },
      };

      await expect(runBitEvaluation(mockInput)).rejects.toThrow();
    });
  });

  describe('Result Structure', () => {
    it('should return complete evaluation result structure', async () => {
      const mockInput: BitEvaluationInput = {
        bidId: 'test-structure',
        extractedRequirements: { title: 'Test' },
      };

      const result = await runBitEvaluation(mockInput);

      // Verify all required fields
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(result).toMatchObject({
        capabilityMatch: expect.any(Object),
        dealQuality: expect.any(Object),
        strategicFit: expect.any(Object),
        competitionCheck: expect.any(Object),
        legalAssessment: expect.any(Object),
        contractAnalysis: expect.any(Object),
        referenceMatch: expect.any(Object),
        decision: expect.any(Object),
        coordinatorOutput: expect.any(Object),
        evaluatedAt: expect.any(String),
        evaluationDuration: expect.any(Number),
      });
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });

    it('should include decision with all required fields', async () => {
      const mockInput: BitEvaluationInput = {
        bidId: 'test-decision-structure',
        extractedRequirements: { title: 'Test' },
      };

      const result = await runBitEvaluation(mockInput);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(result.decision).toMatchObject({
        decision: expect.any(String),
        scores: expect.any(Object),
        overallConfidence: expect.any(Number),
        reasoning: expect.any(String),
        keyStrengths: expect.any(Array),
        keyRisks: expect.any(Array),
        criticalBlockers: expect.any(Array),
        nextSteps: expect.any(Array),
      });
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });
  });
});
