/**
 * Timeline Agent Tests
 *
 * Tests for timeline generation and calculation utilities:
 * - calculateBaseDays (pure function)
 * - assessComplexity (pure function)
 * - calculateWorkingDays (utility function)
 * - addWorkingDays (utility function)
 * - generateTimeline (main async function)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateObject } from 'ai';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

// Mock AI providers
vi.mock('@/lib/ai/providers', () => ({
  openai: vi.fn(),
}));

// Mock RAG service
vi.mock('@/lib/rag/retrieval-service', () => ({
  queryRAG: vi.fn(),
}));

import {
  calculateBaseDays,
  assessComplexity,
  calculateWorkingDays,
  addWorkingDays,
  generateTimeline,
  type TimelineAgentInput,
} from '../agent';
import { COMPLEXITY_MULTIPLIERS } from '../schema';

describe('Timeline Agent - calculateBaseDays', () => {
  it('should calculate base days with default values', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
    };

    const result = calculateBaseDays(input);

    // Default: pages=50, contentTypes=5, integrations=0
    // Formula: 50 * 0.5 + 5 * 5 + 0 * 10 + 30 = 25 + 25 + 0 + 30 = 80
    expect(result).toBe(80);
  });

  it('should calculate base days with custom page count', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
      estimatedPageCount: 100,
    };

    const result = calculateBaseDays(input);

    // Formula: 100 * 0.5 + 5 * 5 + 0 * 10 + 30 = 50 + 25 + 0 + 30 = 105
    expect(result).toBe(105);
  });

  it('should calculate base days with multiple content types', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
      contentTypes: 15,
    };

    const result = calculateBaseDays(input);

    // Formula: 50 * 0.5 + 15 * 5 + 0 * 10 + 30 = 25 + 75 + 0 + 30 = 130
    expect(result).toBe(130);
  });

  it('should calculate base days with integrations', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
      detectedIntegrations: ['CRM', 'ERP', 'Payment'],
    };

    const result = calculateBaseDays(input);

    // Formula: 50 * 0.5 + 5 * 5 + 3 * 10 + 30 = 25 + 25 + 30 + 30 = 110
    expect(result).toBe(110);
  });

  it('should handle large project with all factors', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
      estimatedPageCount: 500,
      contentTypes: 25,
      detectedIntegrations: ['CRM', 'ERP', 'Payment', 'Search', 'Analytics'],
    };

    const result = calculateBaseDays(input);

    // Formula: 500 * 0.5 + 25 * 5 + 5 * 10 + 30 = 250 + 125 + 50 + 30 = 455
    expect(result).toBe(455);
  });
});

describe('Timeline Agent - assessComplexity', () => {
  it('should return "low" for small simple project', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
      estimatedPageCount: 20,
      contentTypes: 3,
      detectedIntegrations: [],
      detectedFeatures: [],
    };

    const result = assessComplexity(input);

    expect(result).toBe('low');
  });

  it('should return "medium" for medium project', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
      estimatedPageCount: 80,
      contentTypes: 8,
      detectedIntegrations: ['CRM'],
      detectedFeatures: ['Search'],
    };

    const result = assessComplexity(input);

    expect(result).toBe('medium');
  });

  it('should return "high" for large complex project', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
      estimatedPageCount: 250,
      contentTypes: 15,
      detectedIntegrations: ['CRM', 'ERP', 'Payment'],
      detectedFeatures: ['Search', 'Analytics', 'E-commerce'],
    };

    const result = assessComplexity(input);

    expect(result).toBe('high');
  });

  it('should return "very_high" for very large enterprise project', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
      estimatedPageCount: 500,
      contentTypes: 25,
      detectedIntegrations: ['CRM', 'ERP', 'Payment', 'Search', 'Analytics', 'PIM'],
      detectedFeatures: ['Search', 'Analytics', 'E-commerce', 'Personalization', 'A/B Testing'],
    };

    const result = assessComplexity(input);

    expect(result).toBe('very_high');
  });

  it('should use default values for missing inputs', () => {
    const input: TimelineAgentInput = {
      projectName: 'Test',
      projectDescription: 'Test project',
      websiteUrl: 'https://example.com',
    };

    const result = assessComplexity(input);

    // Default: pages=50, contentTypes=5, integrations=0, features=0
    // Score: 2 (pages) + 2 (contentTypes) + 0 (integrations) + 0 (features) = 4
    // Score 4 = "low"
    expect(result).toBe('low');
  });
});

describe('Timeline Agent - calculateWorkingDays', () => {
  it('should calculate working days for same week', () => {
    const startDate = new Date('2025-01-20'); // Monday
    const endDate = new Date('2025-01-24'); // Friday

    const result = calculateWorkingDays(startDate, endDate);

    expect(result).toBe(5); // Mon-Fri = 5 days
  });

  it('should exclude weekends', () => {
    const startDate = new Date('2025-01-20'); // Monday
    const endDate = new Date('2025-01-26'); // Sunday

    const result = calculateWorkingDays(startDate, endDate);

    expect(result).toBe(5); // Mon-Fri only (Sat + Sun excluded)
  });

  it('should calculate across multiple weeks', () => {
    const startDate = new Date('2025-01-20'); // Monday
    const endDate = new Date('2025-01-31'); // Friday (2 weeks later)

    const result = calculateWorkingDays(startDate, endDate);

    expect(result).toBe(10); // 2 weeks * 5 working days
  });

  it('should handle single day', () => {
    const startDate = new Date('2025-01-20'); // Monday
    const endDate = new Date('2025-01-20'); // Same Monday

    const result = calculateWorkingDays(startDate, endDate);

    expect(result).toBe(1); // Single working day
  });

  it('should return 0 for weekend only', () => {
    const startDate = new Date('2025-01-25'); // Saturday
    const endDate = new Date('2025-01-26'); // Sunday

    const result = calculateWorkingDays(startDate, endDate);

    expect(result).toBe(0); // No working days
  });
});

describe('Timeline Agent - addWorkingDays', () => {
  it('should add working days to Monday', () => {
    const startDate = new Date('2025-01-20'); // Monday
    const result = addWorkingDays(startDate, 5);

    // Starting Mon 20, adding 5 working days:
    // Tue 21, Wed 22, Thu 23, Fri 24, Mon 27 = 5 days
    expect(result.getDay()).toBe(1); // Should be Monday
    expect(result.getDate()).toBe(27);
  });

  it('should skip weekends when adding days', () => {
    const startDate = new Date('2025-01-23'); // Thursday
    const result = addWorkingDays(startDate, 3);

    // Thu 23, starting NEXT day: Fri 24, Mon 27, Tue 28 = 3 working days
    expect(result.getDay()).toBe(2); // Should be Tuesday
    expect(result.getDate()).toBe(28);
  });

  it('should handle adding zero days', () => {
    const startDate = new Date('2025-01-20'); // Monday
    const result = addWorkingDays(startDate, 0);

    expect(result.getTime()).toBe(startDate.getTime());
  });

  it('should add days across multiple weeks', () => {
    const startDate = new Date('2025-01-20'); // Monday
    const result = addWorkingDays(startDate, 10);

    // Starting Mon Jan 20, counting from NEXT day:
    // Tue(1), Wed(2), Thu(3), Fri(4), Mon(5), Tue(6), Wed(7), Thu(8), Fri(9), Mon(10)
    // Should be Monday Feb 3
    expect(result.getDay()).toBe(1); // Should be Monday
    expect(result.getDate()).toBe(3);
    expect(result.getMonth()).toBe(1); // February (0-indexed)
  });

  it('should handle large number of days', () => {
    const startDate = new Date('2025-01-20'); // Monday
    const result = addWorkingDays(startDate, 22); // ~1 month

    // 22 working days from Mon Jan 20 should be Wed Feb 19
    expect(result.getDate()).toBe(19);
    expect(result.getDay()).toBe(3); // Wednesday
    expect(result.getMonth()).toBe(1); // February (0-indexed)
  });
});

describe('Timeline Agent - generateTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate timeline with minimal input', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        totalDays: 80,
        phases: [],
        recommendedTeamSize: 3,
        confidence: 75,
        assumptions: [],
        risks: [],
      },
    });

    const input: TimelineAgentInput = {
      projectName: 'Test Project',
      projectDescription: 'Test description',
      websiteUrl: 'https://example.com',
    };

    const result = await generateTimeline(input);

    expect(result).toBeDefined();
    expect(generateObject).toHaveBeenCalled();
  });

  it('should calculate complexity and use multiplier', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        totalDays: 104, // 80 base * 1.3 (high complexity)
        phases: [],
        recommendedTeamSize: 4,
        confidence: 65,
        assumptions: [],
        risks: [],
      },
    });

    const input: TimelineAgentInput = {
      projectName: 'Test Project',
      projectDescription: 'Test description',
      websiteUrl: 'https://example.com',
      estimatedPageCount: 250,
      contentTypes: 15,
      detectedIntegrations: ['CRM', 'ERP', 'Payment'],
      detectedFeatures: ['Search', 'Analytics'],
    };

    await generateTimeline(input);

    const callArgs = vi.mocked(generateObject).mock.calls[0];
    const prompt = callArgs[0].prompt as string;

    expect(prompt).toContain('Komplexität: high');
    expect(prompt).toContain('Multiplikator: 1.3x');
  });

  it('should include RAG context when rfpId is provided', async () => {
    const { queryRAG } = await import('@/lib/rag/retrieval-service');

    vi.mocked(queryRAG).mockResolvedValue([
      {
        agentName: 'Performance Agent',
        content: 'Performance is good with 90/100 LCP score',
        embedding: [],
        metadata: {},
      },
    ]);

    vi.mocked(generateObject).mockResolvedValue({
      object: {
        totalDays: 80,
        phases: [],
        recommendedTeamSize: 3,
        confidence: 75,
        assumptions: [],
        risks: [],
      },
    });

    const input: TimelineAgentInput = {
      projectName: 'Test Project',
      projectDescription: 'Test description',
      websiteUrl: 'https://example.com',
      rfpId: 'test-rfp-123',
    };

    await generateTimeline(input);

    expect(queryRAG).toHaveBeenCalledTimes(2); // Performance + Content queries
    expect(generateObject).toHaveBeenCalled();

    const callArgs = vi.mocked(generateObject).mock.calls[0];
    const prompt = callArgs[0].prompt as string;
    expect(prompt).toContain('Additional Context from Knowledge Base');
  });

  it('should handle RAG query errors gracefully', async () => {
    const { queryRAG } = await import('@/lib/rag/retrieval-service');

    vi.mocked(queryRAG).mockRejectedValue(new Error('RAG service unavailable'));

    vi.mocked(generateObject).mockResolvedValue({
      object: {
        totalDays: 80,
        phases: [],
        recommendedTeamSize: 3,
        confidence: 75,
        assumptions: [],
        risks: [],
      },
    });

    const input: TimelineAgentInput = {
      projectName: 'Test Project',
      projectDescription: 'Test description',
      websiteUrl: 'https://example.com',
      rfpId: 'test-rfp-123',
    };

    const result = await generateTimeline(input);

    // Should still complete despite RAG error
    expect(result).toBeDefined();
    expect(generateObject).toHaveBeenCalled();
  });

  it('should include target deadline in prompt if provided', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        totalDays: 80,
        phases: [],
        recommendedTeamSize: 3,
        confidence: 75,
        assumptions: [],
        risks: [],
      },
    });

    const input: TimelineAgentInput = {
      projectName: 'Test Project',
      projectDescription: 'Test description',
      websiteUrl: 'https://example.com',
      targetDeadline: '2025-06-30',
    };

    await generateTimeline(input);

    const callArgs = vi.mocked(generateObject).mock.calls[0];
    const prompt = callArgs[0].prompt as string;

    expect(prompt).toContain('RFP Deadline');
    expect(prompt).toContain('2025-06-30');
  });

  it('should include special requirements in prompt if provided', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        totalDays: 80,
        phases: [],
        recommendedTeamSize: 3,
        confidence: 75,
        assumptions: [],
        risks: [],
      },
    });

    const input: TimelineAgentInput = {
      projectName: 'Test Project',
      projectDescription: 'Test description',
      websiteUrl: 'https://example.com',
      specialRequirements: ['GDPR compliance required', 'Multi-language support'],
    };

    await generateTimeline(input);

    const callArgs = vi.mocked(generateObject).mock.calls[0];
    const prompt = callArgs[0].prompt as string;

    expect(prompt).toContain('Special Requirements');
    expect(prompt).toContain('GDPR compliance required');
    expect(prompt).toContain('Multi-language support');
  });
});
