import { describe, it, expect, vi, beforeEach } from 'vitest';

import { scoreComplexity } from '../complexity-scorer';

// Mock generateStructuredOutput
vi.mock('@/lib/ai/config', () => ({
  generateStructuredOutput: vi.fn(),
}));

import { generateStructuredOutput } from '@/lib/ai/config';

const mockGenerateStructuredOutput = vi.mocked(generateStructuredOutput);

describe('scoreComplexity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultParams = {
    componentCount: 15,
    performanceScore: 70,
    accessibilityScore: 85,
    techStack: null,
  };

  const mockResult = {
    complexity: 'medium' as const,
    score: 45,
    reasoning: 'Moderate complexity based on metrics',
    factors: [{ factor: 'Moderate Komponenten-Anzahl', impact: 'neutral' as const, weight: 15 }],
  };

  it('returns LLM result on success', async () => {
    mockGenerateStructuredOutput.mockResolvedValueOnce(mockResult);

    const result = await scoreComplexity(defaultParams);

    expect(result).toEqual(mockResult);
    expect(mockGenerateStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it('passes component count in prompt', async () => {
    mockGenerateStructuredOutput.mockResolvedValueOnce(mockResult);

    await scoreComplexity({ ...defaultParams, componentCount: 42 });

    const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Komponenten-Anzahl: 42');
  });

  it('passes performance score in prompt', async () => {
    mockGenerateStructuredOutput.mockResolvedValueOnce(mockResult);

    await scoreComplexity({ ...defaultParams, performanceScore: 35 });

    const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Performance-Score: 35/100');
  });

  it('passes accessibility score in prompt', async () => {
    mockGenerateStructuredOutput.mockResolvedValueOnce(mockResult);

    await scoreComplexity({ ...defaultParams, accessibilityScore: 60 });

    const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Accessibility-Score: 60/100');
  });

  it('serializes tech stack into prompt when provided', async () => {
    mockGenerateStructuredOutput.mockResolvedValueOnce(mockResult);
    const techStack = { framework: 'React', cms: 'WordPress' };

    await scoreComplexity({ ...defaultParams, techStack });

    const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
    expect(callArgs.prompt).toContain('"framework": "React"');
    expect(callArgs.prompt).toContain('"cms": "WordPress"');
  });

  it('uses "Nicht erkannt" when tech stack is null', async () => {
    mockGenerateStructuredOutput.mockResolvedValueOnce(mockResult);

    await scoreComplexity({ ...defaultParams, techStack: null });

    const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Tech-Stack: Nicht erkannt');
  });

  it('retries once on first failure and returns result', async () => {
    mockGenerateStructuredOutput
      .mockRejectedValueOnce(new Error('Rate limit'))
      .mockResolvedValueOnce(mockResult);

    const result = await scoreComplexity(defaultParams);

    expect(result).toEqual(mockResult);
    expect(mockGenerateStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it('throws when both attempts fail', async () => {
    const error = new Error('Service unavailable');
    mockGenerateStructuredOutput
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(error);

    await expect(scoreComplexity(defaultParams)).rejects.toThrow('Service unavailable');
    expect(mockGenerateStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it('uses fast model and low temperature', async () => {
    mockGenerateStructuredOutput.mockResolvedValueOnce(mockResult);

    await scoreComplexity(defaultParams);

    const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
    expect(callArgs.model).toBe('fast');
    expect(callArgs.temperature).toBe(0.2);
  });

  it('includes scoring rules in system prompt', async () => {
    mockGenerateStructuredOutput.mockResolvedValueOnce(mockResult);

    await scoreComplexity(defaultParams);

    const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
    expect(callArgs.system).toContain('0-30 = low');
    expect(callArgs.system).toContain('31-50 = medium');
    expect(callArgs.system).toContain('51-70 = high');
    expect(callArgs.system).toContain('71-100 = very_high');
  });
});
